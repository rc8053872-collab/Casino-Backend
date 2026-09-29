"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const GameLaunchService_1 = require("../services/games/GameLaunchService");
const GameWebhookService_1 = require("../services/games/GameWebhookService");
const prismaClient_1 = __importDefault(require("../prismaClient"));
class GameController {
    static async getCatalog(req, res, next) {
        try {
            const games = await prismaClient_1.default.game.findMany({
                where: { status: 'ACTIVE' },
                orderBy: { displayOrder: 'asc' }
            });
            res.json(games);
        }
        catch (error) {
            next(error);
        }
    }
    static async launchGame(req, res, next) {
        try {
            const userId = req.user?.id;
            const { slug } = req.params;
            const clientIp = req.ip || '127.0.0.1';
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            if (!slug)
                return res.status(400).json({ error: 'Game slug required' });
            const response = await GameLaunchService_1.GameLaunchService.launchGame(userId, slug, clientIp);
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    static async webhook(req, res, next) {
        try {
            const { providerId } = req.params;
            const payload = {
                rawBody: JSON.stringify(req.body),
                headers: req.headers,
                parsedBody: req.body
            };
            await GameWebhookService_1.GameWebhookService.handleWebhook(providerId, payload);
            res.status(200).send('OK');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.GameController = GameController;
//# sourceMappingURL=GameController.js.map