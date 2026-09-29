"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameTransactionService = void 0;
const prismaClient_1 = __importDefault(require("../../prismaClient"));
const WalletService_1 = require("../WalletService");
const client_1 = require("@prisma/client");
class GameTransactionService {
    /**
     * Safe transaction processor used by Webhooks and game results.
     * Leverages WalletService for idempotency and atomic updates.
     */
    static async processProviderTransaction(req) {
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: req.userId },
            include: { wallet: true }
        });
        if (!user || !user.wallet)
            throw new Error('User/Wallet not found');
        const walletId = user.wallet.id;
        // We must fetch or create a GameHistory round
        let round = await prismaClient_1.default.gameHistory.findFirst({
            where: { roundId: req.roundId, gameId: req.gameId }
        });
        if (!round) {
            round = await prismaClient_1.default.gameHistory.create({
                data: {
                    userId: req.userId,
                    gameId: req.gameId,
                    roundId: req.roundId,
                    betAmount: 0,
                    winAmount: 0,
                    status: client_1.RoundStatus.OPEN,
                    providerRef: req.transactionId,
                }
            });
        }
        // Now delegate to WalletService using the provider transaction id as idempotency key
        let walletTx;
        if (req.type === 'BET') {
            walletTx = await WalletService_1.WalletService.debitForBet(walletId, req.amount, req.transactionId, round.id, `Bet for game ${req.gameId}`);
            // Update round info
            await prismaClient_1.default.gameHistory.update({
                where: { id: round.id },
                data: { betAmount: { increment: req.amount } }
            });
        }
        else if (req.type === 'WIN') {
            walletTx = await WalletService_1.WalletService.creditWin(walletId, req.amount, req.transactionId, round.id, `Win for game ${req.gameId}`);
            // Close round and update win amount
            await prismaClient_1.default.gameHistory.update({
                where: { id: round.id },
                data: { winAmount: { increment: req.amount }, status: client_1.RoundStatus.RESOLVED }
            });
        }
        else if (req.type === 'REFUND') {
            walletTx = await WalletService_1.WalletService.refund(walletId, req.amount, req.transactionId, req.transactionId, `Refund for game ${req.gameId}`);
            await prismaClient_1.default.gameHistory.update({
                where: { id: round.id },
                data: { status: client_1.RoundStatus.CANCELLED }
            });
        }
        return walletTx;
    }
}
exports.GameTransactionService = GameTransactionService;
//# sourceMappingURL=GameTransactionService.js.map