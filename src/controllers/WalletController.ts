import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { PaymentService } from '../services/PaymentService';
import prisma from '../prismaClient';
import { v4 as uuidv4 } from 'uuid';

const paymentService = new PaymentService('mock');

export class WalletController {
  
  static async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Please log in to view your wallet.' });

      const wallet = await WalletService.getOrCreateForUser(userId);
      res.json({ balance: wallet.balance, lockedBalance: wallet.lockedBalance, currency: wallet.currency });
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Please log in to view your transactions.' });
      const wallet = await WalletService.getOrCreateForUser(userId);

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const transactions = await WalletService.getTransactions(wallet.id, limit, offset);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  }

  static async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const walletId = req.user?.walletId;
      const { amount, utrNumber, proofDataUrl } = req.body;
      
      if (!walletId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit request' });
      }

      // Handle manual deposits (with UTR and screenshot proof)
      if (utrNumber && proofDataUrl) {
        // Check if UTR is already used to prevent duplicates
        const existingTx = await prisma.transaction.findFirst({
          where: { referenceId: utrNumber, type: 'DEPOSIT' }
        });
        if (existingTx) {
          return res.status(400).json({ error: 'This UTR/reference number has already been used.' });
        }

        // Get the current balance so balanceBefore/After isn't 0
        const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        const tx = await prisma.transaction.create({
          data: {
            walletId,
            amount,
            type: 'DEPOSIT',
            status: 'PENDING',
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance, // unchanged until approved
            currency: wallet.currency,
            idempotencyKey: `dep-manual-${uuidv4()}`,
            referenceId: utrNumber,
            metadata: { proofDataUrl, isDemo: false }
          }
        });

        return res.json({ message: 'Deposit submitted for review', transaction: tx });
      }

      // Fallback to existing mock gateway logic if no proof provided
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
