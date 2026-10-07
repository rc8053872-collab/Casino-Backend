import { Request, Response, NextFunction } from 'express';
import { GameLaunchService } from '../services/games/GameLaunchService';
import { GameWebhookService } from '../services/games/GameWebhookService';
import prisma from '../prismaClient';

export class GameController {
  
  static async getCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      let { page, limit, search, provider, category, inrOnly, gameType } = req.query;

      const pageNumber = Math.max(1, parseInt(page as string) || 1);
      const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string) || 40));
      const skip = (pageNumber - 1) * limitNumber;

      const whereClause: any = {};

      if (category && category !== 'all' && category !== 'All') {
        whereClause.category = String(category);
      }

      if (provider && provider !== 'all' && provider !== 'All') {
        whereClause.provider = String(provider); // New catalog uses 'provider', legacy could use providerId but 'provider' is populated
      }

      if (gameType === 'Dragon Tiger') {
        whereClause.AND = [
          ...(whereClause.AND || []),
          {
            OR: [
              { name: { contains: 'dragon tiger', mode: 'insensitive' } },
              { name: { contains: 'dragon-tiger', mode: 'insensitive' } },
              { slug: { contains: 'dragon-tiger', mode: 'insensitive' } },
              { normalizedName: { contains: 'dragon tiger', mode: 'insensitive' } }
            ]
          }
        ];
      } else if (gameType === 'Triple 7') {
        whereClause.AND = [
          ...(whereClause.AND || []),
          {
            OR: [
              { name: { contains: 'triple 7', mode: 'insensitive' } },
              { name: { contains: 'triple-7', mode: 'insensitive' } },
              { name: { contains: 'triple seven', mode: 'insensitive' } },
              { name: { contains: '777', mode: 'insensitive' } },
              { name: { contains: '7 7 7', mode: 'insensitive' } },
              { slug: { contains: 'triple-7', mode: 'insensitive' } },
              { slug: { contains: '777', mode: 'insensitive' } },
              { normalizedName: { contains: 'triple 7', mode: 'insensitive' } }
            ]
          }
        ];
      } else if (gameType === 'Suspended') {
        whereClause.AND = [
          ...(whereClause.AND || []),
          {
            OR: [
              { status: { in: ['INACTIVE', 'BANNED'] } },
              { isActive: false }
            ]
          }
        ];
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { provider: { contains: String(search), mode: 'insensitive' } },
          { slug: { contains: String(search), mode: 'insensitive' } }
        ];
      }

      // Legacy fallback logic for inrOnly
      if (inrOnly === 'true' || (!req.query.inrOnly && category === 'SLOT')) {
        whereClause.supportedCurrencies = { has: 'INR' };
      }

      const [total, games] = await Promise.all([
        prisma.game.count({ where: whereClause }),
        prisma.game.findMany({
          where: whereClause,
          skip,
          take: limitNumber,
          orderBy: [{ displayOrder: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
        })
      ]);

      const formattedGames = games.map(g => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        provider: g.provider || g.providerId,
        providerId: g.providerId,
        gameUid: g.gameUid || g.providerId,
        category: g.category,
        subCategory: g.subCategory,
        thumbnail: g.thumbnail,
        banner: g.banner,
        supportedCurrencies: g.supportedCurrencies,
        status: g.status,
        isActive: g.isActive,
        isFeatured: g.isFeatured,
        isPopular: g.isPopular,
        sortOrder: g.sortOrder,
        displayOrder: g.displayOrder // legacy support
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

  static async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const category = typeof req.query.category === 'string'
        ? req.query.category.trim()
        : '';
      const providersList = await prisma.provider.findMany({
        where: category ? { games: { some: { category: { equals: category, mode: 'insensitive' } } } } : {},
        orderBy: { name: 'asc' }
      });
      
      const providerNames = providersList.map(p => p.name);

      // Include readable provider names from legacy games without a Provider record.
      const legacyProviders = await prisma.game.findMany({
        where: {
          provider: { not: null },
          ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {})
        },
        select: { provider: true },
        distinct: ['provider']
      });

      for (const lp of legacyProviders) {
        const providerName = lp.provider?.trim();
        if (providerName && !providerNames.includes(providerName)) {
          providerNames.push(providerName);
        }
      }

      res.json(providerNames);
    } catch (error) {
      next(error);
    }
  }

  static async launchGame(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { slug } = req.params;
      const clientIp = req.ip || '127.0.0.1';

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!slug) return res.status(400).json({ error: 'Game slug required' });

      const response = await GameLaunchService.launchGame(userId, slug as string, clientIp as string);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  static async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.params;
      
      const payload = {
        rawBody: JSON.stringify(req.body),
        headers: req.headers,
        parsedBody: req.body
      };

      await GameWebhookService.handleWebhook(providerId as string, payload);
      
      res.status(200).send('OK');
    } catch (error) {
      next(error);
    }
  }
}
