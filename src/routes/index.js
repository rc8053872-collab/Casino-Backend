"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const walletRoutes_1 = __importDefault(require("./walletRoutes"));
const adminRoutes_1 = __importDefault(require("./adminRoutes"));
const gameRoutes_1 = __importDefault(require("./gameRoutes"));
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Casino API is running' });
});
router.use('/wallet', walletRoutes_1.default);
router.use('/admin', adminRoutes_1.default);
router.use('/games', gameRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map