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

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const startOfHour = new Date();
      startOfHour.setHours(startOfHour.getHours() - 1);

      const [newUsersToday, depositsLastHour, liveGames] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.transaction.count({
          where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: startOfHour } }
        }),
        prisma.game.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, status: true },
          take: 5
        })
      ]);

      res.json({
        totalUsers,
        activeUsers,
        totalDeposits: totalDeposits._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        pendingWithdrawals,
        activeGames,
        newUsersToday,
        depositsLastHour,
        liveGames
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const transactions = await prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { wallet: { include: { user: { select: { username: true } } } } }
      });
      
      const formatted = transactions.map(t => ({
        id: t.id,
        user: t.wallet?.user?.username || 'Unknown',
        type: t.type,
        amount: t.amount,
        timeAgo: t.createdAt.toISOString(),
        status: t.status
      }));
      
      res.json(formatted);
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardActivity(req: Request, res: Response, next: NextFunction) {
    try {
      // Mock data for the activity chart
      const data = [
        { time: '00:00', players: 120, sessions: 450 },
        { time: '04:00', players: 80, sessions: 300 },
        { time: '08:00', players: 250, sessions: 900 },
        { time: '12:00', players: 400, sessions: 1500 },
        { time: '16:00', players: 550, sessions: 2200 },
        { time: '20:00', players: 800, sessions: 3500 },
        { time: '23:59', players: 600, sessions: 2500 }
      ];
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardFinancial(req: Request, res: Response, next: NextFunction) {
    try {
      // Mock data for the financial chart
      const data = [
        { date: 'Mon', deposits: 4000, withdrawals: 2400 },
        { date: 'Tue', deposits: 3000, withdrawals: 1398 },
        { date: 'Wed', deposits: 2000, withdrawals: 9800 },
        { date: 'Thu', deposits: 2780, withdrawals: 3908 },
        { date: 'Fri', deposits: 1890, withdrawals: 4800 },
        { date: 'Sat', deposits: 2390, withdrawals: 3800 },
        { date: 'Sun', deposits: 3490, withdrawals: 4300 }
      ];
      res.json(data);
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

  static async getGames(req: Request, res: Response, next: NextFunction) {
    try {
      let { page, limit, search, provider, category, status, isFeatured, isPopular } = req.query;

      const pageNumber = Math.max(1, parseInt(page as string) || 1);
      const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string) || 40));
      const skip = (pageNumber - 1) * limitNumber;

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { provider: { contains: search as string, mode: 'insensitive' } },
          { gameUid: { contains: search as string, mode: 'insensitive' } },
          { slug: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      if (provider) where.provider = provider as string;
      if (category) where.category = category as string;
      
      // Map status filter to isActive or the string status
      if (status === 'INTEGRATION_PENDING') {
        where.status = 'INACTIVE';
      } else if (status) {
        where.status = status as string;
      }
      
      if (isFeatured === 'true') where.isFeatured = true;
      if (isPopular === 'true') where.isPopular = true;

      const [total, games] = await Promise.all([
        prisma.game.count({ where }),
        prisma.game.findMany({
          where,
          skip,
          take: limitNumber,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
        })
      ]);

      const formattedGames = games.map(g => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        provider: g.provider,
        gameUid: g.gameUid,
        vendorId: g.vendorId,
        category: g.category,
        subCategory: g.subCategory,
        thumbnail: g.thumbnail,
        banner: g.banner,
        status: g.status,
        isActive: g.isActive,
        isFeatured: g.isFeatured,
        isPopular: g.isPopular,
        launchType: g.launchType,
        mode: g.mode
      }));

      res.json({
        games: formattedGames,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber)
        }
      });
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

  static async updateGame(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const { isActive, isFeatured, isPopular, sortOrder, category, subCategory, thumbnail, banner } = req.body;

      const updateData: any = {};
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
      if (isPopular !== undefined) updateData.isPopular = isPopular;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (category !== undefined) updateData.category = category;
      if (subCategory !== undefined) updateData.subCategory = subCategory;
      if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
      if (banner !== undefined) updateData.banner = banner;

      const updatedGame = await prisma.game.update({
        where: { id: String(id) },
        data: updateData
      });

      res.json(updatedGame);
    } catch (error) {
      next(error);
    }
  }

  static async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = await prisma.provider.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(providers);
    } catch (error) {
      next(error);
    }
  }
}
