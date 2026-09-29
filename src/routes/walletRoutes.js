"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WalletController_1 = require("../controllers/WalletController");
const router = (0, express_1.Router)();
// These routes should be protected by an authentication middleware
router.get('/balance', WalletController_1.WalletController.getBalance);
router.get('/transactions', WalletController_1.WalletController.getTransactions);
router.post('/deposit', WalletController_1.WalletController.deposit);
router.post('/withdraw', WalletController_1.WalletController.withdraw);
exports.default = router;
//# sourceMappingURL=walletRoutes.js.map