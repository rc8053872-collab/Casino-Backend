"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
require("dotenv/config");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const GameProviderManager_1 = require("./providers/game/GameProviderManager");
const MockProvider_1 = require("./providers/game/adapters/MockProvider/MockProvider");
// Register providers
GameProviderManager_1.GameProviderManager.registerProvider(new MockProvider_1.MockProvider());
GameProviderManager_1.GameProviderManager.initializeAll().catch(logger_1.logger.error);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api', routes_1.default);
app.get('/', (req, res) => {
    res.send(`
    <html>
      <head>
        <title>OrbitPlay Casino API</title>
        <style>
          body { background-color: #060817; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          h1 { color: #f5b83d; }
          p { color: #8b92b2; }
        </style>
      </head>
      <body>
        <h1>🎲 OrbitPlay Casino API is Running!</h1>
        <p>The backend server is online and securely listening for connections.</p>
        <p>Access the main application via the frontend URL.</p>
      </body>
    </html>
  `);
});
// Error Handling
app.use(errorHandler_1.errorHandler);
// Start Server
app.listen(PORT, () => {
    logger_1.logger.info(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map