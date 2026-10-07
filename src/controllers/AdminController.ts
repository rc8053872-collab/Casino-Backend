import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
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

  static async getGamesForReview(req: Request, res: Response, next: NextFunction) {
    try {
      const inactiveGames = await prisma.game.findMany({
        where: { status: 'INACTIVE', isActive: false },
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      });

      const games = inactiveGames
        .filter((game) => {
          const metadata = game.metadata;
          return metadata !== null &&
            typeof metadata === 'object' &&
            !Array.isArray(metadata) &&
            (metadata.status === 'INTEGRATION_PENDING' || metadata.isNewCatalog === true);
        })
        .map((game) => ({
          id: game.id,
          slug: game.slug,
          name: game.name,
          provider: game.provider,
          providerId: game.providerId,
          gameUid: game.gameUid,
          category: game.category,
          subCategory: game.subCategory,
          thumbnail: game.thumbnail,
          banner: game.banner,
          supportedCurrencies: game.supportedCurrencies,
          createdAt: game.createdAt,
        }));

      res.json({ games });
    } catch (error) {
      next(error);
    }
  }

  static async reviewGame(req: Request, res: Response, next: NextFunction) {
    try {
      const { decision } = req.body as { decision?: string };
      if (decision !== 'accept' && decision !== 'reject') {
        return res.status(400).json({ error: 'Decision must be accept or reject.' });
      }

      const game = await prisma.game.findUnique({ where: { id: String(req.params.id) } });
      if (!game) {
        return res.status(404).json({ error: 'Game not found.' });
      }

      const metadata = game.metadata !== null &&
        typeof game.metadata === 'object' &&
        !Array.isArray(game.metadata)
        ? game.metadata
        : {};
      const isPending =
        metadata.status === 'INTEGRATION_PENDING' || metadata.isNewCatalog === true;
      if (!isPending || game.status !== 'INACTIVE' || game.isActive) {
        return res.status(409).json({ error: 'This game is no longer waiting for review.' });
      }

      const accepted = decision === 'accept';
      const updatedGame = await prisma.game.update({
        where: { id: game.id },
        data: {
          status: accepted ? 'ACTIVE' : 'BANNED',
          isActive: accepted,
          metadata: {
            ...metadata,
            status: accepted ? 'APPROVED' : 'REJECTED',
            reviewStatus: accepted ? 'APPROVED' : 'REJECTED',
            reviewedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        select: { id: true, slug: true, status: true, isActive: true },
      });

      res.json({ game: updatedGame });
    } catch (error) {
      next(error);
    }
  }
}
