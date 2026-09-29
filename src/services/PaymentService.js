"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const MockPaymentProvider_1 = require("./payments/MockPaymentProvider");
const WalletService_1 = require("./WalletService");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class PaymentService {
    provider;
    constructor(providerName = 'mock') {
        // In future, dynamically load the correct provider based on configuration
        if (providerName === 'mock') {
            this.provider = new MockPaymentProvider_1.MockPaymentProvider();
        }
        else {
            throw new Error(`Payment provider ${providerName} not found`);
        }
    }
    async initiateDeposit(walletId, amount) {
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
    async handleDepositSuccess(walletId, amount, providerTxId) {
        logger_1.logger.info(`Processing deposit success webhook for tx: ${providerTxId}`);
        // Use providerTxId as idempotencyKey to prevent duplicate webhook processing
        return WalletService_1.WalletService.deposit(walletId, amount, providerTxId, providerTxId, 'Deposit via Payment Gateway');
    }
    async requestWithdrawal(walletId, amount, destinationAccount) {
        // 1. Lock funds locally first
        const lockIdempotency = `lock-with-${(0, uuid_1.v4)()}`;
        await WalletService_1.WalletService.lockFunds(walletId, amount, lockIdempotency, 'Lock funds for withdrawal');
        try {
            // 2. Request withdrawal from provider
            const response = await this.provider.createWithdrawal({
                walletId,
                amount,
                currency: 'USD',
                destinationAccount
            });
            // 3. If immediate success, finalize withdrawal
            if (response.status === 'COMPLETED') {
                const withIdempotency = `with-${response.transactionId}`;
                // Release the lock
                await WalletService_1.WalletService.releaseFunds(walletId, amount, `release-${lockIdempotency}`, 'Release for completed withdrawal');
                // Actually withdraw
                await WalletService_1.WalletService.withdraw(walletId, amount, withIdempotency, response.transactionId, 'Withdrawal processed successfully');
            }
            return response;
        }
        catch (error) {
            logger_1.logger.error('Withdrawal failed at provider', error);
            // Release locked funds back to user balance on failure
            await WalletService_1.WalletService.releaseFunds(walletId, amount, `release-fail-${lockIdempotency}`, 'Withdrawal failed, releasing funds');
            throw error;
        }
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=PaymentService.js.map