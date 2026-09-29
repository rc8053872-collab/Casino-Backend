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
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallet: true }
    });

    if (!user || !user.wallet) throw new Error('User/Wallet not found');
    const walletId = user.wallet.id;

    // We must fetch or create a GameHistory round
    let round = await prisma.gameHistory.findFirst({
      where: { roundId: req.roundId, gameId: req.gameId }
    });

    if (!round) {
      round = await prisma.gameHistory.create({
        data: {
          userId: req.userId,
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
      walletTx = await WalletService.debitForBet(walletId, req.amount, req.transactionId, round.id, `Bet for game ${req.gameId}`);
      
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

    } else if (req.type === 'REFUND') {
      walletTx = await WalletService.refund(walletId, req.amount, req.transactionId, req.transactionId, `Refund for game ${req.gameId}`);
      
      await prisma.gameHistory.update({
        where: { id: round.id },
        data: { status: RoundStatus.CANCELLED }
      });
    }

    return walletTx;
  }
}
