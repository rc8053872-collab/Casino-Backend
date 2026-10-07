import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { WalletService } from '../services/WalletService';
import { PaymentService } from '../services/PaymentService';

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
      const userId = req.user?.id;
      const { amount, accountNumber, ifscCode, branchName } = req.body;
      const normalizedAccountNumber = typeof accountNumber === 'string' ? accountNumber.replace(/\s/g, '') : '';
      const normalizedIfsc = typeof ifscCode === 'string' ? ifscCode.trim().toUpperCase() : '';
      const normalizedBranch = typeof branchName === 'string' ? branchName.trim() : '';

      if (!userId) {
        return res.status(401).json({ error: 'Please log in before requesting a withdrawal.' });
      }

      if (!Number.isSafeInteger(amount) || amount < 300) {
        return res.status(400).json({ error: 'Enter a whole withdrawal amount of at least ₹300.' });
      }
      if (!/^\d{6,24}$/.test(normalizedAccountNumber)) {
        return res.status(400).json({ error: 'Enter a valid bank account number.' });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
        return res.status(400).json({ error: 'Enter a valid 11-character IFSC code.' });
      }
      if (normalizedBranch.length < 2 || normalizedBranch.length > 100) {
        return res.status(400).json({ error: 'Enter a branch name between 2 and 100 characters.' });
      }

      const wallet = await WalletService.getOrCreateForUser(userId);
      const transaction = await prisma.$transaction(async (tx) => {
        const debit = await tx.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: amount } },
          data: { balance: { decrement: amount } }
        });
        if (debit.count !== 1) {
          return null;
        }

        const balanceAfter = await tx.wallet.findUniqueOrThrow({
          where: { id: wallet.id },
          select: { balance: true }
        });
        return tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount,
            type: 'WITHDRAWAL',
            status: 'PENDING',
            balanceBefore: Number(balanceAfter.balance) + amount,
            balanceAfter: balanceAfter.balance,
            idempotencyKey: `withdrawal-${randomUUID()}`,
            description: 'Bank withdrawal request',
            metadata: {
              bank: {
                accountNumber: normalizedAccountNumber,
                ifscCode: normalizedIfsc,
                branchName: normalizedBranch
              }
            } satisfies Prisma.InputJsonValue
          }
        });
      });

      if (!transaction) {
        return res.status(400).json({ error: 'Insufficient available wallet balance.' });
      }

      return res.status(201).json({
        message: 'Withdrawal request submitted. The amount is held until the admin reviews it.',
        transaction
      });
    } catch (error) {
      next(error);
    }
  }
}
