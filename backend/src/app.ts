import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttpModule from 'pino-http';
import { logger } from './utils/logger.js';

// pino-http may export default or named depending on ESM interop
const pinoHttp = ('default' in pinoHttpModule ? (pinoHttpModule as any).default : pinoHttpModule) as typeof import('pino-http').default;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { AppError } from './utils/AppError.js';
import { ZodValidationError } from './middleware/validate.js';

import authRoutes from './routes/authRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import peerReviewRoutes from './routes/peerReviewRoutes.js';
import checkinRoutes from './routes/checkinRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { authenticate } from './middleware/auth.js';
import { h } from './utils/asyncHandler.js';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — supports comma-separated CORS_ORIGINS env var for multiple front-end domains.
// Falls back to FRONTEND_URL (single origin) or localhost dev default.
const allowedOrigins: string[] = (
  process.env.CORS_ORIGINS
  || process.env.FRONTEND_URL
  || 'http://localhost:5173'
).split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => (req as any).url === '/healthz' } }));

// ── Rate limiting ──
// Global: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

// Strict limiter for auth endpoints (login / register / CAS callback)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 30,                     // 30 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many authentication attempts, try again in 15 minutes' },
});

// Upload limiter: 20 uploads per 10 minutes
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Upload rate limit exceeded' },
});

// ── Authenticated file downloads ──
// Files are no longer served as public static assets.
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

app.get('/uploads/:filename', h(authenticate), (req, res) => {
  // Sanitise: strip path-traversal characters
  const raw = req.params.filename;
  const filename = path.basename(Array.isArray(raw) ? raw[0] : raw);
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'not_found', message: 'File not found' });
    return;
  }

  // Content-Disposition: inline so browsers can preview PDFs, etc.
  res.sendFile(path.resolve(filePath));
});

// Health check
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/submissions', uploadLimiter, submissionRoutes);
app.use('/reviews', reviewRoutes);
app.use('/instructor', instructorRoutes);
app.use('/peer-review', peerReviewRoutes);
app.use('/checkins', checkinRoutes);
app.use('/enrollments', enrollmentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/notifications', notificationRoutes);

// Global error handler — typed, handles AppError, ZodValidationError, and unknown errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: 'app_error', message: err.message });
    return;
  }

  if (err instanceof ZodValidationError) {
    res.status(400).json({
      error: 'validation',
      message: err.message,
      details: err.zodError.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : message,
  });
});

export default app;
