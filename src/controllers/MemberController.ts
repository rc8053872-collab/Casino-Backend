import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import prisma from '../prismaClient';

export class MemberController {
  static async getReferralInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Please log in to view your invite code.' });

      let referral = await prisma.referralCode.findUnique({ where: { userId } });
      if (!referral) {
        for (let attempt = 0; attempt < 3 && !referral; attempt += 1) {
          const code = randomBytes(5).toString('hex').toUpperCase();
          try {
            referral = await prisma.referralCode.create({ data: { userId, code } });
          } catch (error) {
            const existingReferral = await prisma.referralCode.findUnique({ where: { userId } });
            if (existingReferral) {
              referral = existingReferral;
              break;
            }
            if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')) {
              throw error;
            }
          }
        }
      }

      if (!referral) throw new Error('Could not generate a unique invite code.');

      const invitedUsers = await prisma.user.count({ where: { referredByCode: referral.code } });
      const bonusTransactions = await prisma.transaction.aggregate({
        where: {
          type: 'BONUS',
          idempotencyKey: { startsWith: 'referral-signup-bonus-' },
          wallet: {
            is: {
              user: {
                is: { referredByCode: referral.code }
              }
            }
          }
        },
        _sum: { amount: true }
      });

      return res.json({
        code: referral.code,
        invitedUsers,
        earnedBonus: Number(bonusTransactions._sum.amount || 0),
        reward: 30,
        rewardDescription: 'Your friend receives ₹30 after their first successful login.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSupportSettings(_req: Request, res: Response, next: NextFunction) {
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
}
