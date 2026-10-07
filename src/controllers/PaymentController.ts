import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';
import { WalletService } from '../services/WalletService';
import { areDemoPaymentsEnabled } from '../config/demoPayments';

export class PaymentController {
  static async getPaymentSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const setting = await prisma.paymentSetting.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' }
      });

      const configured = Boolean(setting?.upiId && setting.qrCodeUrl);
      if (!configured && process.env.NODE_ENV === 'development') {
        return res.json({
          configured: true,
          isDemo: true,
          demoSubmissionsEnabled: areDemoPaymentsEnabled(),
          upiId: 'orbit-demo@upi',
          qrCodeUrl: '/demo-payment-qr.svg'
        });
      }

      return res.json({
        configured,
        isDemo: false,
        demoSubmissionsEnabled: false,
        upiId: configured ? setting?.upiId : null,
        qrCodeUrl: configured ? setting?.qrCodeUrl : null
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { amount, utrNumber, proofDataUrl } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Please log in to request a deposit.' });
      }

      if (!Number.isInteger(amount) || amount < 100 || amount > 10000) {
        return res.status(400).json({ error: 'Enter a whole amount from ₹100 to ₹10,000.' });
      }

      if (typeof utrNumber !== 'string' || !/^[a-z\d]{6,22}$/i.test(utrNumber.trim())) {
        return res.status(400).json({ error: 'Enter a valid UTR/reference number (6–22 letters or digits).' });
      }

      if (
        typeof proofDataUrl !== 'string'
        || proofDataUrl.length > 2_100_000
        || !/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(proofDataUrl)
      ) {
        return res.status(400).json({ error: 'Upload a payment screenshot in PNG, JPEG, or WebP format (maximum 1.5 MB).' });
      }

      const setting = await prisma.paymentSetting.findFirst({
        where: { isActive: true },
        select: { upiId: true, qrCodeUrl: true }
      });

      const isDemo = !setting?.upiId || !setting.qrCodeUrl;
      if (isDemo && !areDemoPaymentsEnabled()) {
        return res.status(503).json({ error: 'Deposits are temporarily unavailable. Please try again later.' });
      }

      const wallet = await WalletService.getOrCreateForUser(userId);
      const normalizedUtr = utrNumber.trim().toUpperCase();

      try {
        const transaction = await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            amount,
            type: 'DEPOSIT',
            status: 'PENDING',
            idempotencyKey: `deposit-utr-${normalizedUtr}`,
            referenceId: normalizedUtr,
            description: 'Manual UPI deposit',
            metadata: { utrNumber: normalizedUtr, proofDataUrl, isDemo }
          }
        });

        return res.status(201).json({
          message: isDemo
            ? 'Demo deposit request submitted. Admin approval will credit the development wallet only.'
            : 'Deposit request submitted. Your wallet will be credited after admin verification.',
          transaction
        });
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
          return res.status(409).json({ error: 'This UTR/reference number has already been submitted.' });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
}
