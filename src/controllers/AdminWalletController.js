"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminWalletController = void 0;
const WalletService_1 = require("../services/WalletService");
const uuid_1 = require("uuid");
class AdminWalletController {
    static async manualAdjustment(req, res, next) {
        try {
            const { walletId, amount, type, description } = req.body;
            const adminId = req.user?.id; // Assumes admin auth middleware
            if (!walletId || !amount) {
                return res.status(400).json({ error: 'walletId and amount are required' });
            }
            const idempotencyKey = `admin-adj-${(0, uuid_1.v4)()}`;
            let tx;
            if (type === 'CREDIT') {
                tx = await WalletService_1.WalletService.deposit(walletId, amount, idempotencyKey, `admin-${adminId}`, description || 'Manual admin credit');
            }
            else if (type === 'DEBIT') {
                tx = await WalletService_1.WalletService.withdraw(walletId, amount, idempotencyKey, `admin-${adminId}`, description || 'Manual admin debit');
            }
            else {
                return res.status(400).json({ error: 'Invalid adjustment type' });
            }
            res.json(tx);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AdminWalletController = AdminWalletController;
//# sourceMappingURL=AdminWalletController.js.map