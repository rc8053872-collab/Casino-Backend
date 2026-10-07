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
router.get('/withdrawals/stats', AdminController.getWithdrawalStats);
router.get('/withdrawals/:id', AdminController.getWithdrawal);
router.post('/withdrawals/:id/investigate', AdminController.flagWithdrawalForReview);
router.post('/withdrawals/:id/approve', AdminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', AdminController.rejectWithdrawal);

// Deposits
router.get('/deposits', AdminController.getDeposits);
router.post('/deposits/:id/approve', AdminController.approveDeposit);
router.post('/deposits/:id/reject', AdminController.rejectDeposit);

// Payment Settings
router.post('/payments/settings', AdminController.updatePaymentSettings);
router.get('/support/settings', AdminController.getSupportSettings);
router.post('/support/settings', AdminController.updateSupportSettings);

// Game review
router.get('/games/review', AdminController.getGamesForReview);
router.post('/games/:id/review', AdminController.reviewGame);

// Wallet actions (manual adjustments etc)
router.use('/wallet', adminWalletRoutes);

export default router;
