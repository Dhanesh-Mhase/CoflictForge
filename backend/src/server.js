import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, validateEnv } from './config/env.js';
import prisma from './config/prisma.js';
import { securityHeaders } from './middlewares/security.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import repositoryRoutes from './routes/repository.routes.js';

validateEnv();

const app = express();

app.set('trust proxy', 1);

app.use(securityHeaders);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/repositories', repositoryRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`[INFO] Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  console.log(`[INFO] Frontend CORS configured for: ${env.FRONTEND_URL}`);
});

const handleGracefulShutdown = async (signal) => {
  console.log(`\n[INFO] Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[INFO] Prisma database connections closed.');
      process.exit(0);
    } catch (err) {
      console.error('[ERROR] Error during database disconnect:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

export default app;
