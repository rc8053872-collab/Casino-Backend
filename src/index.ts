import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { GameProviderManager } from './providers/game/GameProviderManager';
import { MockProvider } from './providers/game/adapters/MockProvider/MockProvider';

// Register providers
GameProviderManager.registerProvider(new MockProvider());
GameProviderManager.initializeAll().catch(logger.error);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'maltiplayx-api',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api', routes);

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
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
