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
      const player_id = req.user?.id;
      const { game_uid, currency_code } = req.body;

      if (!player_id || !game_uid) {
        return res.status(400).json({ status: 'FAILED', error: 'MISSING_PARAMETERS', message: 'Player ID and Game UID are required' });
      }

      // 1. Validate Player
      const user = await prisma.user.findUnique({
        where: { id: player_id },
        include: { wallet: true }
      });

      if (!user) {
        return res.status(404).json({ status: 'FAILED', error: 'PLAYER_NOT_FOUND' });
      }

      // 2. Validate Game
      const game = await prisma.game.findFirst({
        where: {
          OR: [
            { slug: game_uid },
            { providerId: game_uid }
          ]
        }
      });

      if (!game) {
        return res.status(404).json({ status: 'FAILED', error: 'GAME_NOT_FOUND' });
      }

      // External provider game code
      const externalGameUid = game.providerId || game.slug;

      // 3. Setup GameCloud request
      const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
      const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
      const API_TOKEN = process.env.GAMECLOUD_API_TOKEN || '';
      const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
      const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://api.maltiplayx.com';

      if (!API_TOKEN) {
        console.error('GameCloud launch failed: API token not configured.');
        return res.status(500).json({ status: 'FAILED', error: 'GAMECLOUD_AUTH_FAILED' });
      }

      try {
        const payload = {
          reseller_id: RESELLER_ID,
          token: API_TOKEN,
          api_token: SECRET_KEY,
          player_id: player_id,
          game_uid: externalGameUid,
          mode: 'seamless',
          currency_code: currency_code || user.wallet?.currency || 'INR',
          home_url: HOME_URL
        };

        const response = await axios.post(`${GATEWAY_URL}/api/v1/game/launch`, payload, {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'x-api-token': SECRET_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10s timeout
        });

        if (response.data?.status === 'SUCCESS') {
          console.log(`[GameCloud Launch] Success: player=${player_id}, game=${externalGameUid}, reseller=${RESELLER_ID}`);
          return res.json({
            status: 'SUCCESS',
            game_uid: externalGameUid,
            launch_url: response.data.game_launch_url
          });
        }

        const gcError = response.data?.error || response.data?.message || 'Unknown error from GameCloud';
        console.error(`[GameCloud Launch] Failed from provider: player=${player_id}, game=${externalGameUid}, status=${response.data?.status}, error=${gcError}`);

        if (typeof gcError === 'string' && gcError.toLowerCase().includes('reseller not found')) {
          return res.status(401).json({ status: 'FAILED', error: 'GAMECLOUD_AUTHENTICATION_FAILED' });
        }

        return res.status(400).json({
          status: 'FAILED',
          error: 'GAMECLOUD_LAUNCH_FAILED',
          details: gcError
        });

      } catch (axiosError: any) {
        console.error(`[GameCloud Launch] Network error: ${axiosError.message}`);

        if (axiosError.code === 'ECONNABORTED') {
          return res.status(504).json({ status: 'FAILED', error: 'GAMECLOUD_TIMEOUT' });
        }

        if (axiosError.response) {
          const respData = axiosError.response.data;
          const gcError = respData?.error || respData?.message || '';

          console.error(`[GameCloud Launch] HTTP ${axiosError.response.status}: error=${gcError}`);

          if (axiosError.response.status === 401 || axiosError.response.status === 403 || (typeof gcError === 'string' && gcError.toLowerCase().includes('reseller not found'))) {
            return res.status(401).json({ status: 'FAILED', error: 'GAMECLOUD_AUTHENTICATION_FAILED' });
          }
          if (axiosError.response.status === 404) {
            return res.status(404).json({ status: 'FAILED', error: 'GAMECLOUD_GAME_NOT_FOUND' });
          }
        }

        return res.status(500).json({ status: 'FAILED', error: 'GAMECLOUD_LAUNCH_FAILED' });
      }

    } catch (err: any) {
      console.error('Launch Game internal error:', err.message);
      return res.status(500).json({ status: 'FAILED', error: 'INTERNAL_ERROR' });
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
