import { WebhookPayload } from '../../providers/game/GameProvider';
export declare class GameWebhookService {
    /**
     * General handler for provider webhooks.
     * Example: A provider calls POST /api/webhooks/games/MOCK_PROVIDER
     */
    static handleWebhook(providerId: string, payload: WebhookPayload): Promise<{
        id: string;
        walletId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        type: import(".prisma/client").$Enums.TxType;
        status: import(".prisma/client").$Enums.TxStatus;
        referenceId: string | null;
        idempotencyKey: string;
        gameHistoryId: string | null;
        description: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        createdAt: Date;
    } | undefined>;
}
//# sourceMappingURL=GameWebhookService.d.ts.map