import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './db';
import meRouter from './routes/me';
import submissionsRouter from './routes/submissions';
import assignmentsRouter from './routes/assignments';
import instructorRouter from './routes/instructor';
import reviewsRouter from './routes/reviews';
import { devAuth } from './middleware/auth';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Dev-only header-based auth; replace with CAS/JWT gateway in prod
app.use(devAuth);

app.get('/healthz', (_req: any, res: any) => res.json({ ok: true }));

app.use('/me', meRouter);
app.use('/submissions', submissionsRouter);
app.use('/assign', assignmentsRouter);
app.use('/instructor', instructorRouter);
app.use('/reviews', reviewsRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', detail: String(err?.message || err) });
});

// Only start server when not running tests
const port = process.env.PORT || 8080;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
