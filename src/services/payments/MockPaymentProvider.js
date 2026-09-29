"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPaymentProvider = void 0;
const uuid_1 = require("uuid");
class MockPaymentProvider {
    async createDeposit(req) {
        const transactionId = `mock-dep-${(0, uuid_1.v4)()}`;
        return {
            paymentUrl: `https://mock-payment-gateway.com/pay/${transactionId}`,
            transactionId,
        };
    }
    async createWithdrawal(req) {
        const transactionId = `mock-with-${(0, uuid_1.v4)()}`;
        // Mock immediate success for testing
        return {
            transactionId,
            status: 'COMPLETED',
        };
    }
    async checkStatus(transactionId) {
        // In mock, let's just pretend everything completes eventually
        return 'COMPLETED';
    }
}
exports.MockPaymentProvider = MockPaymentProvider;
//# sourceMappingURL=MockPaymentProvider.js.map