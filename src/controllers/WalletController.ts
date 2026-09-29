import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { PaymentService } from '../services/PaymentService';

const paymentService = new PaymentService('mock');

export class WalletController {
  
  static async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const walletId = req.user?.walletId; // Assumes auth middleware sets this
      if (!walletId) return res.status(400).json({ error: 'Wallet not found for user' });

      const wallet = await WalletService.getBalance(walletId);
      res.json({ balance: wallet.balance, lockedBalance: wallet.lockedBalance, currency: wallet.currency });
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const walletId = req.user?.walletId;
      if (!walletId) return res.status(400).json({ error: 'Wallet not found' });

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const transactions = await WalletService.getTransactions(walletId, limit, offset);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  }

  static async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const walletId = req.user?.walletId;
      const { amount } = req.body;
      
      if (!walletId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit request' });
      }

      const response = await paymentService.initiateDeposit(walletId, amount);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const walletId = req.user?.walletId;
      const { amount, destinationAccount } = req.body;
      
      if (!walletId || !amount || amount <= 0 || !destinationAccount) {
        return res.status(400).json({ error: 'Invalid withdrawal request' });
      }

      const response = await paymentService.requestWithdrawal(walletId, amount, destinationAccount);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
