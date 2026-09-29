"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameProviderManager = void 0;
class GameProviderManager {
    static providers = new Map();
    /** Register a new provider adapter */
    static registerProvider(provider) {
        this.providers.set(provider.getProviderId(), provider);
    }
    /** Get a provider adapter by ID */
    static getProvider(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`GameProvider with ID '${providerId}' is not registered`);
        }
        return provider;
    }
    /** Initialize all registered providers */
    static async initializeAll() {
        for (const provider of this.providers.values()) {
            if (provider.initialize) {
                await provider.initialize();
            }
        }
    }
}
exports.GameProviderManager = GameProviderManager;
//# sourceMappingURL=GameProviderManager.js.map