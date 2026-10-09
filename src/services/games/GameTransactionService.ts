import { RoundStatus, TxStatus, TxType } from '@prisma/client';
import prisma from '../../prismaClient';
import { ProcessTransactionRequest } from '../../providers/game/GameProvider';

export class GameTransactionService {
  static async processProviderTransaction(req: ProcessTransactionRequest) {
    const userId = typeof req.userId === 'string' ? req.userId.trim() : '';
    const transactionId = typeof req.transactionId === 'string' ? req.transactionId.trim() : '';
    if (!userId) throw new Error('User ID is required');
    if (!transactionId) throw new Error('Provider transaction ID is required');
    if (!Number.isFinite(req.amount) || req.amount < 0) {
      throw new Error('Invalid transaction amount');
    }
    if (req.type !== 'WIN' && req.amount === 0) {
      throw new Error('Amount must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });
      if (!user || !user.wallet) throw new Error('User/Wallet not found');

      const wallet = user.wallet;
      if (wallet.currency.toUpperCase() !== req.currency.trim().toUpperCase()) {
        throw new Error('CURRENCY_MISMATCH');
      }

      const type = req.type as TxType;
      const existingTransaction = await tx.transaction.findUnique({
        where: { idempotencyKey: transactionId },
      });
      if (existingTransaction) {
        const matches =
          existingTransaction.walletId === wallet.id &&
          existingTransaction.gameId === req.gameId &&
          existingTransaction.type === type &&
          existingTransaction.amount === req.amount &&
          existingTransaction.currency.toUpperCase() === req.currency.toUpperCase() &&
          existingTransaction.referenceId === (req.referenceId || null);
        if (!matches) throw new Error('TRANSACTION_ID_CONFLICT');
        return existingTransaction;
      }

      let round;
      if (type === TxType.REFUND) {
        if (!req.referenceId) throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
        const originalBet = await tx.transaction.findFirst({
          where: {
            walletId: wallet.id,
            type: TxType.BET,
            status: TxStatus.COMPLETED,
            referenceId: req.referenceId,
          },
        });
        if (!originalBet || !originalBet.gameHistoryId) {
          throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
        }
        if (req.amount > Number(originalBet.amount)) {
          throw new Error('REFUND_AMOUNT_EXCEEDS_BET');
        }
        const priorRefund = await tx.transaction.findFirst({
          where: {
            walletId: wallet.id,
            type: TxType.REFUND,
            status: TxStatus.COMPLETED,
            referenceId: req.referenceId,
          },
        });
        if (priorRefund) throw new Error('REFUND_ALREADY_PROCESSED');
        round = await tx.gameHistory.findUnique({
          where: { id: originalBet.gameHistoryId },
        });
        if (!round || round.userId !== userId || round.gameId !== req.gameId) {
          throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
        }
      } else {
        round = await tx.gameHistory.findFirst({
          where: { roundId: req.roundId, gameId: req.gameId, userId },
        });
        if (!round) {
          round = await tx.gameHistory.create({
            data: {
              userId,
              gameId: req.gameId,
              roundId: req.roundId,
              betAmount: 0,
              winAmount: 0,
              status: RoundStatus.OPEN,
              providerRef: transactionId,
            },
          });
        }
      }

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = Math.round(
        (type === TxType.BET ? balanceBefore - req.amount : balanceBefore + req.amount) * 100
      ) / 100;
      const walletUpdate = type === TxType.BET
        ? await tx.wallet.updateMany({
            where: {
              id: wallet.id,
              currency: wallet.currency,
              balance: { gte: req.amount },
            },
            data: {
              balance: { decrement: req.amount },
              totalLost: { increment: req.amount },
            },
          })
        : await tx.wallet.updateMany({
            where: { id: wallet.id, currency: wallet.currency },
            data: {
              balance: { increment: req.amount },
              ...(type === TxType.WIN ? { totalWon: { increment: req.amount } } : {}),
            },
          });

      if (walletUpdate.count !== 1) {
        if (type === TxType.BET) throw new Error('Insufficient available balance');
        throw new Error('Wallet update failed');
      }

      const walletTransaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: req.amount,
          type,
          status: TxStatus.COMPLETED,
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          idempotencyKey: transactionId,
          referenceId: req.referenceId || null,
          gameHistoryId: round.id,
          gameId: req.gameId,
          description: `${req.type} for game ${req.gameId}`,
          metadata: req.metadata || undefined,
        },
      });

      await tx.gameHistory.update({
        where: { id: round.id },
        data: type === TxType.BET
          ? { betAmount: { increment: req.amount } }
          : type === TxType.WIN
            ? { winAmount: { increment: req.amount }, status: RoundStatus.RESOLVED }
            : { status: RoundStatus.CANCELLED },
      });

      return walletTransaction;
    });
  }
}
