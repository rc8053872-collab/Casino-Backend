import { Request, Response, NextFunction } from 'express';
import { GameLaunchService } from '../services/games/GameLaunchService';
import { GameWebhookService } from '../services/games/GameWebhookService';
import prisma from '../prismaClient';

export class GameController {
  
  static async getCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const games = await prisma.game.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { displayOrder: 'asc' }
      });
      res.json(games);
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
