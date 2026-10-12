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

const handleHealthCheck = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'OK',
    service: 'maltiplayx-api',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', handleHealthCheck);
app.get('/ping', handleHealthCheck);
app.get('/api/health', handleHealthCheck);
app.get('/api/ping', handleHealthCheck);

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

  // Automated 10-minute keep-alive self-ping (runs all the time to keep server alive)
  const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes (600,000 ms)
  const targetBase = (process.env.SERVER_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  const pingUrl = `${targetBase}/health`;

  logger.info(`[KeepAlive] 10-minute server ping service initialized targeting: ${pingUrl}`);

  setInterval(async () => {
    try {
      const response = await fetch(pingUrl);
      if (response.ok) {
        logger.info(`[KeepAlive] 10-minute ping OK at ${new Date().toLocaleTimeString()} (status: ${response.status})`);
      } else {
        logger.warn(`[KeepAlive] 10-minute ping returned status ${response.status}`);
      }
    } catch (err: any) {
      logger.warn(`[KeepAlive] 10-minute ping error: ${err?.message || err}`);
    }
  }, KEEP_ALIVE_INTERVAL);
});
