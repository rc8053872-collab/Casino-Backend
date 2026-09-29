import prisma from '../../prismaClient';
import { GameProviderManager } from '../../providers/game/GameProviderManager';
import { v4 as uuidv4 } from 'uuid';

export class GameLaunchService {
  /**
   * Validates user and game, then routes to appropriate provider adapter
   */
  static async launchGame(userId: string, gameSlug: string, clientIp: string) {
    // 1. Fetch game details
    const game = await prisma.game.findUnique({
      where: { slug: gameSlug }
    });

    if (!game || game.status !== 'ACTIVE') {
      throw new Error('Game is unavailable');
    }

    // 2. Fetch User & Wallet currency
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    if (!user || !user.wallet) {
      throw new Error('User wallet not found');
    }

    // 3. Delegate launch to the registered provider adapter
    const provider = GameProviderManager.getProvider(game.providerId);
    
    // Check status if supported
    if (provider.getGameStatus) {
      const isAvailable = await provider.getGameStatus(game.id);
      if (!isAvailable) throw new Error('Provider reports game unavailable');
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
