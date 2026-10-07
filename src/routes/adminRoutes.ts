import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import adminWalletRoutes from './adminWalletRoutes';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.use(requireAuth, requireAdmin);

// Dashboard Metrics
router.get('/dashboard', AdminController.getDashboardMetrics);

// Users
router.get('/users', AdminController.getUsers);

// Withdrawals
router.get('/withdrawals', AdminController.getWithdrawals);

// Deposits
router.get('/deposits', AdminController.getDeposits);
router.post('/deposits/:id/approve', AdminController.approveDeposit);
router.post('/deposits/:id/reject', AdminController.rejectDeposit);

// Payment Settings
router.post('/payments/settings', AdminController.updatePaymentSettings);
router.get('/support/settings', AdminController.getSupportSettings);
router.post('/support/settings', AdminController.updateSupportSettings);

// Games
router.get('/games', AdminController.getGames);
router.get('/games/review', AdminController.getGamesForReview);
router.post('/games/:id/review', AdminController.reviewGame);
router.patch('/games/:id', AdminController.updateGame);

// Providers
router.get('/providers', AdminController.getProviders);

// Wallet actions (manual adjustments etc)
router.use('/wallet', adminWalletRoutes);

export default router;
