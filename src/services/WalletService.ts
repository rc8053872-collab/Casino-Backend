import { PrismaClient, TxType, TxStatus, Prisma } from '@prisma/client';
import prisma from '../prismaClient';

export class WalletService {
  /**
   * Helper to execute wallet operations securely within a transaction
   */
  private static async executeTransaction(
    walletId: string,
    amount: number,
    type: TxType,
    idempotencyKey: string,
    operation: (tx: any, wallet: any) => Promise<any>,
    description?: string,
    metadata?: any,
    referenceId?: string,
    gameHistoryId?: string,
    gameId?: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      // 1. Check idempotency
      const existingTx = await tx.transaction.findUnique({
        where: { idempotencyKey },
      });

      if (existingTx) {
        throw new Error('IDEMPOTENCY_CONFLICT'); 
      }

      // 2. Lock the wallet row to prevent concurrent race conditions
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = Number(wallet.balance);
      let balanceAfter = balanceBefore;

      // 3. Update wallet atomically
      let updateData: any = {};
      if (type === TxType.BET || type === TxType.WITHDRAWAL) {
        if (balanceBefore < amount) {
          throw new Error('Insufficient available balance');
        }
        updateData.balance = { decrement: amount };
        balanceAfter = balanceBefore - amount;
        
        if (type === TxType.BET) updateData.totalLost = { increment: amount }; // Note: bet is treated as spent/lost until won
        if (type === TxType.WITHDRAWAL) updateData.totalWithdrawn = { increment: amount };
      } else if (type === TxType.WIN || type === TxType.DEPOSIT || type === TxType.REFUND || type === TxType.BONUS) {
        updateData.balance = { increment: amount };
        balanceAfter = balanceBefore + amount;
        
        if (type === TxType.WIN) updateData.totalWon = { increment: amount };
        if (type === TxType.DEPOSIT) updateData.totalDeposited = { increment: amount };
      } else if (type === TxType.ADJUSTMENT) {
        // Handled via specific operation or skipped here if lockFunds is used
        // for now lockFunds/releaseFunds don't change actual 'balance' if they only touch lockedBalance
      } else {
        throw new Error('Unsupported transaction type');
      }

      // If it's an adjustment, we might need custom handling, but for now we follow the existing pattern
      // Wait, original code for adjustments was in operation(). But original code updated balance directly in executeTransaction except for lock/release!
      // Let's rely on the passed operation if we need custom logic, but actually the original code hardcoded balance updates.
      // Wait, original code:
      // if (type === TxType.BET || type === TxType.WITHDRAWAL) { ... decrement ... }
      // else if (type === TxType.WIN || type === TxType.DEPOSIT || type === TxType.REFUND) { ... increment ... }
      // Let's keep it safe. If it's an ADJUSTMENT, we don't automatically increment/decrement here unless specified.

      let updatedWallet = wallet;
      if (Object.keys(updateData).length > 0) {
        updatedWallet = await tx.wallet.update({
          where: { id: walletId },
          data: updateData,
        });
      }

      // Allow operation to do custom things (like lockedBalance updates)
      if (operation) {
         await operation(tx, updatedWallet);
      }

      // 4. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          amount,
          type,
          status: TxStatus.COMPLETED,
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          idempotencyKey,
          referenceId: referenceId || null,
          gameHistoryId: gameHistoryId || null,
          gameId: gameId || null,
          description: description || null,
          metadata: metadata || null,
        },
      });

      return transaction;
    });
  }

  static async deposit(walletId: string, amount: number, idempotencyKey: string, referenceId?: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.DEPOSIT, idempotencyKey, async () => {}, description, undefined, referenceId);
  }

  static async withdraw(walletId: string, amount: number, idempotencyKey: string, referenceId?: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.WITHDRAWAL, idempotencyKey, async () => {}, description, undefined, referenceId);
  }

  static async debitForBet(walletId: string, amount: number, idempotencyKey: string, gameHistoryId: string, description?: string, gameId?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.BET, idempotencyKey, async () => {}, description, undefined, undefined, gameHistoryId, gameId);
  }

  static async creditWin(walletId: string, amount: number, idempotencyKey: string, gameHistoryId: string, description?: string, gameId?: string) {
    if (amount < 0) throw new Error('Amount cannot be negative'); // win can be 0
    return this.executeTransaction(walletId, amount, TxType.WIN, idempotencyKey, async () => {}, description, undefined, undefined, gameHistoryId, gameId);
  }

  static async refund(walletId: string, amount: number, idempotencyKey: string, originalTxRef?: string, description?: string, gameHistoryId?: string, gameId?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.REFUND, idempotencyKey, async () => {}, description, undefined, originalTxRef, gameHistoryId, gameId);
  }

  static async lockFunds(walletId: string, amount: number, idempotencyKey: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.ADJUSTMENT, idempotencyKey, async (tx, wallet) => {
       if (wallet.balance < amount) throw new Error('Insufficient available balance to lock');
       await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: amount }, lockedBalance: { increment: amount } }
       });
    }, description || 'Lock funds');
  }

  static async releaseFunds(walletId: string, amount: number, idempotencyKey: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.ADJUSTMENT, idempotencyKey, async (tx, wallet) => {
       if (wallet.lockedBalance < amount) throw new Error('Insufficient locked balance to release');
       await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: amount }, lockedBalance: { decrement: amount } }
       });
    }, description || 'Release locked funds');
  }

  static async getBalance(walletId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });
    if (!wallet) throw new Error('Wallet not found');
    return wallet;
  }

  static async getOrCreateForUser(userId: string) {
    return prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0, currency: 'INR' },
      update: {}
    });
  }

  static async getTransactions(walletId: string, limit = 50, offset = 0) {
    return prisma.transaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }
}
