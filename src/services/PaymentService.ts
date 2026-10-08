import { PaymentProvider } from './payments/PaymentProvider';
import { MockPaymentProvider } from './payments/MockPaymentProvider';
import { WalletService } from './WalletService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export class PaymentService {
  private provider: PaymentProvider;

  constructor(providerName: string = 'mock') {
    // In future, dynamically load the correct provider based on configuration
    if (providerName === 'mock') {
      this.provider = new MockPaymentProvider();
    } else {
      throw new Error(`Payment provider ${providerName} not found`);
    }
  }

  async initiateDeposit(walletId: string, amount: number) {
    const response = await this.provider.createDeposit({
      walletId,
      amount,
      currency: 'USD',
      callbackUrl: `${process.env.APP_URL || 'http://localhost:3001'}/api/webhooks/payments/mock`
    });

    // In a real system, you would store a "Pending Deposit" record here to map the response.transactionId to the user.
    return response;
  }

  // Called via Webhook from the payment gateway
  async handleDepositSuccess(walletId: string, amount: number, providerTxId: string) {
    logger.info(`Processing deposit success webhook for tx: ${providerTxId}`);
    // Use providerTxId as idempotencyKey to prevent duplicate webhook processing
    return WalletService.deposit(walletId, amount, providerTxId, providerTxId, 'Deposit via Payment Gateway');
  }

  async requestWithdrawal(walletId: string, totalAmount: number, netAmount: number, destinationAccount: string, feeAmount: number = 0) {
    // 1. Lock funds locally first
    const lockIdempotency = `lock-with-${uuidv4()}`;
    await WalletService.lockFunds(walletId, totalAmount, lockIdempotency, `Lock funds for withdrawal (Fee: ${feeAmount})`);

    try {
      // 2. Request withdrawal from provider
      const response = await this.provider.createWithdrawal({
        walletId,
        amount: netAmount,
        currency: 'INR',
        destinationAccount
      });

      // 3. If immediate success, finalize withdrawal
      if (response.status === 'COMPLETED') {
        const withIdempotency = `with-${response.transactionId}`;
        // Release the lock
        await WalletService.releaseFunds(walletId, totalAmount, `release-${lockIdempotency}`, 'Release for completed withdrawal');
        // Actually withdraw
        await WalletService.withdraw(walletId, totalAmount, withIdempotency, response.transactionId, `Withdrawal processed successfully. Fee deducted: ${feeAmount}`);
      }
      
      return response;
    } catch (error) {
      logger.error('Withdrawal failed at provider', error);
      // Release locked funds back to user balance on failure
      await WalletService.releaseFunds(walletId, totalAmount, `release-fail-${lockIdempotency}`, 'Withdrawal failed, releasing funds');
      throw error;
    }
  }
}
