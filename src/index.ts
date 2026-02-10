import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import householdRoutes from './routes/household.js';
import cardRoutes from './routes/cards.js';
import paymentRoutes from './routes/payments.js';
import payoffRoutes from './routes/payoff.js';
import utilizationRoutes from './routes/utilization.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/household', householdRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payoff', payoffRoutes);
app.use('/api/utilization', utilizationRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`WhooPaid server running on port ${PORT}`);
});
