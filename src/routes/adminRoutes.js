"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AdminController_1 = require("../controllers/AdminController");
const adminWalletRoutes_1 = __importDefault(require("./adminWalletRoutes"));
const router = (0, express_1.Router)();
// Dashboard Metrics
router.get('/dashboard', AdminController_1.AdminController.getDashboardMetrics);
// Users
router.get('/users', AdminController_1.AdminController.getUsers);
// Withdrawals
router.get('/withdrawals', AdminController_1.AdminController.getWithdrawals);
// Wallet actions (manual adjustments etc)
router.use('/wallet', adminWalletRoutes_1.default);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map