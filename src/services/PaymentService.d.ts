export declare class PaymentService {
    private provider;
    constructor(providerName?: string);
    initiateDeposit(walletId: string, amount: number): Promise<import("./payments/PaymentProvider").DepositResponse>;
    handleDepositSuccess(walletId: string, amount: number, providerTxId: string): Promise<{
        id: string;
        walletId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        createdAt: Date;
    }>;
    requestWithdrawal(walletId: string, amount: number, destinationAccount: string): Promise<import("./payments/PaymentProvider").WithdrawResponse>;
}
//# sourceMappingURL=PaymentService.d.ts.map