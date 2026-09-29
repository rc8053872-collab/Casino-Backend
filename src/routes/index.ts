import { Router } from 'express';
import walletRoutes from './walletRoutes';
import adminRoutes from './adminRoutes';
import gameRoutes from './gameRoutes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Casino API is running' });
});

router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/games', gameRoutes);

export default router;
