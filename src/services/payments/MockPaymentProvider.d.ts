import { PaymentProvider, DepositRequest, DepositResponse, WithdrawRequest, WithdrawResponse } from './PaymentProvider';
export declare class MockPaymentProvider implements PaymentProvider {
    createDeposit(req: DepositRequest): Promise<DepositResponse>;
    createWithdrawal(req: WithdrawRequest): Promise<WithdrawResponse>;
    checkStatus(transactionId: string): Promise<'PENDING' | 'COMPLETED' | 'FAILED'>;
}
//# sourceMappingURL=MockPaymentProvider.d.ts.map