import { Response } from 'express';
import type { AuthRequest } from '../types.js';
import { AppError } from '../utils/AppError.js';
import { withDb } from '../db.js';
import { createNotification } from '../utils/notifications.js';
import { logger } from '../utils/logger.js';

/**
 * AI Service URL – the Flask AI micro-service.
 * In Docker: http://ai-service:5001
 * Local dev:  http://localhost:5001
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const AI_API_KEY = process.env.AI_API_KEY || '';

/** Timeout for AI service calls (15 seconds). */
const AI_TIMEOUT_MS = 15_000;

/** Shared headers sent to the AI service. */
function aiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_API_KEY) h['X-AI-API-Key'] = AI_API_KEY;
  return h;
}

/**
 * Fetch wrapper with timeout and structured error handling for AI service calls.
 * Throws AppError on timeout, network failure, or non-OK responses.
 */
async function aiFetch(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data as { message?: string })?.message || 'AI service error';
      throw new AppError(resp.status, msg);
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new AppError(504, 'AI service request timed out');
    }
    logger.error({ err, url }, 'AI service call failed');
    throw new AppError(502, 'AI service is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyAiComplete(req: AuthRequest, title: string, body: string, link?: string): Promise<void> {
  const user = req.user;
  if (!user?.user_id) return;
  try {
    await withDb(user.user_id, user.role, async (client) => {
      await createNotification(client, {
        userId: user.user_id,
        type: 'ai_complete',
        title,
        body,
        link,
      });
    });
  } catch {
    // Non-blocking: AI response should not fail due to notification write errors
  }
}

// ── POST /api/ai/feedback ───────────────────────────────────
export async function postFeedback(req: AuthRequest, res: Response): Promise<void> {
  const { review_id, text } = req.body;

  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/feedback`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify({ review_id, text }),
  });
  await notifyAiComplete(req, 'AI feedback is ready', 'Your AI feedback analysis has completed.', '/assigned-reviews');
  res.json(data);
}

// ── GET /api/ai/feedback/:reviewId ──────────────────────────
export async function getFeedback(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/feedback/${req.params.reviewId}`, { headers: aiHeaders() });
  res.json(data);
}

// ── POST /api/ai/rewrite ───────────────────────────────────
export async function postRewrite(req: AuthRequest, res: Response): Promise<void> {
  const { review_id, text, context } = req.body;

  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/rewrite`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify({ review_id, text, context }),
  });
  res.json(data);
}

// ── GET /api/ai/rewrite/:reviewId ───────────────────────────
export async function getRewrite(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/rewrite/${req.params.reviewId}`, { headers: aiHeaders() });
  res.json(data);
}

// ── PATCH /api/ai/rewrite/:reviewId/adopt ───────────────────
export async function adoptRewrite(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/rewrite/${req.params.reviewId}/adopt`, {
    method: 'PATCH', headers: aiHeaders(),
  });
  res.json(data);
}

// ── POST /api/ai/polish ────────────────────────────────────
export async function postPolish(req: AuthRequest, res: Response): Promise<void> {
  const { text } = req.body;

  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/polish`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify({ text, user_id: req.user?.user_id }),
  });
  await notifyAiComplete(req, 'AI polish is ready', 'Your AI polish result has completed.');
  res.json(data);
}

// ── POST /api/ai/summarize ─────────────────────────────────
export async function postSummarize(req: AuthRequest, res: Response): Promise<void> {
  const { reviews } = req.body;

  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/summarize`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify({ reviews, user_id: req.user?.user_id }),
  });
  await notifyAiComplete(req, 'AI summary is ready', 'Your AI summary has completed.');
  res.json(data);
}

// ── GET /api/ai/logs ────────────────────────────────────────
export async function getAiLogs(req: AuthRequest, res: Response): Promise<void> {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/logs?limit=${limit}`, { headers: aiHeaders() });
  res.json(data);
}

// ── GET /api/ai/search ──────────────────────────────────────
export async function getSearch(req: AuthRequest, res: Response): Promise<void> {
  const q = String(req.query.q || '').trim();
  if (!q) throw new AppError(400, 'Search query (q) is required');

  const data = await aiFetch(`${AI_SERVICE_URL}/api/search?q=${encodeURIComponent(q)}`, { headers: aiHeaders() });
  res.json(data);
}

// ── POST /api/ai/review-depth ──────────────────────────────
export async function postReviewDepth(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/review-depth`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify(req.body),
  });
  res.json(data);
}

// ── POST /api/ai/score-suggestion ──────────────────────────
export async function postScoreSuggestion(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/score-suggestion`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify(req.body),
  });
  res.json(data);
}

// ── POST /api/ai/calibration ───────────────────────────────
export async function postCalibration(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/calibration`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify(req.body),
  });
  res.json(data);
}

// ── POST /api/ai/score-reasoning ───────────────────────────
export async function postScoreReasoning(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/score-reasoning`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify(req.body),
  });
  res.json(data);
}

// ── POST /api/ai/similarity ────────────────────────────────
export async function postSimilarity(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/similarity`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify(req.body),
  });
  res.json(data);
}

// ── POST /api/ai/similarity/turnitin ───────────────────────
export async function postSimilarityTurnitin(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/similarity/turnitin`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify(req.body),
  });
  res.json(data);
}

// ── POST /api/ai/chat ──────────────────────────────────────
export async function postChat(req: AuthRequest, res: Response): Promise<void> {
  const data = await aiFetch(`${AI_SERVICE_URL}/api/ai/chat`, {
    method: 'POST', headers: aiHeaders(), body: JSON.stringify({ ...req.body, user_id: req.user?.user_id }),
  });
  res.json(data);
}
