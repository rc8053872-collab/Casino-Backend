"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameWebhookService = void 0;
const GameProviderManager_1 = require("../../providers/game/GameProviderManager");
const GameTransactionService_1 = require("./GameTransactionService");
class GameWebhookService {
    /**
     * General handler for provider webhooks.
     * Example: A provider calls POST /api/webhooks/games/MOCK_PROVIDER
     */
    static async handleWebhook(providerId, payload) {
        const provider = GameProviderManager_1.GameProviderManager.getProvider(providerId);
        // 1. Verify Signature
        if (provider.verifyWebhook) {
            const isValid = await provider.verifyWebhook(payload);
            if (!isValid)
                throw new Error('Webhook signature verification failed');
        }
        // 2. Parse the body
        const body = payload.parsedBody;
        // Assume provider payload sends standard transaction data
        // In a real adapter, you would map the specific provider's payload structure to ProcessTransactionRequest
        // Here we just simulate passing it down directly.
        const transactionId = body.transactionId;
        // Handle Idempotency at the adapter/webhook level if needed
        // 3. Process Transaction
        const result = await GameTransactionService_1.GameTransactionService.processProviderTransaction({
            userId: body.userId,
            gameId: body.gameId,
            roundId: body.roundId,
            transactionId: transactionId,
            amount: Number(body.amount),
            type: body.type, // 'BET' | 'WIN' | 'REFUND'
            currency: body.currency,
        });
        return result;
    }
}
exports.GameWebhookService = GameWebhookService;
//# sourceMappingURL=GameWebhookService.js.map