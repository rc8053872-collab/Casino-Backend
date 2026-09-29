"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLaunchService = void 0;
const prismaClient_1 = __importDefault(require("../../prismaClient"));
const GameProviderManager_1 = require("../../providers/game/GameProviderManager");
class GameLaunchService {
    /**
     * Validates user and game, then routes to appropriate provider adapter
     */
    static async launchGame(userId, gameSlug, clientIp) {
        // 1. Fetch game details
        const game = await prismaClient_1.default.game.findUnique({
            where: { slug: gameSlug }
        });
        if (!game || game.status !== 'ACTIVE') {
            throw new Error('Game is unavailable');
        }
        // 2. Fetch User & Wallet currency
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            include: { wallet: true }
        });
        if (!user || !user.wallet) {
            throw new Error('User wallet not found');
        }
        // 3. Delegate launch to the registered provider adapter
        const provider = GameProviderManager_1.GameProviderManager.getProvider(game.providerId);
        // Check status if supported
        if (provider.getGameStatus) {
            const isAvailable = await provider.getGameStatus(game.id);
            if (!isAvailable)
                throw new Error('Provider reports game unavailable');
        }
        const launchResponse = await provider.launchGame({
            userId,
            gameId: game.id,
            currency: user.wallet.currency,
            clientIp
        });
        // We can also store session tokens in a cache if needed.
        return {
            gameUrl: launchResponse.gameUrl,
            token: launchResponse.sessionToken,
            gameDetails: game
        };
    }
}
exports.GameLaunchService = GameLaunchService;
//# sourceMappingURL=GameLaunchService.js.map