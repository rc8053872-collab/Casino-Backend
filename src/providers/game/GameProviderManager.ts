import { GameProvider } from './GameProvider';

export class GameProviderManager {
  private static providers: Map<string, GameProvider> = new Map();

  /** Register a new provider adapter */
  static registerProvider(provider: GameProvider) {
    this.providers.set(provider.getProviderId(), provider);
  }

  /** Get a provider adapter by ID */
  static getProvider(providerId: string): GameProvider {
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
