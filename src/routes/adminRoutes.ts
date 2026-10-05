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

// Deposits
router.get('/deposits', AdminController.getDeposits);
router.post('/deposits/:id/approve', AdminController.approveDeposit);
router.post('/deposits/:id/reject', AdminController.rejectDeposit);

// Payment Settings
router.post('/payments/settings', AdminController.updatePaymentSettings);

// Wallet actions (manual adjustments etc)
router.use('/wallet', adminWalletRoutes);

export default router;
