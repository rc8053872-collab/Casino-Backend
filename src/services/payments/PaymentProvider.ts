export interface DepositRequest {
  walletId: string;
  amount: number;
  currency: string;
  callbackUrl: string;
}

export interface DepositResponse {
  paymentUrl: string;
  transactionId: string; // Provider's transaction ID
}

export interface WithdrawRequest {
  walletId: string;
  amount: number;
  currency: string;
  destinationAccount: string;
}

export interface WithdrawResponse {
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export interface PaymentProvider {
  createDeposit(req: DepositRequest): Promise<DepositResponse>;
  createWithdrawal(req: WithdrawRequest): Promise<WithdrawResponse>;
  checkStatus(transactionId: string): Promise<'PENDING' | 'COMPLETED' | 'FAILED'>;
}
