"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const prismaClient_1 = __importDefault(require("../prismaClient"));
class AdminController {
    static async getDashboardMetrics(req, res, next) {
        try {
            const [totalUsers, activeUsers, totalDeposits, totalWithdrawals, pendingWithdrawals, activeGames] = await Promise.all([
                prismaClient_1.default.user.count(),
                prismaClient_1.default.user.count({ where: { status: 'ACTIVE' } }),
                prismaClient_1.default.transaction.aggregate({
                    where: { type: 'DEPOSIT', status: 'COMPLETED' },
                    _sum: { amount: true }
                }),
                prismaClient_1.default.transaction.aggregate({
                    where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
                    _sum: { amount: true }
                }),
                prismaClient_1.default.transaction.count({
                    where: { type: 'WITHDRAWAL', status: 'PENDING' }
                }),
                prismaClient_1.default.game.count({ where: { status: 'ACTIVE' } })
            ]);
            res.json({
                totalUsers,
                activeUsers,
                totalDeposits: totalDeposits._sum.amount || 0,
                totalWithdrawals: totalWithdrawals._sum.amount || 0,
                pendingWithdrawals,
                activeGames
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getUsers(req, res, next) {
        try {
            const users = await prismaClient_1.default.user.findMany({
                select: {
                    id: true,
                    username: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    wallet: {
                        select: { balance: true, currency: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            res.json(users);
        }
        catch (error) {
            next(error);
        }
    }
    static async getWithdrawals(req, res, next) {
        try {
            const withdrawals = await prismaClient_1.default.transaction.findMany({
                where: { type: 'WITHDRAWAL' },
                include: {
                    wallet: {
                        include: { user: { select: { username: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
            res.json(withdrawals);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=AdminController.js.map