import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../prismaClient';
import { WalletService } from '../services/WalletService';
import { GameTransactionService } from '../services/games/GameTransactionService';

const GATEWAY_URL = process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);

export class GameCloudController {
  
  // 1. GAME LAUNCH METHOD
  static async launchGame(req: Request, res: Response) {
    try {
      const { userId, gameCode } = req.body;
      
      const response = await axios.post(`${GATEWAY_URL}/api/v1/game/launch`, {
        reseller_id: RESELLER_ID,
        player_id: userId,
        game_uid: gameCode,
        mode: 'seamless',
        currency_code: 'INR',
        home_url: 'https://maltiplayx.com'
      }, {
        headers: {
          'Origin': 'https://maltiplayx.com',
          'Referer': 'https://maltiplayx.com/'
        }
      });
      
      if (response.data.status === 'SUCCESS') {
        return res.json({ launchUrl: response.data.game_launch_url });
      }
      return res.status(400).json({ error: response.data.error });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 1.5 DIRECT TEST ROUTE (No Frontend Needed)
  static async testLaunch(req: Request, res: Response) {
    try {
      const gameCode = req.params.gameCode || 'e04d1f3e'; // Spribe aviator prefix or exact if they provide
      
      // Ensure a dummy user exists for testing
      let user = await prisma.user.findFirst({ where: { username: 'testuser' } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: 'testuser',
            passwordHash: 'dummy',
            wallet: { create: { balance: 10000, currency: 'INR' } }
          }
        });
      }

      const response = await axios.post(`${GATEWAY_URL}/api/v1/game/launch`, {
        reseller_id: RESELLER_ID,
        player_id: user.id,
        game_uid: gameCode,
        mode: 'seamless',
        currency_code: 'INR',
        home_url: 'https://maltiplayx.com'
      }, {
        headers: {
          'Origin': 'https://maltiplayx.com',
          'Referer': 'https://maltiplayx.com/'
        }
      });
      
      if (response.data.status === 'SUCCESS') {
        // Redirect directly to the game!
        return res.redirect(response.data.game_launch_url);
      }
      return res.send(`GameCloud Error: ${JSON.stringify(response.data)}`);
    } catch (err: any) {
      return res.send(`Error: ${err.message}`);
    }
  }

  // 2. WEBHOOK CALLBACK RECEIVER
  static async callback(req: Request, res: Response) {
    try {
      const { action, player_id, amount, provider_txn_id, game_code } = req.body;

      // Ensure user exists
      const user = await prisma.user.findUnique({
        where: { id: player_id },
        include: { wallet: true }
      });

      if (!user || !user.wallet) {
        return res.status(404).json({ status: 'FAILED', error: 'PLAYER_NOT_FOUND' });
      }

      const walletId = user.wallet.id;

      if (action === 'balance') {
        return res.json({ status: 'SUCCESS', balance: Number(user.wallet.balance) });
      }

      // We need a dummy roundId for GameCloud if it doesn't provide one, or use provider_txn_id
      const roundId = provider_txn_id || `rnd_${Date.now()}`;
      // In GameTransactionService we need gameId (UUID from DB), but we only have game_code string.
      // For simplicity, we pass game_code as gameId in the transaction service.
      
      // Idempotency check handled by GameTransactionService

      if (action === 'bet') {
        if (Number(user.wallet.balance) < Number(amount)) {
          return res.status(400).json({ status: 'FAILED', error: 'INSUFFICIENT_FUNDS' });
        }
        
        await GameTransactionService.processProviderTransaction({
          userId: player_id,
          gameId: game_code,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'BET',
          currency: 'INR',
        });
        
      } else if (action === 'win') {
        await GameTransactionService.processProviderTransaction({
          userId: player_id,
          gameId: game_code,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'WIN',
          currency: 'INR',
        });
        
      } else {
        return res.status(400).json({ status: 'FAILED', error: 'INVALID_ACTION' });
      }

      // Fetch latest balance
      const updatedUser = await prisma.user.findUnique({
        where: { id: player_id },
        include: { wallet: true }
      });

      return res.json({ status: 'SUCCESS', balance: Number(updatedUser?.wallet?.balance || 0) });
      
    } catch (err: any) {
      // If WalletService throws Duplicate Transaction, handle it as idempotency
      if (err.message?.includes('idempotency') || err.message?.includes('Unique constraint')) {
        const user = await prisma.user.findUnique({
          where: { id: req.body.player_id },
          include: { wallet: true }
        });
        return res.json({ status: 'SUCCESS', balance: Number(user?.wallet?.balance || 0) });
      }
      console.error("GameCloud Webhook Error:", err);
      return res.status(500).json({ status: 'FAILED', error: err.message });
    }
  }
}
