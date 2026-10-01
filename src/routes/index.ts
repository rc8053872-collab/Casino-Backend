import { Router } from 'express';
import walletRoutes from './walletRoutes';
import adminRoutes from './adminRoutes';
import gameRoutes from './gameRoutes';

import { GameCloudController } from '../controllers/GameCloudController';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Auth Routes
router.post('/v1/auth/register', AuthController.register);
router.post('/v1/auth/login', AuthController.login);
router.get('/v1/auth/me', requireAuth, AuthController.getMe);

router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/games', gameRoutes);

// GameCloud API Routes
router.post('/v1/games/launch', requireAuth, GameCloudController.launchGame); // POST /api/v1/games/launch
router.post('/gamecloud/play', requireAuth, GameCloudController.launchGame);
router.post('/v1/callback', GameCloudController.callback); // Matches /api/v1/callback

// Direct test URL you can open in browser!
router.get('/test-gamecloud/:gameCode', GameCloudController.testLaunch);

export default router;
