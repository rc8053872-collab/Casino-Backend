import prisma from '../../prismaClient';
import { WalletService } from '../WalletService';
import { ProcessTransactionRequest } from '../../providers/game/GameProvider';
import { RoundStatus } from '@prisma/client';

export class GameTransactionService {
  /**
   * Safe transaction processor used by Webhooks and game results.
   * Leverages WalletService for idempotency and atomic updates.
   */
  static async processProviderTransaction(req: ProcessTransactionRequest) {
    const userId = typeof req.userId === 'string' ? req.userId.trim() : '';
    if (!userId) throw new Error('User ID is required');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    if (!user || !user.wallet) throw new Error('User/Wallet not found');
    if (user.wallet.currency.toUpperCase() !== req.currency.toUpperCase()) {
      throw new Error('CURRENCY_MISMATCH');
    }
    const walletId = user.wallet.id;

    if (req.type === 'REFUND') {
      if (!req.referenceId) throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');

      const originalBet = await prisma.transaction.findFirst({
        where: {
          walletId,
          type: 'BET',
          status: 'COMPLETED',
          referenceId: req.referenceId,
        },
      });
      if (!originalBet || !originalBet.gameHistoryId) {
        throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
      }
      if (req.amount > Number(originalBet.amount)) {
        throw new Error('REFUND_AMOUNT_EXCEEDS_BET');
      }

      const originalRound = await prisma.gameHistory.findUnique({
        where: { id: originalBet.gameHistoryId },
      });
      if (!originalRound || originalRound.gameId !== req.gameId) {
        throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
      }

      const walletTx = await WalletService.refund(
        walletId,
        req.amount,
        req.transactionId,
        req.referenceId,
        `Refund for game ${req.gameId}`,
        originalRound.id,
        req.gameId
      );
      await prisma.gameHistory.update({
        where: { id: originalRound.id },
        data: { status: RoundStatus.CANCELLED },
      });
      return walletTx;
    }

    // We must fetch or create a GameHistory round
    let round = await prisma.gameHistory.findFirst({
      where: { roundId: req.roundId, gameId: req.gameId }
    });

    if (!round) {
      round = await prisma.gameHistory.create({
        data: {
          userId,
          gameId: req.gameId,
          roundId: req.roundId,
          betAmount: 0,
          winAmount: 0,
          status: RoundStatus.OPEN,
          providerRef: req.transactionId,
        }
      });
    }

    // Now delegate to WalletService using the provider transaction id as idempotency key
    let walletTx;
    if (req.type === 'BET') {
      walletTx = await WalletService.debitForBet(
        walletId,
        req.amount,
        req.transactionId,
        round.id,
        `Bet for game ${req.gameId}`,
        req.gameId,
        req.referenceId
      );
      
      // Update round info
      await prisma.gameHistory.update({
        where: { id: round.id },
        data: { betAmount: { increment: req.amount } }
      });
      
    } else if (req.type === 'WIN') {
      walletTx = await WalletService.creditWin(walletId, req.amount, req.transactionId, round.id, `Win for game ${req.gameId}`);
      
      // Close round and update win amount
      await prisma.gameHistory.update({
        where: { id: round.id },
        data: { winAmount: { increment: req.amount }, status: RoundStatus.RESOLVED }
      });

    }

    return walletTx;
  }
}
