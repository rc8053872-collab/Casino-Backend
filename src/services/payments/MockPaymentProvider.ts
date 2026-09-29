import { PaymentProvider, DepositRequest, DepositResponse, WithdrawRequest, WithdrawResponse } from './PaymentProvider';
import { v4 as uuidv4 } from 'uuid';

export class MockPaymentProvider implements PaymentProvider {
  async createDeposit(req: DepositRequest): Promise<DepositResponse> {
    const transactionId = `mock-dep-${uuidv4()}`;
    return {
      paymentUrl: `https://mock-payment-gateway.com/pay/${transactionId}`,
      transactionId,
    };
  }

  async createWithdrawal(req: WithdrawRequest): Promise<WithdrawResponse> {
    const transactionId = `mock-with-${uuidv4()}`;
    // Mock immediate success for testing
    return {
      transactionId,
      status: 'COMPLETED',
    };
  }

  async checkStatus(transactionId: string): Promise<'PENDING' | 'COMPLETED' | 'FAILED'> {
    // In mock, let's just pretend everything completes eventually
    return 'COMPLETED';
  }
}
