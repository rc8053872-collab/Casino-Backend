import { PrismaClient, TxType, TxStatus, Prisma } from '@prisma/client';
import prisma from '../prismaClient';

export class WalletService {
  /**
   * Helper to execute wallet operations securely within a transaction
   */
  private static async executeTransaction(
    walletId: string,
    amount: Prisma.Decimal | number | string,
    type: TxType,
    idempotencyKey: string,
    operation: (tx: Prisma.TransactionClient, wallet: any) => Promise<any>,
    description?: string,
    metadata?: any,
    referenceId?: string,
    gameHistoryId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Check idempotency
      const existingTx = await tx.transaction.findUnique({
        where: { idempotencyKey },
      });

      if (existingTx) {
        return existingTx; // Already processed
      }

      // 2. Lock the wallet row to prevent concurrent race conditions
      // In PostgreSQL, this requires raw query or relying on Serializable isolation.
      // Prisma doesn't support SELECT ... FOR UPDATE natively without $queryRaw yet.
      // We will do a raw query to lock the row.
      const lockedWallet = await tx.$queryRaw<any[]>`
        SELECT * FROM "Wallet" WHERE id = ${walletId} FOR UPDATE;
      `;

      if (!lockedWallet || lockedWallet.length === 0) {
        throw new Error('Wallet not found');
      }

      const wallet = lockedWallet[0];

      // 3. Execute the operation (deduct/add balance)
      const { newBalance, newLockedBalance } = await operation(tx, wallet);

      if (Number(newBalance) < 0) {
        throw new Error('Insufficient available balance');
      }

      if (Number(newLockedBalance) < 0) {
        throw new Error('Insufficient locked balance');
      }

      // 4. Update wallet
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: newBalance,
          lockedBalance: newLockedBalance,
        },
      });

      // 5. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          amount,
          type,
          status: TxStatus.COMPLETED,
          idempotencyKey,
          referenceId: referenceId || null,
          gameHistoryId: gameHistoryId || null,
          description: description || null,
          metadata: metadata || Prisma.JsonNull,
        },
      });

      return transaction;
    });
  }

  static async deposit(walletId: string, amount: number, idempotencyKey: string, referenceId?: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.DEPOSIT, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) + amount,
        newLockedBalance: wallet.lockedBalance
      };
    }, description, undefined, referenceId);
  }

  static async withdraw(walletId: string, amount: number, idempotencyKey: string, referenceId?: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.WITHDRAWAL, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) - amount,
        newLockedBalance: wallet.lockedBalance
      };
    }, description, undefined, referenceId);
  }

  static async debitForBet(walletId: string, amount: number, idempotencyKey: string, gameHistoryId: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.BET, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) - amount,
        newLockedBalance: wallet.lockedBalance
      };
    }, description, undefined, undefined, gameHistoryId);
  }

  static async creditWin(walletId: string, amount: number, idempotencyKey: string, gameHistoryId: string, description?: string) {
    if (amount < 0) throw new Error('Amount cannot be negative'); // win can be 0
    return this.executeTransaction(walletId, amount, TxType.WIN, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) + amount,
        newLockedBalance: wallet.lockedBalance
      };
    }, description, undefined, undefined, gameHistoryId);
  }

  static async refund(walletId: string, amount: number, idempotencyKey: string, originalTxRef?: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.REFUND, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) + amount,
        newLockedBalance: wallet.lockedBalance
      };
    }, description, undefined, originalTxRef);
  }

  static async lockFunds(walletId: string, amount: number, idempotencyKey: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.ADJUSTMENT, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) - amount,
        newLockedBalance: Number(wallet.lockedBalance) + amount
      };
    }, description || 'Lock funds');
  }

  static async releaseFunds(walletId: string, amount: number, idempotencyKey: string, description?: string) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return this.executeTransaction(walletId, amount, TxType.ADJUSTMENT, idempotencyKey, async (tx, wallet) => {
      return {
        newBalance: Number(wallet.balance) + amount,
        newLockedBalance: Number(wallet.lockedBalance) - amount
      };
    }, description || 'Release locked funds');
  }

  static async getBalance(walletId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });
    if (!wallet) throw new Error('Wallet not found');
    return wallet;
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
