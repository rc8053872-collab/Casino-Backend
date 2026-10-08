import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import prisma from '../prismaClient';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, phone, password, confirmPassword, referralCode } = req.body;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const normalizedPhone = typeof phone === 'string' ? phone.replace(/[^\d+]/g, '') : '';

      if (!normalizedEmail || !normalizedPhone || !password || !confirmPassword) {
        return res.status(400).json({ status: 'FAILED', message: 'Email, phone, and both password fields are required.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
        return res.status(400).json({ status: 'FAILED', message: 'Enter a valid email address.' });
      }
      if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
        return res.status(400).json({ status: 'FAILED', message: 'Enter a valid phone number with 8–15 digits.' });
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return res.status(400).json({ status: 'FAILED', message: 'Password must be between 8 and 128 characters.' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ status: 'FAILED', message: 'Passwords do not match.' });
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: normalizedEmail }, { mobile: normalizedPhone }] },
        select: { id: true }
      });
      if (existingUser) {
        return res.status(409).json({ status: 'FAILED', message: 'An account already exists with this email or phone number.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const normalizedReferralCode = typeof referralCode === 'string' ? referralCode.trim().toUpperCase() : '';
      let referringCode: string | null = null;
      if (normalizedReferralCode) {
        const referral = await prisma.referralCode.findUnique({
          where: { code: normalizedReferralCode },
          select: { code: true }
        });
        if (!referral) {
          return res.status(400).json({ status: 'FAILED', message: 'This invite code is not valid.' });
        }
        referringCode = referral.code;
      }

      let newReferralCode = randomBytes(5).toString('hex').toUpperCase();
      while (await prisma.referralCode.findUnique({ where: { code: newReferralCode }, select: { id: true } })) {
        newReferralCode = randomBytes(5).toString('hex').toUpperCase();
      }

      const user = await prisma.user.create({
        data: {
          mobile: normalizedPhone,
          username: normalizedEmail,
          email: normalizedEmail,
          googleId: null,
          passwordHash,
          referredByCode: referringCode,
          referralCode: { create: { code: newReferralCode } },
          wallet: { create: { balance: 0, currency: 'INR' } }
        },
        select: { id: true, mobile: true, email: true, role: true, status: true }
      });

      return res.status(201).json({
        status: 'SUCCESS',
        message: 'Registration successful. You can now log in with your email or phone and password.',
        user: { ...user, phone: user.mobile }
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        return res.status(409).json({
          status: 'FAILED',
          message: 'An account already exists with this email or phone number.'
        });
      }
      return res.status(500).json({ status: 'FAILED', message: 'Registration failed. Please try again.' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { identifier, password } = req.body;
      if (
        typeof identifier !== 'string'
        || typeof password !== 'string'
        || !identifier.trim()
        || identifier.length > 254
        || !password
        || password.length > 128
      ) {
        return res.status(400).json({ status: 'FAILED', message: 'Enter your email or phone number and password.' });
      }

      const normalizedIdentifier = identifier.trim().toLowerCase();
      const isEmail = normalizedIdentifier.includes('@');
      const user = await prisma.user.findFirst({
        where: isEmail
          ? { email: normalizedIdentifier }
          : { mobile: normalizedIdentifier.replace(/[^\d+]/g, '') },
        include: { wallet: true }
      });
      if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ status: 'FAILED', message: 'Email/phone or password is incorrect.' });
      }
      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ status: 'FAILED', message: 'Account is not active.' });
      }

      if (user.referredByCode && !user.referralBonusAwardedAt) {
        await prisma.$transaction(async (tx) => {
          const claim = await tx.user.updateMany({
            where: { id: user.id, referredByCode: { not: null }, referralBonusAwardedAt: null },
            data: { referralBonusAwardedAt: new Date() }
          });
          if (claim.count !== 1) return;

          const wallet = await tx.wallet.upsert({
            where: { userId: user.id },
            create: { userId: user.id, balance: 0, currency: 'INR' },
            update: {}
          });
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: 30 } }
          });
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              amount: 30,
              type: 'BONUS',
              status: 'COMPLETED',
              balanceBefore: wallet.balance,
              balanceAfter: Number(wallet.balance) + 30,
              idempotencyKey: `referral-signup-bonus-${user.id}`,
              description: '₹30 invite signup bonus',
              metadata: { referralCode: user.referredByCode }
            }
          });
        });
      }

      const wallet = await prisma.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: 0, currency: 'INR' },
        update: {}
      });
      const refreshedWallet = user.referredByCode
        ? await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })
        : wallet;
      const token = jwt.sign(
        { id: user.id, walletId: refreshedWallet.id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      return res.json({
        status: 'SUCCESS',
        token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.mobile,
          balance: refreshedWallet.balance,
          currency: refreshedWallet.currency,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ status: 'FAILED', message: 'Login failed. Please try again.' });
    }
  }

  static async getMe(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: 'FAILED', message: 'Unauthorized' });
      }

      const user: any = await (prisma.user as any).findUnique({
        where: { id: userId },
        include: { wallet: true }
      });

      if (!user) {
        return res.status(404).json({ status: 'FAILED', message: 'User not found' });
      }

      return res.json({
        status: 'SUCCESS',
        user: {
          id: user.id,
          phone: user.mobile,
          email: user.email,
          role: user.role,
          balance: user.wallet?.balance || 0,
          currency: user.wallet?.currency || 'INR'
        }
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'FAILED', message: 'Internal server error', details: error.message || error.toString() });
    }
  }
}
