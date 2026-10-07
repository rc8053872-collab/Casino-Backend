import { Request, Response, NextFunction } from 'express';
import { GameLaunchService } from '../services/games/GameLaunchService';
import { GameWebhookService } from '../services/games/GameWebhookService';
import prisma from '../prismaClient';

export class GameController {
  
  static async getCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      let { page, limit, search, provider, category, inrOnly } = req.query;

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
      const providersList = await prisma.provider.findMany({
        orderBy: { name: 'asc' }
      });
      
      const providerNames = providersList.map(p => p.name);

      // Legacy fallback: also fetch from providerId string if some don't have Provider records
      const legacyProviders = await prisma.game.findMany({
        where: { providerId: { not: "" } },
        select: { providerId: true },
        distinct: ['providerId']
      });

      for (const lp of legacyProviders) {
        if (!providerNames.includes(lp.providerId)) {
          providerNames.push(lp.providerId);
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
