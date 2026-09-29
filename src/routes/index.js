import { Router } from 'express';
import walletRoutes from './walletRoutes';
import adminRoutes from './adminRoutes';
import gameRoutes from './gameRoutes';

import { GameCloudController } from '../controllers/GameCloudController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Casino API is running' });
});

router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/games', gameRoutes);

// GameCloud API Routes
router.post('/gamecloud/play', GameCloudController.launchGame);
router.post('/v1/callback', GameCloudController.callback); // Matches /api/v1/callback

// Direct test URL you can open in browser!
router.get('/test-gamecloud/:gameCode', GameCloudController.testLaunch);

export default router;
