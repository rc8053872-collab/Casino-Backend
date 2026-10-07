import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { areDemoPaymentsEnabled } from '../config/demoPayments';

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
      if (!/^[a-f\d]{24}$/i.test(id)) {
        return res.status(400).json({ error: 'Invalid deposit ID.' });
      }

      const deposit = await prisma.transaction.findUnique({
        where: { id },
        select: { type: true, status: true, metadata: true }
      });
      if (
        deposit?.type === 'DEPOSIT'
        && deposit.status === 'PENDING'
        && deposit.metadata
        && typeof deposit.metadata === 'object'
        && !Array.isArray(deposit.metadata)
        && 'isDemo' in deposit.metadata
        && deposit.metadata.isDemo === true
        && !areDemoPaymentsEnabled()
      ) {
        return res.status(403).json({
          error: 'Demo deposits can only be approved with demo mode enabled and a local development database.'
        });
      }

      const approved = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({ where: { id } });
        if (!transaction || transaction.type !== 'DEPOSIT' || transaction.status !== 'PENDING') {
          return false;
        }

        const wallet = await tx.wallet.findUnique({ where: { id: transaction.walletId } });
        if (!wallet) {
          throw new Error('Wallet not found for deposit.');
        }

        const update = await tx.transaction.updateMany({
          where: { id, type: 'DEPOSIT', status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance + transaction.amount
          }
        });
        if (update.count !== 1) {
          return false;
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: transaction.amount },
            totalDeposited: { increment: transaction.amount }
          }
        });
        return true;
      });

      if (!approved) {
        return res.status(409).json({ error: 'Deposit not found or already processed.' });
      }

      return res.json({ message: 'Deposit approved and wallet balance credited.' });
    } catch (error) {
      next(error);
    }
  }

  static async rejectDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      if (!/^[a-f\d]{24}$/i.test(id)) {
        return res.status(400).json({ error: 'Invalid deposit ID.' });
      }

      const update = await prisma.transaction.updateMany({
        where: { id, type: 'DEPOSIT', status: 'PENDING' },
        data: { status: 'FAILED' }
      });
      if (update.count !== 1) {
        return res.status(409).json({ error: 'Deposit not found or already processed.' });
      }
      return res.json({ message: 'Deposit rejected.' });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { upiId, qrCodeUrl } = req.body;
      const normalizedUpiId = typeof upiId === 'string' ? upiId.trim() : '';
      const normalizedQrCodeUrl = typeof qrCodeUrl === 'string' ? qrCodeUrl.trim() : '';
      let safeQrUrl = normalizedQrCodeUrl.startsWith('/') && !normalizedQrCodeUrl.startsWith('//');
      if (/^https?:\/\//i.test(normalizedQrCodeUrl)) {
        try {
          const parsedQrUrl = new URL(normalizedQrCodeUrl);
          safeQrUrl = parsedQrUrl.protocol === 'https:' || parsedQrUrl.protocol === 'http:';
        } catch {
          safeQrUrl = false;
        }
      }

      if (!/^[\w.-]{2,256}@[a-z\d.-]{2,64}$/i.test(normalizedUpiId)) {
        return res.status(400).json({ error: 'Enter a valid UPI ID.' });
      }
      if (!normalizedQrCodeUrl || normalizedQrCodeUrl.length > 4096 || !safeQrUrl) {
        return res.status(400).json({ error: 'A valid QR image URL is required.' });
      }

      const newSetting = await prisma.$transaction(async (tx) => {
        await tx.paymentSetting.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });

        return tx.paymentSetting.create({
          data: { upiId: normalizedUpiId, qrCodeUrl: normalizedQrCodeUrl, isActive: true }
        });
      });

      return res.json({ configured: true, upiId: newSetting.upiId, qrCodeUrl: newSetting.qrCodeUrl });
    } catch (error) {
      next(error);
    }
  }

  static async getSupportSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const setting = await prisma.supportSetting.findFirst({ orderBy: { updatedAt: 'desc' } });
      return res.json({
        configured: Boolean(setting?.whatsappNumber),
        whatsappNumber: setting?.whatsappNumber || null
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSupportSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const rawNumber = typeof req.body.whatsappNumber === 'string' ? req.body.whatsappNumber.trim() : '';
      const whatsappNumber = rawNumber.replace(/[\s()+.-]/g, '');
      if (!/^\d{8,15}$/.test(whatsappNumber)) {
        return res.status(400).json({ error: 'Enter a WhatsApp number with country code, using 8–15 digits.' });
      }

      const setting = await prisma.supportSetting.create({ data: { whatsappNumber } });
      return res.json({ configured: true, whatsappNumber: setting.whatsappNumber });
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
