import { Prisma } from '@prisma/client';
export declare class WalletService {
    /**
     * Helper to execute wallet operations securely within a transaction
     */
    private static executeTransaction;
    static deposit(walletId: string, amount: number, idempotencyKey: string, referenceId?: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static withdraw(walletId: string, amount: number, idempotencyKey: string, referenceId?: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static debitForBet(walletId: string, amount: number, idempotencyKey: string, gameHistoryId: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static creditWin(walletId: string, amount: number, idempotencyKey: string, gameHistoryId: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static refund(walletId: string, amount: number, idempotencyKey: string, originalTxRef?: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static lockFunds(walletId: string, amount: number, idempotencyKey: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static releaseFunds(walletId: string, amount: number, idempotencyKey: string, description?: string): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }>;
    static getBalance(walletId: string): Promise<{
        id: string;
        userId: string;
        balance: Prisma.Decimal;
        lockedBalance: Prisma.Decimal;
        currency: string;
        status: import(".prisma/client").$Enums.Status;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static getTransactions(walletId: string, limit?: number, offset?: number): Promise<{
        id: string;
        walletId: string;
        amount: Prisma.Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
    }[]>;
}
//# sourceMappingURL=WalletService.d.ts.map