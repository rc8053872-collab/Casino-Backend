import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import adminWalletRoutes from './adminWalletRoutes';

const router = Router();

// Dashboard Metrics
router.get('/dashboard', AdminController.getDashboardMetrics);

// Users
router.get('/users', AdminController.getUsers);

// Withdrawals
router.get('/withdrawals', AdminController.getWithdrawals);

// Wallet actions (manual adjustments etc)
router.use('/wallet', adminWalletRoutes);

export default router;
