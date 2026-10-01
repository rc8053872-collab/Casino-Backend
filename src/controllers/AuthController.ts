import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { phone, password, confirmPassword } = req.body;

      if (!phone || !password || !confirmPassword) {
        return res.status(400).json({ status: 'FAILED', message: 'All fields are required' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ status: 'FAILED', message: 'Passwords do not match' });
      }

      // Basic phone normalization (remove spaces, etc)
      const normalizedPhone = phone.replace(/\s+/g, '');

      // Check if user exists
      const existingUser = await (prisma.user as any).findFirst({
        where: { mobile: normalizedPhone }
      });

      if (existingUser) {
        return res.status(409).json({ status: 'FAILED', message: 'This phone number is already registered.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user and wallet in a transaction (Map frontend 'phone' -> DB 'mobile')
      const user = await (prisma.user as any).create({
        data: {
          mobile: normalizedPhone,
          username: `user_${Date.now()}`,
          email: `${normalizedPhone}@temp.com`, // Bypass MongoDB unique index for email
          googleId: `temp_${Date.now()}_${normalizedPhone}`, // Bypass MongoDB unique index for googleId
          passwordHash,
          wallet: {
            create: {
              balance: 0,
              currency: 'INR'
            }
          }
        },
        select: {
          id: true,
          mobile: true,
          status: true
        }
      });

      return res.status(201).json({
        status: 'SUCCESS',
        message: 'Registration successful',
        user: { ...user, phone: user.mobile } // Map it back to phone for frontend compatibility
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      return res.status(500).json({ status: 'FAILED', message: 'Internal server error', details: error.message || error.toString() });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return res.status(400).json({ status: 'FAILED', message: 'Phone and OTP are required' });
      }

      const DEV_OTP = process.env.DEV_OTP || '123456';
      
      if (otp !== DEV_OTP) {
        return res.status(401).json({ status: 'FAILED', message: 'Invalid OTP' });
      }

      const normalizedPhone = phone.replace(/\s+/g, '');

      const user: any = await (prisma.user as any).findFirst({
        where: { mobile: normalizedPhone },
        include: { wallet: true }
      });

      if (!user) {
        return res.status(404).json({ status: 'FAILED', message: 'User not found' });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ status: 'FAILED', message: 'Account is not active' });
      }

      const secret = (process.env.JWT_SECRET || 'secret') as string;
      const token = jwt.sign(
        { id: user.id, walletId: user.wallet?.id },
        secret,
        { expiresIn: '24h' }
      );

      return res.json({
        status: 'SUCCESS',
        token,
        user: {
          id: user.id,
          phone: user.mobile,
          balance: user.wallet?.balance || 0,
          currency: user.wallet?.currency || 'INR'
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ status: 'FAILED', message: 'Internal server error', details: error.message || error.toString() });
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
          balance: user.wallet?.balance || 0,
          currency: user.wallet?.currency || 'INR'
        }
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'FAILED', message: 'Internal server error', details: error.message || error.toString() });
    }
  }
}
