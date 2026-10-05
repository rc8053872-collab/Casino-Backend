import { Request, Response, NextFunction } from 'express';
import { GameLaunchService } from '../services/games/GameLaunchService';
import { GameWebhookService } from '../services/games/GameWebhookService';
import prisma from '../prismaClient';

export class GameController {
  
  static async getCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, inrOnly } = req.query;
      
      const whereClause: any = { status: 'ACTIVE' };
      
      if (category && category !== 'all' && category !== 'All') {
        whereClause.category = String(category);
      }
      
      const { provider } = req.query;
      if (provider) {
        whereClause.provider = String(provider);
      }
      
      if (inrOnly === 'true' || (!req.query.inrOnly && category === 'SLOT')) {
        // By default, if category is SLOT and inrOnly isn't explicitly false, filter for INR
        // Or if inrOnly is explicitly true
        whereClause.supportedCurrencies = { has: 'INR' };
      }

      if (inrOnly === 'false') {
         // Show all active games for this category (no supportedCurrencies filter)
      }

      const games = await prisma.game.findMany({
        where: whereClause,
        orderBy: { displayOrder: 'asc' }
      });
      res.json(games);
    } catch (error) {
      next(error);
    }
  }

  static async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = await prisma.game.findMany({
        where: { status: 'ACTIVE' },
        select: { provider: true },
        distinct: ['provider']
      });
      res.json(providers.map(p => p.provider).filter(Boolean));
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
