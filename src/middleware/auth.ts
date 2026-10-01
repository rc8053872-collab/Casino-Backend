import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        walletId?: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Check if we want to fallback to a dummy user for testing, or block it
    if (process.env.NODE_ENV === 'development') {
      req.user = { id: '6abb9d660aadf780eea7f21f' };
      return next();
    }
    return res.status(401).json({ status: 'FAILED', error: 'UNAUTHORIZED', message: 'Please login to play this game.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string; walletId?: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ status: 'FAILED', error: 'UNAUTHORIZED', message: 'Please login to play this game.' });
  }
};
