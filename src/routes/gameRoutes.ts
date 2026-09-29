import { Router } from 'express';
import { GameController } from '../controllers/GameController';

const router = Router();

router.get('/catalog', GameController.getCatalog);

// Protected by auth
router.post('/:slug/launch', GameController.launchGame);

// Webhook endpoint (unprotected, verified via headers internally)
router.post('/webhooks/:providerId', GameController.webhook);

export default router;
