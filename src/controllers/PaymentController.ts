import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';
import { v4 as uuidv4 } from 'uuid';

export class PaymentController {
  
  static async getPaymentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      let setting = await prisma.paymentSetting.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' }
      });
      // If no setting, return a default mock
      if (!setting) {
        setting = { 
          id: 'default', 
          upiId: 'admin@ybl', 
          qrCodeUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg', // Placeholder QR
          isActive: true, 
          updatedAt: new Date() 
        } as any;
      }
      res.json(setting);
    } catch (error) {
      next(error);
    }
  }

  static async submitDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const walletId = req.user?.walletId;
      const { amount, utrNumber } = req.body;
      
      if (!walletId || !amount || amount < 200 || !utrNumber) {
        return res.status(400).json({ error: 'Minimum deposit is ₹200 and UTR number is required' });
      }

      // Check for duplicate UTR
      const existing = await prisma.transaction.findFirst({
        where: { referenceId: utrNumber }
      });

      if (existing) {
         return res.status(400).json({ error: 'This UTR number has already been submitted.' });
      }

      // Create a PENDING transaction
      const transaction = await prisma.transaction.create({
        data: {
          walletId,
          amount: Number(amount),
          type: 'DEPOSIT',
          status: 'PENDING',
          idempotencyKey: `dep-${uuidv4()}`,
          referenceId: utrNumber,
          description: 'Manual UPI Deposit',
          metadata: { utrNumber }
        }
      });

      res.json({ message: 'Deposit request submitted successfully. Waiting for admin approval.', transaction });
    } catch (error) {
      next(error);
    }
  }
}
