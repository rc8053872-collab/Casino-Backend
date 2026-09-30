import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../prismaClient';
import { WalletService } from '../services/WalletService';
import { GameTransactionService } from '../services/games/GameTransactionService';

const GATEWAY_URL = process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);

function sanitizeErrorText(value: string | undefined): string | undefined {
  return value
    ?.replace(/\b(?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^\s"'<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(\b(?:password|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

function getSafeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorName: 'UnknownError',
      errorMessage: 'Non-Error exception',
      prismaCode: undefined,
      stackTrace: undefined,
    };
  }

  const prismaError = error as Error & { code?: unknown; errorCode?: unknown };
  const code = typeof prismaError.code === 'string'
    ? prismaError.code
    : typeof prismaError.errorCode === 'string'
      ? prismaError.errorCode
      : undefined;

  return {
    errorName: error.name,
    errorMessage: sanitizeErrorText(error.message),
    prismaCode: code,
    stackTrace: sanitizeErrorText(error.stack),
  };
}

export class GameCloudController {

  // 1. GAME LAUNCH METHOD
  static async launchGame(req: Request, res: Response) {
    try {
      const { userId, gameCode } = req.body;

      const response = await axios.post(`${GATEWAY_URL}/api/v1/game/launch`, {
        reseller_id: RESELLER_ID,
        token: 'bfc369fd4090461aa92ca32987be5668',
        api_token: 'bfc369fd4090461aa92ca32987be5668',
        player_id: userId,
        game_uid: gameCode,
        mode: 'seamless',
        currency_code: 'INR',
        home_url: 'https://maltiplayx.com'
      }, {
        headers: {
          'Origin': 'https://maltiplayx.com',
          'Referer': 'https://maltiplayx.com/',
          'Authorization': 'Bearer bfc369fd4090461aa92ca32987be5668',
          'x-api-token': 'bfc369fd4090461aa92ca32987be5668'
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
        token: 'bfc369fd4090461aa92ca32987be5668',
        api_token: 'bfc369fd4090461aa92ca32907be5668',
        player_id: user.id,
        game_uid: gameCode,
        mode: 'seamless',
        currency_code: 'INR',
        home_url: 'https://maltiplayx.com'
      }, {
        headers: {
          'Origin': 'https://maltiplayx.com',
          'Referer': 'https://maltiplayx.com/',
          'Authorization': 'Bearer bfc369fd4090461aa92ca32987be5668',
          'x-api-token': 'bfc369fd4090461aa92ca32987be5668'
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
    const body = req.body as Record<string, unknown> | undefined;
    const { player_id } = body ?? {};
    const playerId = typeof player_id === 'string' ? player_id.trim() : '';

    console.log("CALLBACK BODY", {
      action: req.body?.action,
      player_id: req.body?.player_id,
      playerId: req.body?.playerId,
      currency: req.body?.currency
    });

    if (!playerId) {
      return res.status(400).json({ status: 'FAILED', error: 'PLAYER_ID_REQUIRED' });
    }

    try {
      const { action, amount, provider_txn_id, game_code } = req.body;

      // Ensure user exists
      const user = await prisma.user.findUnique({
        where: { id: playerId },
        include: { wallet: true }
      });

      if (!user) {
        return res.status(404).json({ status: 'FAILED', error: 'PLAYER_NOT_FOUND' });
      }
      if (!user.wallet) {
        return res.status(404).json({ status: 'FAILED', error: 'WALLET_NOT_FOUND' });
      }

      const walletId = user.wallet.id;

      if (action === 'balance') {
        return res.json({ status: 'SUCCESS', balance: Number(user.wallet.balance) });
      }

      if (!game_code || typeof game_code !== 'string') {
        return res.status(400).json({ status: 'FAILED', error: 'INVALID_GAME_CODE' });
      }

      const game = await prisma.game.findFirst({
        where: {
          OR: [
            { slug: game_code },
            { providerId: game_code }
          ]
        }
      });

      if (!game) {
        return res.status(400).json({ status: 'FAILED', error: 'INVALID_GAME_CODE' });
      }

      const internalGameId = game.id;

      // We need a dummy roundId for GameCloud if it doesn't provide one, or use provider_txn_id
      const roundId = provider_txn_id || `rnd_${Date.now()}`;

      // Idempotency check handled by GameTransactionService

      if (action === 'bet') {
        if (Number(user.wallet.balance) < Number(amount)) {
          return res.status(400).json({ status: 'FAILED', error: 'INSUFFICIENT_FUNDS' });
        }

        await GameTransactionService.processProviderTransaction({
          userId: playerId,
          gameId: internalGameId,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'BET',
          currency: 'INR',
        });

      } else if (action === 'win') {
        await GameTransactionService.processProviderTransaction({
          userId: playerId,
          gameId: internalGameId,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'WIN',
          currency: 'INR',
        });

      } else if (action === 'refund') {
        await GameTransactionService.processProviderTransaction({
          userId: playerId,
          gameId: internalGameId,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'REFUND',
          currency: 'INR',
        });

      } else {
        return res.status(400).json({ status: 'FAILED', error: 'INVALID_ACTION' });
      }

      // Fetch latest balance
      const updatedUser = await prisma.user.findUnique({
        where: { id: playerId },
        include: { wallet: true }
      });

      return res.json({ status: 'SUCCESS', balance: Number(updatedUser?.wallet?.balance || 0) });

    } catch (err: unknown) {
      // If WalletService throws Duplicate Transaction, handle it as idempotency
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.toLowerCase().includes('idempotency') || errorMessage.includes('Unique constraint')) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: playerId },
            include: { wallet: true }
          });
          if (!user) {
            return res.status(404).json({ status: 'FAILED', error: 'PLAYER_NOT_FOUND' });
          }
          if (!user.wallet) {
            return res.status(404).json({ status: 'FAILED', error: 'WALLET_NOT_FOUND' });
          }
          return res.json({ status: 'SUCCESS', balance: Number(user.wallet.balance) });
        } catch (lookupError) {
          console.error('GameCloud duplicate callback lookup failed:', {
            action: req.body?.action,
            player_id: playerId,
            currency: req.body?.currency,
            ...getSafeErrorDetails(lookupError),
          });
          return res.status(500).json({ status: 'FAILED', error: lookupError instanceof Error ? lookupError.message : 'INTERNAL_ERROR', details: getSafeErrorDetails(lookupError) });
        }
      }

      if (errorMessage.includes('ORIGINAL_TRANSACTION_NOT_FOUND')) {
        return res.status(400).json({ status: 'FAILED', error: 'ORIGINAL_TRANSACTION_NOT_FOUND' });
      }

      console.error('GameCloud callback failed:', {
        action: req.body?.action,
        player_id: playerId,
        currency: req.body?.currency,
        ...getSafeErrorDetails(err),
      });
      return res.status(500).json({ status: 'FAILED', error: errorMessage || 'INTERNAL_ERROR', details: getSafeErrorDetails(err) });
    }
  }
}
