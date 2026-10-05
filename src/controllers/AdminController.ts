import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

export class AdminController {
  
  static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalUsers,
        activeUsers,
        totalDeposits,
        totalWithdrawals,
        pendingWithdrawals,
        activeGames
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.transaction.aggregate({
          where: { type: 'DEPOSIT', status: 'COMPLETED' },
          _sum: { amount: true }
        }),
        prisma.transaction.aggregate({
          where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
          _sum: { amount: true }
        }),
        prisma.transaction.count({
          where: { type: 'WITHDRAWAL', status: 'PENDING' }
        }),
        prisma.game.count({ where: { status: 'ACTIVE' } })
      ]);

      res.json({
        totalUsers,
        activeUsers,
        totalDeposits: totalDeposits._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        pendingWithdrawals,
        activeGames
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          createdAt: true,
          wallet: {
            select: { balance: true, currency: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  static async getWithdrawals(req: Request, res: Response, next: NextFunction) {
    try {
      const withdrawals = await prisma.transaction.findMany({
        where: { type: 'WITHDRAWAL' },
        include: {
          wallet: {
            include: { user: { select: { username: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDeposits(req: Request, res: Response, next: NextFunction) {
    try {
      const deposits = await prisma.transaction.findMany({
        where: { type: 'DEPOSIT' },
        include: {
          wallet: {
            include: { user: { select: { username: true, mobile: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      res.json(deposits);
    } catch (error) {
      next(error);
    }
  }

  static async approveDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const transaction = await prisma.transaction.findUnique({ where: { id } });
      if (!transaction || transaction.type !== 'DEPOSIT' || transaction.status !== 'PENDING') {
         return res.status(400).json({ error: 'Invalid or already processed deposit' });
      }

      await prisma.$transaction([
         prisma.transaction.update({
            where: { id },
            data: { status: 'COMPLETED' }
         }),
         prisma.wallet.update({
            where: { id: transaction.walletId },
            data: { balance: { increment: transaction.amount } }
         })
      ]);
      res.json({ message: 'Deposit approved and balance added' });
    } catch (error) {
      next(error);
    }
  }

  static async rejectDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const transaction = await prisma.transaction.findUnique({ where: { id } });
      if (!transaction || transaction.type !== 'DEPOSIT' || transaction.status !== 'PENDING') {
         return res.status(400).json({ error: 'Invalid or already processed deposit' });
      }

      await prisma.transaction.update({
         where: { id },
         data: { status: 'FAILED' }
      });
      res.json({ message: 'Deposit rejected' });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { upiId, qrCodeUrl } = req.body;
      if (!upiId) return res.status(400).json({ error: 'UPI ID is required' });

      // Inactivate older settings
      await prisma.paymentSetting.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      const newSetting = await prisma.paymentSetting.create({
         data: { upiId, qrCodeUrl, isActive: true }
      });

      res.json(newSetting);
    } catch (error) {
      next(error);
    }
  }
}
