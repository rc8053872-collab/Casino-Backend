export interface LaunchGameRequest {
  userId: string;
  gameId: string;
  currency: string;
  clientIp: string;
  language?: string;
  returnUrl?: string;
}

export interface LaunchGameResponse {
  gameUrl: string;
  sessionToken: string;
}

export interface ProcessTransactionRequest {
  userId: string;
  gameId: string;
  roundId: string;
  transactionId: string; // Provider's unique tx id
  amount: number;
  type: 'BET' | 'WIN' | 'REFUND';
  currency: string;
  metadata?: any;
}

export interface WebhookPayload {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  parsedBody?: any;
}

export interface GameProvider {
  /** Unique identifier for the provider (e.g., 'EVOLUTION', 'MOCK') */
  getProviderId(): string;
  
  initialize?(): Promise<void>;
  
  /** Return true if game can be launched */
  getGameStatus?(gameId: string): Promise<boolean>;
  
  /** Launch a game session */
  launchGame(req: LaunchGameRequest): Promise<LaunchGameResponse>;
  
  /** Verify webhook signature/authenticity */
  verifyWebhook?(payload: WebhookPayload): Promise<boolean>;
  
  /** Fetch the authoritative status of a round/transaction from provider */
  reconcileTransaction?(transactionId: string): Promise<{status: 'COMPLETED'|'PENDING'|'FAILED'|'NOT_FOUND'}>;
}
