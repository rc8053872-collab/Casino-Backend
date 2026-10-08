import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import adminWalletRoutes from './adminWalletRoutes';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.use(requireAuth, requireAdmin);

// Dashboard Metrics
router.get('/dashboard', AdminController.getDashboardMetrics);
router.get('/dashboard/transactions', AdminController.getDashboardTransactions);
router.get('/dashboard/activity', AdminController.getDashboardActivity);
router.get('/dashboard/financial', AdminController.getDashboardFinancial);

// Active Players
router.get('/players/active', AdminController.getActivePlayers);
router.get('/players/active/stats', AdminController.getActivePlayerStats);
router.get('/players/active/:id/activity', AdminController.getPlayerActivity);
router.get('/players/active/:id/heartbeat', AdminController.getPlayerHeartbeat);
router.post('/players/active/:id/end-session', AdminController.endPlayerSession);

// Users
router.get('/users', AdminController.getUsers);
router.patch('/users/:id/status', AdminController.updateUserStatus);


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
router.post('/games', AdminController.createGame);
router.get('/games/review', AdminController.getGamesForReview);
router.post('/games/:id/review', AdminController.reviewGame);
router.patch('/games/:id', AdminController.updateGame);
router.patch('/games/:id/status', AdminController.updateGameStatus);
router.delete('/games/:id', AdminController.deleteGame);

// Providers
router.get('/providers', AdminController.getProviders);

// Wallet actions (manual adjustments etc)
router.use('/wallet', adminWalletRoutes);

export default router;
