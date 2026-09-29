import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { v4 as uuidv4 } from 'uuid';

export class AdminWalletController {
  
  static async manualAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const { walletId, amount, type, description } = req.body;
      const adminId = req.user?.id; // Assumes admin auth middleware

      if (!walletId || !amount) {
        return res.status(400).json({ error: 'walletId and amount are required' });
      }

      const idempotencyKey = `admin-adj-${uuidv4()}`;
      let tx;

      if (type === 'CREDIT') {
        tx = await WalletService.deposit(walletId, amount, idempotencyKey, `admin-${adminId}`, description || 'Manual admin credit');
      } else if (type === 'DEBIT') {
        tx = await WalletService.withdraw(walletId, amount, idempotencyKey, `admin-${adminId}`, description || 'Manual admin debit');
      } else {
        return res.status(400).json({ error: 'Invalid adjustment type' });
      }

      res.json(tx);
    } catch (error) {
      next(error);
    }
  }
}
