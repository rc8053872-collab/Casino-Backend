import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { PaymentController } from '../controllers/PaymentController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/settings', PaymentController.getPaymentSettings);

router.use(requireAuth);
router.get('/balance', WalletController.getBalance);
router.get('/transactions', WalletController.getTransactions);

router.post('/deposit', PaymentController.submitDeposit);
router.post('/withdraw', WalletController.withdraw);

export default router;
