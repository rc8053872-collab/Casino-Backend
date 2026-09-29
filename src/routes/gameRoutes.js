"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GameController_1 = require("../controllers/GameController");
const router = (0, express_1.Router)();
router.get('/catalog', GameController_1.GameController.getCatalog);
// Protected by auth
router.post('/:slug/launch', GameController_1.GameController.launchGame);
// Webhook endpoint (unprotected, verified via headers internally)
router.post('/webhooks/:providerId', GameController_1.GameController.webhook);
exports.default = router;
//# sourceMappingURL=gameRoutes.js.map