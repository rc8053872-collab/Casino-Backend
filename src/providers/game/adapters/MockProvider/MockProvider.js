"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockProvider = void 0;
const uuid_1 = require("uuid");
class MockProvider {
    getProviderId() {
        return 'MOCK_PROVIDER';
    }
    async launchGame(req) {
        // Generate a mock game session URL
        const sessionToken = (0, uuid_1.v4)();
        return {
            gameUrl: `https://mock-games.com/play/${req.gameId}?session=${sessionToken}`,
            sessionToken,
        };
    }
    async getGameStatus(gameId) {
        return true;
    }
    async verifyWebhook(payload) {
        // In a real provider, you would check headers against a secret hash
        // Example: payload.headers['x-mock-signature'] === hash(payload.rawBody, SECRET)
        return true; // Trust in mock
    }
    async reconcileTransaction(transactionId) {
        return { status: 'COMPLETED' };
    }
}
exports.MockProvider = MockProvider;
//# sourceMappingURL=MockProvider.js.map