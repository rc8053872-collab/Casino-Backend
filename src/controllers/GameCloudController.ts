import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../prismaClient';
import { GameTransactionService } from '../services/games/GameTransactionService';
import { createHash } from 'node:crypto';

function getPlayerLogId(playerId: string): string {
  return createHash('sha256').update(playerId).digest('hex').slice(0, 12);
}

function redactProviderMessage(message: string, secrets: string[]): string {
  let safeMessage = message;
  for (const secret of secrets) {
    if (secret.length >= 4) safeMessage = safeMessage.split(secret).join('[REDACTED]');
  }
  return safeMessage.replace(
    /(\b(?:password|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*)[^\s,;]+/gi,
    '$1[REDACTED]'
  );
}

export function resolveGameCloudPlayerId(user: {
  gameCloudPlayerId: string | null;
  mobile: string | null;
  id: string;
}): string {
  // If an explicit GameCloud mapping exists, use it.
  if (user.gameCloudPlayerId) {
    return user.gameCloudPlayerId;
  }
  // DO NOT use user.mobile. GameCloud's system maps mobile numbers to their
  // legacy internal player IDs (e.g., 63756). Since MALTIPLAYX migrated to
  // MongoDB ObjectIds, we don't have these legacy integer IDs in our database,
  // resulting in PLAYER_NOT_FOUND in bet/win callbacks.
  // Always use the MongoDB ObjectId (24-char hex) as the GameCloud player ID.
  return user.id;
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

      if (!user.wallet) {
        return res.status(404).json({ status: 'FAILED', error: 'WALLET_NOT_FOUND' });
      }

      const walletCurrency = user.wallet.currency;

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
      const RESELLER_ID = Number(process.env.GAMECLOUD_RESELLER_ID);
      const API_TOKEN = process.env.GAMECLOUD_API_TOKEN || '';
      const SECRET_KEY = process.env.GAMECLOUD_SECRET_KEY || '';
      const HOME_URL = process.env.GAMECLOUD_HOME_URL || 'https://maltiplayx.com';
      const redactProviderError = (value: unknown): string => {
        const message = typeof value === 'string' ? value : 'Provider returned an unspecified error.';
        return redactProviderMessage(message, [API_TOKEN, SECRET_KEY]);
      };

      if (!Number.isInteger(RESELLER_ID) || RESELLER_ID <= 0 || !API_TOKEN || !SECRET_KEY) {
        console.error('GameCloud launch failed: reseller ID or credentials are not configured.');
        return res.status(500).json({ status: 'FAILED', error: 'GAMECLOUD_CONFIGURATION_ERROR' });
      }

      try {
        const gameCloudPlayerId = resolveGameCloudPlayerId(user);

        const payload = {
          reseller_id: RESELLER_ID,
          player_id: gameCloudPlayerId,
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

        const gcError = redactProviderError(
          response.data?.error || response.data?.message || 'Unknown error from GameCloud'
        );
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

      } catch (axiosError: unknown) {
        const error = axios.isAxiosError(axiosError) ? axiosError : null;
        // Safe sanitized logging
        const safeLogPayload = {
          reseller_id: RESELLER_ID,
          game_uid: externalGameUid,
          currency_code: walletCurrency
        };
        console.error('[GameCloud Launch] Network/API error', {
          ...safeLogPayload,
          error: redactProviderError(error?.message || (axiosError instanceof Error ? axiosError.message : 'Unknown error')),
          providerStatus: error?.response?.status,
          providerError: redactProviderError(error?.response?.data?.error || error?.response?.data?.message),
        });

        if (error?.code === 'ECONNABORTED') {
          return res.status(504).json({ status: 'FAILED', error: 'NETWORK_ERROR', message: 'Game provider is temporarily unavailable.' });
        }

        if (error?.response) {
          const respData = error.response.data;
          const rawGcError = respData?.error || respData?.message;
          const gcError = rawGcError ? redactProviderError(rawGcError) : '';
          console.error(`[GameCloud Launch] Provider returned HTTP ${error.response.status}`, {
            error: gcError || undefined,
          });

          if (typeof gcError === 'string' && gcError.toLowerCase().includes('currently disabled')) {
            return res.status(400).json({ status: 'FAILED', error: 'GAME_UNAVAILABLE', message: 'Game is currently unavailable.' });
          }
          if (typeof gcError === 'string' && (gcError.toLowerCase().includes('invalid game') || gcError.toLowerCase().includes('not found'))) {
            return res.status(400).json({ status: 'FAILED', error: 'INVALID_GAME', message: 'Game configuration is invalid.' });
          }

          // Preserve the original status code and error from GameCloud
          return res.status(error.response.status).json({
            status: 'FAILED', 
            error: 'GAMECLOUD_LAUNCH_FAILED',
            message: gcError || `GameCloud returned HTTP ${error.response.status}.`
          });
        }

        return res.status(500).json({ status: 'FAILED', error: 'NETWORK_ERROR', message: 'Game provider is temporarily unavailable.' });
      }

    } catch (err: any) {
      console.error('[GAME_LAUNCH_ERROR]', {
        errorName: err instanceof Error ? err.name : 'UnknownError',
      });
      return res.status(500).json({ status: 'FAILED', error: 'INTERNAL_ERROR' });
    }
  }

  // 2. WEBHOOK CALLBACK RECEIVER
  static async callback(req: Request, res: Response) {
    const body = req.body as Record<string, unknown> | undefined;
    const playerValue = body?.player_id ?? body?.playerId;
    const playerId = (typeof playerValue === 'string' || typeof playerValue === 'number') ? String(playerValue).trim() : '';
    const action = typeof body?.action === 'string' ? body.action.toLowerCase() : '';
    const providerTxnVal = body?.provider_txn_id ?? body?.providerTxnId;
    const providerTransactionId = (typeof providerTxnVal === 'string' || typeof providerTxnVal === 'number')
      ? String(providerTxnVal).trim()
      : '';
    const callbackEventId = createHash('sha256')
      .update(`${action}:${providerTransactionId}:${playerId}`)
      .digest('hex')
      .slice(0, 12);
    const idempotencyKey = providerTransactionId
      ? `gamecloud:${action}:${providerTransactionId}`
      : '';
    let resolvedUserId = '';
    let resolvedGameId = '';
    let callbackAmount: number | undefined;
    const receivedAmount = body?.amount;
    const safeReceivedAmount = typeof receivedAmount === 'number'
      ? receivedAmount
      : typeof receivedAmount === 'string'
        ? receivedAmount.slice(0, 32)
        : receivedAmount === undefined ? undefined : '[non-scalar]';

    console.info('[GC_CALLBACK] Received', {
      callbackEventId,
      action: action || 'missing',
      playerRef: playerId ? getPlayerLogId(playerId) : undefined,
      amount: safeReceivedAmount,
      currency: typeof body?.currency === 'string' ? body.currency.slice(0, 12) : undefined,
      gameRef: typeof body?.game_code === 'string' ? getPlayerLogId(body.game_code) : undefined,
      providerTransactionRef: providerTransactionId ? getPlayerLogId(providerTransactionId) : undefined,
      fields: body ? Object.keys(body).sort() : [],
    });

    if (!playerId || playerId.length > 128) {
      return res.status(400).json({ status: 'FAILED', error: 'PLAYER_ID_REQUIRED' });
    }
    if (!['balance', 'bet', 'win', 'refund'].includes(action)) {
      return res.status(400).json({ status: 'FAILED', error: 'INVALID_ACTION' });
    }

    try {
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { gameCloudPlayerId: playerId },
            { mobile: playerId },
            ...(/^[a-f\d]{24}$/i.test(playerId) ? [{ id: playerId }] : []),
          ],
        },
        include: { wallet: true },
        take: 2,
      });
      if (matchingUsers.length > 1) {
        console.error('[GC_CALLBACK] Player ID resolves to multiple accounts', {
          callbackEventId,
          action,
          playerRef: getPlayerLogId(playerId),
          error: 'AMBIGUOUS_PLAYER_ID',
        });
        return res.status(409).json({ status: 'FAILED', error: 'AMBIGUOUS_PLAYER_ID' });
      }
      const user = matchingUsers[0] || null;
      resolvedUserId = user?.id || '';

      if (!user) {
        console.error('[GC_CALLBACK] Player lookup failed', {
          callbackEventId,
          action,
          playerRef: getPlayerLogId(playerId),
          error: 'PLAYER_NOT_FOUND',
        });
        return res.status(404).json({ status: 'FAILED', error: 'PLAYER_NOT_FOUND' });
      }
      if (!user.wallet) {
        return res.status(404).json({ status: 'FAILED', error: 'WALLET_NOT_FOUND' });
      }

      const currencyValue = body?.currency;
      const callbackCurrency = typeof currencyValue === 'string' ? currencyValue.trim().toUpperCase() : '';
      if (callbackCurrency && callbackCurrency !== user.wallet.currency.toUpperCase()) {
        console.error('[GC_CALLBACK] Currency mismatch', {
          callbackEventId,
          action,
          playerRef: getPlayerLogId(playerId),
          expectedCurrency: user.wallet.currency,
          receivedCurrency: callbackCurrency,
        });
        return res.status(400).json({ status: 'FAILED', error: 'CURRENCY_MISMATCH' });
      }

      if (action === 'balance') {
        return res.json({ status: 'SUCCESS', balance: Number(user.wallet.balance) });
      }

      if (!providerTransactionId || providerTransactionId.length > 200) {
        return res.status(400).json({ status: 'FAILED', error: 'PROVIDER_TRANSACTION_ID_REQUIRED' });
      }
      if (!callbackCurrency) {
        return res.status(400).json({ status: 'FAILED', error: 'CURRENCY_REQUIRED' });
      }

      const amountValue = body?.amount;
      const amount = Number(amountValue);
      callbackAmount = amount;
      if (!Number.isFinite(amount) || (action !== 'win' && amount <= 0)) {
        return res.status(400).json({ status: 'FAILED', error: 'INVALID_AMOUNT' });
      }

      if (action === 'refund') {
        return res.status(400).json({ status: 'FAILED', error: 'REFUND_REFERENCE_REQUIRED' });
      }

      const gameCodeValue = body?.game_code;
      const gameCode = (typeof gameCodeValue === 'string' || typeof gameCodeValue === 'number') ? String(gameCodeValue).trim() : '';
      const game = gameCode ? await prisma.game.findFirst({
        where: {
          OR: [
            { slug: gameCode },
            { providerId: gameCode },
            { gameUid: gameCode },
          ]
        },
      }) : null;

      if (!game) {
        return res.status(400).json({ status: 'FAILED', error: 'GAME_NOT_FOUND' });
      }
      resolvedGameId = game.id;

      const transactionType = action === 'bet' ? 'BET' : 'WIN';
      const existingTransaction = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTransaction) {
        const isSameRequest =
          existingTransaction.walletId === user.wallet.id &&
          existingTransaction.gameId === game.id &&
          existingTransaction.amount === amount &&
          existingTransaction.currency.toUpperCase() === callbackCurrency &&
          existingTransaction.type === transactionType &&
          existingTransaction.referenceId === providerTransactionId;
        if (!isSameRequest) {
          console.error('[GC_CALLBACK] Conflict', { callbackEventId, error: 'TRANSACTION_ID_CONFLICT' });
          return res.status(409).json({ status: 'FAILED', error: 'TRANSACTION_ID_CONFLICT' });
        }
        const currentWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
        console.info('[GC_CALLBACK] Idempotent Success', { callbackEventId, balance: currentWallet?.balance });
        return res.json({ status: 'SUCCESS', balance: Number(currentWallet?.balance ?? 0) });
      }

      console.info('[GC_CALLBACK] Processing Transaction', {
        callbackEventId,
        walletBalance: user.wallet.balance,
        betAmount: amount,
        action,
      });

      await GameTransactionService.processProviderTransaction({
        userId: user.id,
        gameId: game.id,
        roundId: providerTransactionId,
        transactionId: idempotencyKey,
        referenceId: providerTransactionId,
        amount,
        type: transactionType,
        currency: callbackCurrency,
      });

      const updatedWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!updatedWallet) {
        throw new Error('WALLET_NOT_FOUND_AFTER_TRANSACTION');
      }
      console.info('[GC_CALLBACK] Success', { callbackEventId, newBalance: updatedWallet.balance });
      return res.json({ status: 'SUCCESS', balance: Number(updatedWallet.balance) });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '';
      console.error('[GC_CALLBACK] Exception in transaction', { callbackEventId, errorMessage });

      if (errorMessage === 'Insufficient available balance') {
        return res.status(400).json({ status: 'FAILED', error: 'INSUFFICIENT_FUNDS' });
      }
      if (
        errorMessage === 'ORIGINAL_TRANSACTION_NOT_FOUND' ||
        errorMessage === 'REFUND_AMOUNT_EXCEEDS_BET' ||
        errorMessage === 'REFUND_ALREADY_PROCESSED'
      ) {
        return res.status(400).json({ status: 'FAILED', error: errorMessage });
      }
      const errorCode = typeof err === 'object' && err !== null && 'code' in err
        ? err.code
        : undefined;
      if (
        (errorMessage === 'IDEMPOTENCY_CONFLICT' || errorCode === 'P2002') &&
        idempotencyKey &&
        resolvedUserId &&
        callbackAmount !== undefined
      ) {
        const [priorTransaction, currentWallet] = await Promise.all([
          prisma.transaction.findUnique({ where: { idempotencyKey } }),
          prisma.wallet.findUnique({ where: { userId: resolvedUserId } }),
        ]);
        if (priorTransaction && currentWallet) {
          const isSameRequest =
            priorTransaction.walletId === currentWallet.id &&
            priorTransaction.gameId === resolvedGameId &&
            priorTransaction.amount === callbackAmount &&
            priorTransaction.currency.toUpperCase() === String(body?.currency).toUpperCase() &&
            priorTransaction.type === (action === 'bet' ? 'BET' : 'WIN') &&
            priorTransaction.referenceId === providerTransactionId;
          if (isSameRequest) {
            console.info('[GC_CALLBACK] Idempotent Success on retry', { callbackEventId });
            return res.json({ status: 'SUCCESS', balance: Number(currentWallet.balance) });
          }
          console.error('[GC_CALLBACK] Conflict on retry', { callbackEventId });
          return res.status(409).json({ status: 'FAILED', error: 'TRANSACTION_ID_CONFLICT' });
        }
      }

      console.error('GameCloud callback failed:', {
        callbackEventId,
        action,
        playerRef: getPlayerLogId(playerId),
        currency: typeof body?.currency === 'string' ? body.currency : undefined,
        errorName: err instanceof Error ? err.name : 'UnknownError',
        errorCode: typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined,
        errorMessage: err instanceof Error
          ? redactProviderMessage(err.message, [
              process.env.GAMECLOUD_API_TOKEN || '',
              process.env.GAMECLOUD_SECRET_KEY || '',
            ])
          : 'Non-Error exception',
      });
      return res.status(500).json({ status: 'FAILED', error: 'WALLET_TRANSACTION_FAILED' });
    }
  }
}

