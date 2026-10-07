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
      const game_slug = typeof req.body?.game_slug === 'string' ? req.body.game_slug.trim() : '';
      const game_uid = typeof req.body?.game_uid === 'string' ? req.body.game_uid.trim() : '';

      if (!player_id || (!game_slug && !game_uid)) {
        return res.status(400).json({ status: 'FAILED', error: 'MISSING_PARAMETERS', message: 'Player ID and game identifier are required' });
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
      let game = game_slug
        ? await prisma.game.findUnique({ where: { slug: game_slug } })
        : null;

      if (!game && game_uid) {
        const matches = await prisma.game.findMany({
          where: {
            OR: [
              { gameUid: game_uid },
              { providerId: game_uid },
              { slug: game_uid },
              ...(/^[a-f\d]{24}$/i.test(game_uid) ? [{ id: game_uid }] : []),
            ],
          },
          take: 2,
        });

        if (matches.length > 1) {
          return res.status(409).json({
            status: 'FAILED',
            error: 'AMBIGUOUS_GAME_UID',
            message: 'This game identifier matches multiple games. Please launch using the game slug.',
          });
        }
        game = matches[0] || null;
      }

      if (!game) {
        return res.status(404).json({ status: 'FAILED', error: 'GAME_NOT_FOUND' });
      }

      const walletCurrency = user.wallet?.currency || 'INR';

      if (game.category === 'SLOT') {
        if (!game.supportedCurrencies || !game.supportedCurrencies.includes(walletCurrency)) {
          return res.status(400).json({
            status: 'FAILED',
            error: 'CURRENCY_NOT_SUPPORTED',
            message: `This game is not available in ${walletCurrency}.`
          });
        }
      } else if (game.supportedCurrencies && game.supportedCurrencies.length > 0) {
        if (!game.supportedCurrencies.includes(walletCurrency)) {
          return res.status(400).json({
            status: 'FAILED',
            error: 'CURRENCY_NOT_SUPPORTED',
            message: `This game is not available for ${walletCurrency} players.`
          });
        }
      }

      // External provider game code
      const externalGameUid = game.gameUid || game.providerId || game.slug;

      // 3. Setup GameCloud request
      const GATEWAY_URL = process.env.GAMECLOUD_BASE_URL || process.env.GAMECLOUD_API_URL || 'https://api.gamecloudapi.com';
      const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID || 306);
      const API_TOKEN = process.env.GAMECLOUD_API_TOKEN || '';
      const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || API_TOKEN;
      const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://orbitplay.com';

      if (!API_TOKEN) {
        console.error('GameCloud launch failed: API token not configured.');
        return res.status(500).json({ status: 'FAILED', error: 'GAMECLOUD_AUTH_FAILED' });
      }

      try {
        const payload = {
          reseller_id: RESELLER_ID,
          player_id: player_id,
          game_uid: externalGameUid,
          mode: 'seamless',
          currency_code: walletCurrency,
          home_url: HOME_URL
        };

        const response = await axios.post(`${GATEWAY_URL}/api/v1/game/launch`, payload, {
          headers: {
            'X-API-Token': API_TOKEN,
            'X-Secret-Key': SECRET_KEY,
            'Origin': 'https://maltiplayx.com',
            'Referer': 'https://maltiplayx.com/',
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10s timeout
        });

        // Safe sanitized logging
        const safeLogPayload = {
          reseller_id: payload.reseller_id,
          game_uid: payload.game_uid,
          currency_code: payload.currency_code
        };

        if (response.data?.status === 'SUCCESS') {
          console.log(`[GameCloud Launch] Success`, { ...safeLogPayload, launch_url: '...' });
          return res.json({
            status: 'SUCCESS',
            game_uid: externalGameUid,
            launch_url: response.data.game_launch_url
          });
        }

        const gcError = response.data?.error || response.data?.message || 'Unknown error from GameCloud';
        console.error(`[GameCloud Launch] Failed from provider`, { ...safeLogPayload, status: response.data?.status, error: gcError });

        if (typeof gcError === 'string' && gcError.toLowerCase().includes('reseller not found')) {
          return res.status(401).json({ status: 'FAILED', error: 'UNAUTHORIZED', message: 'Game provider authentication failed.' });
        }

        if (typeof gcError === 'string' && gcError.toLowerCase().includes('currently disabled')) {
          return res.status(400).json({ status: 'FAILED', error: 'GAME_UNAVAILABLE', message: 'Game is currently unavailable.' });
        }
        
        if (typeof gcError === 'string' && (gcError.toLowerCase().includes('invalid game') || gcError.toLowerCase().includes('not found'))) {
          return res.status(400).json({ status: 'FAILED', error: 'INVALID_GAME', message: 'Game configuration is invalid.' });
        }

        return res.status(400).json({
          status: 'FAILED',
          error: 'GAMECLOUD_LAUNCH_FAILED',
          message: typeof gcError === 'string' ? gcError : JSON.stringify(gcError)
        });

      } catch (axiosError: any) {
        // Safe sanitized logging
        const safeLogPayload = {
          reseller_id: RESELLER_ID,
          game_uid: externalGameUid,
          currency_code: walletCurrency
        };
        console.error(`[GameCloud Launch] Network/API error: ${axiosError.message}`, safeLogPayload);

        if (axiosError.code === 'ECONNABORTED') {
          return res.status(504).json({ status: 'FAILED', error: 'NETWORK_ERROR', message: 'Game provider is temporarily unavailable.' });
        }

        if (axiosError.response) {
          const respData = axiosError.response.data;
          const gcError = respData?.error || respData?.message || '';

          console.error(`[GameCloud Launch] HTTP ${axiosError.response.status}: error=${gcError}`);
          console.error(`[GameCloud Launch] Request Body:`, axiosError.config.data);

          if (typeof gcError === 'string' && gcError.toLowerCase().includes('currently disabled')) {
            return res.status(400).json({ status: 'FAILED', error: 'GAME_UNAVAILABLE', message: 'Game is currently unavailable.' });
          }
          if (typeof gcError === 'string' && (gcError.toLowerCase().includes('invalid game') || gcError.toLowerCase().includes('not found'))) {
            return res.status(400).json({ status: 'FAILED', error: 'INVALID_GAME', message: 'Game configuration is invalid.' });
          }

          // Preserve the original status code and error from GameCloud
          return res.status(axiosError.response.status).json({ 
            status: 'FAILED', 
            error: 'GAMECLOUD_LAUNCH_FAILED',
            message: gcError || JSON.stringify(respData)
          });
        }

        return res.status(500).json({ status: 'FAILED', error: 'NETWORK_ERROR', message: 'Game provider is temporarily unavailable.' });
      }

    } catch (err: any) {
      console.error('[GAME_LAUNCH_ERROR]', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return res.status(500).json({ status: 'FAILED', error: 'INTERNAL_ERROR', details: err.message });
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
      const { action, amount, provider_txn_id, game_code, currency } = req.body;

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
            { providerId: game_code },
            { gameUid: game_code }
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

      const txCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'INR';

      if (user.wallet.currency.toUpperCase() !== txCurrency) {
        console.error(`[GameCloud Callback] Currency Mismatch! Player: ${playerId}, Wallet: ${user.wallet.currency}, Request: ${txCurrency}`);
        return res.status(400).json({ 
          status: 'FAILED', 
          error: 'CURRENCY_MISMATCH', 
          message: `Wallet currency (${user.wallet.currency}) does not match game currency (${txCurrency}).`
        });
      }

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
          currency: txCurrency,
        });

      } else if (action === 'win') {
        await GameTransactionService.processProviderTransaction({
          userId: playerId,
          gameId: internalGameId,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'WIN',
          currency: txCurrency,
        });

      } else if (action === 'refund') {
        await GameTransactionService.processProviderTransaction({
          userId: playerId,
          gameId: internalGameId,
          roundId: roundId,
          transactionId: provider_txn_id,
          amount: Number(amount),
          type: 'REFUND',
          currency: txCurrency,
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
