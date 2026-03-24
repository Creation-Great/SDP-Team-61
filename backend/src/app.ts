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

import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/authRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import peerReviewRoutes from './routes/peerReviewRoutes.js';
import checkinRoutes from './routes/checkinRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import rubricRoutes from './routes/rubricRoutes.js';
import assignmentTemplateRoutes from './routes/assignmentTemplateRoutes.js';
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
// In dev mode, also accepts any private-network origin (localhost, 192.168.x.x, etc.)
const allowedOrigins: string[] = (
  process.env.CORS_ORIGINS
  || process.env.FRONTEND_URL
  || 'http://localhost:5173'
).split(',').map((o) => o.trim()).filter(Boolean);

const isDevMode = process.env.NODE_ENV !== 'production';
const privateNetRe = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else if (isDevMode && privateNetRe.test(origin)) {
      // In dev mode, allow any private-network origin (phone on LAN, etc.)
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
// Global: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

// Strict limiter for auth endpoints (login / register / CAS callback)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                    // 100 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many authentication attempts, try again in 15 minutes' },
});

// Upload limiter: 100 uploads per 10 minutes
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
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

// API docs: serve OpenAPI spec and Swagger UI (dev / staging; can be disabled in production via env)
const openApiPath = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
if (fs.existsSync(openApiPath)) {
  app.get('/api-docs/openapi.yaml', (_req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.sendFile(path.resolve(openApiPath));
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
    swaggerOptions: { url: '/api-docs/openapi.yaml' },
    customSiteTitle: 'SDP Peer Review API',
  }));
}

// Health check: liveness (process up) + optional DB connectivity for readiness
app.get('/healthz', async (_req, res) => {
  const out: { ok: boolean; db?: string } = { ok: true };
  if (process.env.DATABASE_URL) {
    try {
      const { pool } = await import('./db.js');
      await pool.query('SELECT 1');
      out.db = 'ok';
    } catch (e) {
      logger.warn({ err: e }, 'Health check: DB ping failed');
      out.ok = false;
      out.db = 'error';
      res.status(503).json(out);
      return;
    }
  }
  res.status(200).json(out);
});

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
app.use('/rubrics', rubricRoutes);
app.use('/assignment-templates', assignmentTemplateRoutes);

// Default error codes by status (used when AppError has no code)
function defaultErrorCode(statusCode: number): string {
  const map: Record<number, string> = {
    400: 'bad_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
  };
  return map[statusCode] ?? 'app_error';
}

// Unified error response shape: { error, message, details? }
// Global error handler — typed, handles AppError, ZodValidationError, and unknown errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    const code = err.code ?? defaultErrorCode(err.statusCode);
    res.status(err.statusCode).json({ error: code, message: err.message });
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
