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
      
      if (!walletId || !amount || amount < 100) {
        return res.status(400).json({ error: 'Minimum deposit amount is ₹100.' });
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
      const { amount, accountNumber, ifscCode, branchName, destinationAccount } = req.body;
      
      const parsedAmount = Number(amount);
      if (!walletId || !parsedAmount || parsedAmount < 300) {
        return res.status(400).json({ error: 'Enter a valid withdrawal amount of at least ₹300.' });
      }

      // Support either direct bank fields or nested destinationAccount
      const accNum = (accountNumber || destinationAccount?.accountNumber || '').trim();
      const ifsc = (ifscCode || destinationAccount?.ifscCode || '').trim();
      const branch = (branchName || destinationAccount?.branchName || '').trim();

      if (!accNum || !ifsc) {
        return res.status(400).json({ error: 'Bank account number and IFSC code are required.' });
      }

      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      if (wallet.balance < parsedAmount) {
        return res.status(400).json({ error: 'Insufficient wallet balance.' });
      }

      const settings = await prisma.paymentSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
      const feePercent = settings?.withdrawFeePercent || 0;
      const feeAmount = Math.round(((parsedAmount * feePercent) / 100) * 100) / 100;
      const finalAmount = Math.round((parsedAmount - feeAmount) * 100) / 100;

      // Lock funds atomically & create PENDING withdrawal transaction
      const result = await prisma.$transaction(async (tx) => {
        // Debit from balance and put into lockedBalance
        const debit = await tx.wallet.updateMany({
          where: { id: walletId, balance: { gte: parsedAmount } },
          data: {
            balance: { decrement: parsedAmount },
            lockedBalance: { increment: parsedAmount }
          }
        });

        if (debit.count !== 1) {
          throw new Error('INSUFFICIENT_FUNDS');
        }

        const idempotencyKey = `with-req-${uuidv4()}`;
        const transaction = await tx.transaction.create({
          data: {
            walletId,
            amount: parsedAmount,
            type: 'WITHDRAWAL',
            status: 'PENDING',
            balanceBefore: wallet.balance,
            balanceAfter: Math.round((wallet.balance - parsedAmount) * 100) / 100,
            currency: wallet.currency,
            idempotencyKey,
            description: `Withdrawal request for ₹${parsedAmount} (Fee: ${feePercent}% = ₹${feeAmount}, Payout: ₹${finalAmount})`,
            metadata: {
              feePercent,
              feeAmount,
              finalAmount,
              originalAmount: parsedAmount,
              bank: {
                accountNumber: accNum,
                ifscCode: ifsc,
                branchName: branch
              }
            }
          }
        });

        return transaction;
      });

      return res.json({
        message: `Withdrawal request of ₹${parsedAmount} submitted successfully. Platform fee (${feePercent}%): ₹${feeAmount}. Payout to receive: ₹${finalAmount}. Admin will review and process shortly.`,
        transaction: result,
        originalAmount: parsedAmount,
        feePercent,
        feeAmount,
        finalAmount
      });
    } catch (error: any) {
      if (error?.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'Insufficient wallet balance.' });
      }
      next(error);
    }
  }
}
