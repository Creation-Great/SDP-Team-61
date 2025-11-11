import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './db';
import meRouter from './routes/me';
import submissionsRouter from './routes/submissions';
import assignmentsRouter from './routes/assignments';
import assignmentVisibilityRouter from './routes/assignmentVisibility';
import instructorRouter from './routes/instructor';
import reviewsRouter from './routes/reviews';
import { devAuth } from './middleware/auth';
import { 
  correlationIdMiddleware, 
  privacyHashMiddleware, 
  securityHeadersMiddleware,
  validateSecurityConfig 
} from './middleware/privacy';

dotenv.config();

const securityCheck = validateSecurityConfig();
if (!securityCheck.valid) {
  console.warn('⚠️  Security configuration warnings:');
  securityCheck.warnings.forEach(w => console.warn(`   - ${w}`));
}

const app = express();

app.use(correlationIdMiddleware);
app.use(privacyHashMiddleware);
app.use(securityHeadersMiddleware);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use(devAuth);

app.get('/healthz', (_req: any, res: any) => res.json({ ok: true }));

app.use('/me', meRouter);
app.use('/submissions', submissionsRouter);
app.use('/assign', assignmentsRouter);
app.use('/assign', assignmentVisibilityRouter);
app.use('/instructor', instructorRouter);
app.use('/reviews', reviewsRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', detail: String(err?.message || err) });
});

const port = process.env.PORT || 8080;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
