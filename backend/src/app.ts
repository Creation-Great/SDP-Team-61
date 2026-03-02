import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import meRoutes from './routes/meRoutes.js';

dotenv.config();

const app = express();

// Security & parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/assignments', reviewRoutes);
app.use('/me', meRoutes);

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : String(err?.message || err),
  });
});

export default app;
