import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

const router = Router();

// These routes should be protected by an authentication middleware
router.get('/balance', WalletController.getBalance);
router.get('/transactions', WalletController.getTransactions);
router.post('/deposit', WalletController.deposit);
router.post('/withdraw', WalletController.withdraw);

export default router;
