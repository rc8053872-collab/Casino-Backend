import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        walletId?: string;
        role?: string;
      };
    }
  }
}
