export declare class GameLaunchService {
    /**
     * Validates user and game, then routes to appropriate provider adapter
     */
    static launchGame(userId: string, gameSlug: string, clientIp: string): Promise<{
        gameUrl: string;
        token: string;
        gameDetails: {
            id: string;
            slug: string;
            name: string;
            category: string;
            providerId: string;
            thumbnail: string | null;
            status: import(".prisma/client").$Enums.Status;
            minBet: import("@prisma/client-runtime-utils").Decimal | null;
            maxBet: import("@prisma/client-runtime-utils").Decimal | null;
            displayOrder: number;
        };
    }>;
}
//# sourceMappingURL=GameLaunchService.d.ts.map