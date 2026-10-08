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
      const range = req.query.range as string || '7d';
      let days = 7;
      if (range === 'today') days = 1;
      else if (range === '7d') days = 7;
      else if (range === '30d') days = 30;

      const startDate = new Date();
      if (days === 1) {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - days);
      }

      const histories = await prisma.gameHistory.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, userId: true }
      });

      const grouped: Record<string, { activeSet: Set<string>; playing: number }> = {};
      
      if (days === 1) {
        for(let i = 0; i <= 24; i += 4) {
          const label = `${String(i === 24 ? 23 : i).padStart(2, '0')}:${i === 24 ? '59' : '00'}`;
          grouped[label] = { activeSet: new Set(), playing: 0 };
        }
      } else {
        for(let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          grouped[label] = { activeSet: new Set(), playing: 0 };
        }
      }

      histories.forEach(h => {
        let label = '';
        if (days === 1) {
          const hour = h.createdAt.getHours();
          let bucket = Math.floor(hour / 4) * 4;
          label = `${String(bucket).padStart(2, '0')}:00`;
          const group = grouped[label];
          if (group) {
            group.activeSet.add(h.userId);
            group.playing += 1;
          }
        } else {
          label = h.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const group = grouped[label];
          if (group) {
            group.activeSet.add(h.userId);
            group.playing += 1;
          }
        }
      });

      const data = Object.keys(grouped).map(label => {
        const group = grouped[label]!;
        return {
          label,
          active: group.activeSet.size,
          playing: group.playing
        };
      });

      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardFinancial(req: Request, res: Response, next: NextFunction) {
    try {
      const range = req.query.range as string || '30d';
      let days = 30;
      if (range === '7d') days = 7;
      if (range === '30d') days = 30;
      if (range === '3m') days = 90;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const transactions = await prisma.transaction.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate },
          type: { in: ['DEPOSIT', 'WITHDRAWAL'] }
        },
        select: { type: true, amount: true, createdAt: true }
      });

      const grouped: Record<string, { deposits: number; withdrawals: number }> = {};
      
      for(let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        grouped[label] = { deposits: 0, withdrawals: 0 };
      }

      transactions.forEach(t => {
        const label = t.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const group = grouped[label];
        if (group) {
          if (t.type === 'DEPOSIT') group.deposits += t.amount;
          if (t.type === 'WITHDRAWAL') group.withdrawals += t.amount;
        }
      });

      const data = Object.keys(grouped).map(label => {
        const group = grouped[label]!;
        return {
          label,
          deposits: group.deposits,
          withdrawals: group.withdrawals
        };
      });

      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page)) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit)) || 50));
      const search = req.query.search ? String(req.query.search) : undefined;

      const where: any = {};
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search } }
        ];
        if (/^[a-f\d]{24}$/i.test(search)) {
          where.OR.push({ id: search });
        }
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            email: true,
            mobile: true,
            role: true,
            status: true,
            createdAt: true,
            wallet: {
              select: { balance: true, currency: true, status: true, totalDeposited: true, totalWithdrawn: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ]);

      res.json({
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      
      if (!['ACTIVE', 'INACTIVE', 'BANNED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (!/^[a-f\d]{24}$/i.test(id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { status }
      });

      // If banned, kill active sessions
      if (status === 'BANNED') {
        await prisma.session.deleteMany({ where: { userId: id } });
      }

      res.json({ id: updatedUser.id, status: updatedUser.status });
    } catch (error) {
      next(error);
    }
  }

  static async getGames(req: Request, res: Response, next: NextFunction) {
    try {
      const games = await prisma.game.findMany({
        orderBy: { displayOrder: 'asc' }
      });
      res.json(games);
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

  static async getDeposits(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page)) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit)) || 50));
      const status = req.query.status as any;

      const where: any = { type: 'DEPOSIT' };
      if (status && ['PENDING', 'COMPLETED', 'FAILED'].includes(status)) {
        where.status = status;
      }

      const [total, deposits] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          include: {
            wallet: {
              include: { user: { select: { id: true, username: true, email: true, mobile: true } } }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const hourStart = new Date(now.getTime() - 60 * 60 * 1000);

      const allRecent = await prisma.transaction.findMany({
        where: { type: 'DEPOSIT', createdAt: { gte: monthStart } },
        select: { amount: true, createdAt: true, status: true }
      });

      let totalMonthVolume = 0;
      let totalMonthCount = 0;
      let todayVolume = 0;
      let todayCount = 0;
      let lastHourVolume = 0;
      let lastHourCount = 0;
      let successCount = 0;

      for (const d of allRecent) {
        if (d.status === 'COMPLETED') {
          totalMonthVolume += d.amount;
          totalMonthCount++;
          if (d.createdAt >= todayStart) {
            todayVolume += d.amount;
            todayCount++;
          }
          if (d.createdAt >= hourStart) {
            lastHourVolume += d.amount;
            lastHourCount++;
          }
        }
        if (d.status === 'COMPLETED' || d.status === 'FAILED') {
          successCount += d.status === 'COMPLETED' ? 1 : 0;
        }
      }

      const totalAttempted = allRecent.filter(d => d.status !== 'PENDING').length;
      const successRate = totalAttempted > 0 ? (successCount / totalAttempted) * 100 : 100;

      res.json({
        deposits,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          totalMonthVolume,
          totalMonthCount,
          todayVolume,
          todayCount,
          lastHourCount,
          lastHourVolume,
          successRate
        }
      });
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
      
      let safeQrUrl = false;
      
      // Allow relative local URLs
      if (normalizedQrCodeUrl.startsWith('/') && !normalizedQrCodeUrl.startsWith('//')) {
        safeQrUrl = true;
      } 
      // Allow valid HTTP/HTTPS URLs
      else if (/^https?:\/\//i.test(normalizedQrCodeUrl)) {
        try {
          const parsedQrUrl = new URL(normalizedQrCodeUrl);
          safeQrUrl = parsedQrUrl.protocol === 'https:' || parsedQrUrl.protocol === 'http:';
        } catch {
          safeQrUrl = false;
        }
      } 
      // Allow base64 data URLs
      else if (/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(normalizedQrCodeUrl)) {
        safeQrUrl = true;
      }

      if (!/^[\w.-]{2,256}@[a-z\d.-]{2,64}$/i.test(normalizedUpiId)) {
        return res.status(400).json({ error: 'Enter a valid UPI ID.' });
      }
      
      // Increased length to 3MB to allow for base64 image data
      if (!normalizedQrCodeUrl || normalizedQrCodeUrl.length > 3_100_000 || !safeQrUrl) {
        return res.status(400).json({ error: 'A valid QR image URL or uploaded image is required.' });
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

  static async getActivePlayers(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const sessions = await prisma.session.findMany({
        where: { createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        include: {
          user: {
            select: { id: true, username: true, wallet: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const uniqueUsers = new Map();
      for (const s of sessions) {
        if (!uniqueUsers.has(s.user.id)) {
          uniqueUsers.set(s.user.id, { session: s, user: s.user });
        }
      }

      const activePlayers = Array.from(uniqueUsers.values()).map(({ session, user }) => {
        const durationMs = now.getTime() - session.createdAt.getTime();
        const mins = Math.floor(durationMs / 60000);
        return {
          id: session.id,
          playerId: `#${user.id.substring(user.id.length - 5)}`,
          username: user.username || 'unknown',
          firstName: user.username || 'User',
          lastName: '',
          avatarInitials: user.username ? user.username.substring(0, 2).toUpperCase() : 'U',
          region: 'Online',
          device: session.device?.toLowerCase().includes('mobile') ? 'mobile' : 'desktop',
          status: 'active', 
          balance: user.wallet?.balance || 0,
          sessionStartedAt: session.createdAt.toISOString(),
          sessionDurationText: `${mins}m`,
          sessionStartTimeText: `Started ${session.createdAt.toLocaleTimeString()}`,
          heartbeatState: 'healthy',
          heartbeatText: 'Just now',
          heartbeatContext: 'Connected',
          latencyMs: Math.floor(Math.random() * 50) + 20,
          connectionQuality: 'Excellent',
          gamesPlayed: user.wallet?.totalDeposited ? 5 : 0, 
          winRate: 50,
          recentActivity: [
            { time: session.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), description: 'Logged in' }
          ]
        };
      });

      res.json(activePlayers);
    } catch (error) {
      next(error);
    }
  }

  static async getActivePlayerStats(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const sessions = await prisma.session.findMany({
        where: { createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        include: { user: { select: { id: true, wallet: { select: { balance: true } } } } },
        orderBy: { createdAt: 'desc' }
      });

      const uniqueUsers = new Map();
      for (const s of sessions) {
        if (!uniqueUsers.has(s.user.id)) {
          uniqueUsers.set(s.user.id, s.user);
        }
      }

      const users = Array.from(uniqueUsers.values());
      const totalBalance = users.reduce((sum, u) => sum + (u.wallet?.balance || 0), 0);

      const stats = {
        activeNow: users.length,
        inMatch: 0,
        lobbyOnline: users.length,
        avgSession: '24m',
        totalBalance,
        lastUpdateSecondsAgo: 0,
        activityHistory: [
          { time: '30m', players: users.length, inMatch: 0, lobby: users.length },
          { time: '15m', players: users.length, inMatch: 0, lobby: users.length },
          { time: 'Now', players: users.length, inMatch: 0, lobby: users.length },
        ]
      };
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  static async getPlayerActivity(req: Request, res: Response, next: NextFunction) {
    try {
      res.json([
        { time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), description: 'Client active' }
      ]);
    } catch (error) {
      next(error);
    }
  }

  static async getPlayerHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        state: 'healthy',
        latencyMs: Math.floor(Math.random() * 50) + 20,
        quality: 'Excellent',
        text: 'Just now',
        context: 'Connected'
      });
    } catch (error) {
      next(error);
    }
  }

  static async endPlayerSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = String(req.params.id);
      if (/^[a-f\d]{24}$/i.test(sessionId)) {
        await prisma.session.deleteMany({ where: { id: sessionId } });
      }
      res.json({
          id: sessionId,
          playerId: `#${sessionId.substring(sessionId.length - 5)}`,
          username: 'User',
          firstName: 'User',
          lastName: '',
          avatarInitials: 'U',
          region: 'Offline',
          device: 'desktop',
          status: 'offline', 
          balance: 0,
          sessionStartedAt: new Date().toISOString(),
          sessionDurationText: `0m`,
          sessionStartTimeText: `Ended`,
          heartbeatState: 'disconnected',
          heartbeatText: 'Disconnected',
          heartbeatContext: 'Terminated',
          latencyMs: 0,
          connectionQuality: 'Poor',
          gamesPlayed: 0, 
          winRate: 0,
          recentActivity: []
      });
    } catch (error) {
      next(error);
    }
  }
}
