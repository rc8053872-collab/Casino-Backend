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
      res.json(withdrawals);
    } catch (error) {
      next(error);
    }
  }
}
