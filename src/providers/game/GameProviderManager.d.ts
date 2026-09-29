import { GameProvider } from './GameProvider';
export declare class GameProviderManager {
    private static providers;
    /** Register a new provider adapter */
    static registerProvider(provider: GameProvider): void;
    /** Get a provider adapter by ID */
    static getProvider(providerId: string): GameProvider;
    /** Initialize all registered providers */
    static initializeAll(): Promise<void>;
}
//# sourceMappingURL=GameProviderManager.d.ts.map