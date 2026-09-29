import { GameProvider, LaunchGameRequest, LaunchGameResponse, WebhookPayload } from '../../GameProvider';
export declare class MockProvider implements GameProvider {
    getProviderId(): string;
    launchGame(req: LaunchGameRequest): Promise<LaunchGameResponse>;
    getGameStatus(gameId: string): Promise<boolean>;
    verifyWebhook(payload: WebhookPayload): Promise<boolean>;
    reconcileTransaction(transactionId: string): Promise<{
        status: "COMPLETED" | "PENDING" | "FAILED" | "NOT_FOUND";
    }>;
}
//# sourceMappingURL=MockProvider.d.ts.map