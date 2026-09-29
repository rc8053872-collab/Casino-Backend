"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const client_1 = require("@prisma/client");
const prismaClient_1 = __importDefault(require("../prismaClient"));
class WalletService {
    /**
     * Helper to execute wallet operations securely within a transaction
     */
    static async executeTransaction(walletId, amount, type, idempotencyKey, operation, description, metadata, referenceId, gameHistoryId) {
        return prismaClient_1.default.$transaction(async (tx) => {
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
            const lockedWallet = await tx.$queryRaw `
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
                    status: client_1.TxStatus.COMPLETED,
                    idempotencyKey,
                    referenceId: referenceId || null,
                    gameHistoryId: gameHistoryId || null,
                    description: description || null,
                    metadata: metadata || client_1.Prisma.JsonNull,
                },
            });
            return transaction;
        });
    }
    static async deposit(walletId, amount, idempotencyKey, referenceId, description) {
        if (amount <= 0)
            throw new Error('Amount must be positive');
        return this.executeTransaction(walletId, amount, client_1.TxType.DEPOSIT, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) + amount,
                newLockedBalance: wallet.lockedBalance
            };
        }, description, undefined, referenceId);
    }
    static async withdraw(walletId, amount, idempotencyKey, referenceId, description) {
        if (amount <= 0)
            throw new Error('Amount must be positive');
        return this.executeTransaction(walletId, amount, client_1.TxType.WITHDRAWAL, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) - amount,
                newLockedBalance: wallet.lockedBalance
            };
        }, description, undefined, referenceId);
    }
    static async debitForBet(walletId, amount, idempotencyKey, gameHistoryId, description) {
        if (amount <= 0)
            throw new Error('Amount must be positive');
        return this.executeTransaction(walletId, amount, client_1.TxType.BET, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) - amount,
                newLockedBalance: wallet.lockedBalance
            };
        }, description, undefined, undefined, gameHistoryId);
    }
    static async creditWin(walletId, amount, idempotencyKey, gameHistoryId, description) {
        if (amount < 0)
            throw new Error('Amount cannot be negative'); // win can be 0
        return this.executeTransaction(walletId, amount, client_1.TxType.WIN, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) + amount,
                newLockedBalance: wallet.lockedBalance
            };
        }, description, undefined, undefined, gameHistoryId);
    }
    static async refund(walletId, amount, idempotencyKey, originalTxRef, description) {
        if (amount <= 0)
            throw new Error('Amount must be positive');
        return this.executeTransaction(walletId, amount, client_1.TxType.REFUND, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) + amount,
                newLockedBalance: wallet.lockedBalance
            };
        }, description, undefined, originalTxRef);
    }
    static async lockFunds(walletId, amount, idempotencyKey, description) {
        if (amount <= 0)
            throw new Error('Amount must be positive');
        return this.executeTransaction(walletId, amount, client_1.TxType.ADJUSTMENT, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) - amount,
                newLockedBalance: Number(wallet.lockedBalance) + amount
            };
        }, description || 'Lock funds');
    }
    static async releaseFunds(walletId, amount, idempotencyKey, description) {
        if (amount <= 0)
            throw new Error('Amount must be positive');
        return this.executeTransaction(walletId, amount, client_1.TxType.ADJUSTMENT, idempotencyKey, async (tx, wallet) => {
            return {
                newBalance: Number(wallet.balance) + amount,
                newLockedBalance: Number(wallet.lockedBalance) - amount
            };
        }, description || 'Release locked funds');
    }
    static async getBalance(walletId) {
        const wallet = await prismaClient_1.default.wallet.findUnique({
            where: { id: walletId }
        });
        if (!wallet)
            throw new Error('Wallet not found');
        return wallet;
    }
    static async getTransactions(walletId, limit = 50, offset = 0) {
        return prismaClient_1.default.transaction.findMany({
            where: { walletId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=WalletService.js.map