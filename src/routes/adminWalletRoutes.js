"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AdminWalletController_1 = require("../controllers/AdminWalletController");
const router = (0, express_1.Router)();
// These routes should be protected by admin authentication middleware
router.post('/adjustment', AdminWalletController_1.AdminWalletController.manualAdjustment);
exports.default = router;
//# sourceMappingURL=adminWalletRoutes.js.map