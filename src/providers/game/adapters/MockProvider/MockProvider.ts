import { GameProvider, LaunchGameRequest, LaunchGameResponse, WebhookPayload } from '../../GameProvider';
import { v4 as uuidv4 } from 'uuid';

export class MockProvider implements GameProvider {
  getProviderId(): string {
    return 'MOCK_PROVIDER';
  }

  async launchGame(req: LaunchGameRequest): Promise<LaunchGameResponse> {
    // Generate a mock game session URL
    const sessionToken = uuidv4();
    return {
      gameUrl: `https://mock-games.com/play/${req.gameId}?session=${sessionToken}`,
      sessionToken,
    };
  }

  async getGameStatus(gameId: string): Promise<boolean> {
    return true;
  }

  async verifyWebhook(payload: WebhookPayload): Promise<boolean> {
    // In a real provider, you would check headers against a secret hash
    // Example: payload.headers['x-mock-signature'] === hash(payload.rawBody, SECRET)
    return true; // Trust in mock
  }

  async reconcileTransaction(transactionId: string): Promise<{ status: "COMPLETED" | "PENDING" | "FAILED" | "NOT_FOUND" }> {
    return { status: 'COMPLETED' };
  }
}
