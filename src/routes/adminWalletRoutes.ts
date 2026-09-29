import { Router } from 'express';
import { AdminWalletController } from '../controllers/AdminWalletController';

const router = Router();

// These routes should be protected by admin authentication middleware
router.post('/adjustment', AdminWalletController.manualAdjustment);

export default router;
