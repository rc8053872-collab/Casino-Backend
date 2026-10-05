import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();

// These routes should be protected by an authentication middleware
router.get('/balance', WalletController.getBalance);
router.get('/transactions', WalletController.getTransactions);

router.get('/settings', PaymentController.getPaymentSettings);
router.post('/deposit', PaymentController.submitDeposit);
router.post('/withdraw', WalletController.withdraw);

export default router;
