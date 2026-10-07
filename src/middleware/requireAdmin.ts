import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId)) {
      return res.status(403).json({ error: 'Administrator access required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true }
    });

    if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Administrator access required.' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
