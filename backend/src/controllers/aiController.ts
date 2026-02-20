import { Response } from 'express';
import type { AuthRequest } from '../types.js';
import { AppError } from '../utils/AppError.js';

/**
 * AI Service URL – the Flask AI micro-service.
 * In Docker: http://ai-service:5001
 * Local dev:  http://localhost:5001
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const AI_API_KEY = process.env.AI_API_KEY || '';

/** Shared headers sent to the AI service. */
function aiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_API_KEY) h['X-AI-API-Key'] = AI_API_KEY;
  return h;
}

// ── POST /api/ai/feedback ───────────────────────────────────
export async function postFeedback(req: AuthRequest, res: Response): Promise<void> {
  const { review_id, text } = req.body ?? {};
  if (!review_id || !text) {
    throw new AppError(400, 'review_id and text are required');
  }

  const resp = await fetch(`${AI_SERVICE_URL}/api/ai/feedback`, {
    method: 'POST',
    headers: aiHeaders(),
    body: JSON.stringify({ review_id, text }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json(data);
    return;
  }
  res.json(data);
}

// ── GET /api/ai/feedback/:reviewId ──────────────────────────
export async function getFeedback(req: AuthRequest, res: Response): Promise<void> {
  const { reviewId } = req.params;

  const resp = await fetch(`${AI_SERVICE_URL}/api/ai/feedback/${reviewId}`, {
    headers: aiHeaders(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json(data);
    return;
  }
  res.json(data);
}

// ── POST /api/ai/rewrite ───────────────────────────────────
export async function postRewrite(req: AuthRequest, res: Response): Promise<void> {
  const { review_id, text, context } = req.body ?? {};
  if (!review_id || !text) {
    throw new AppError(400, 'review_id and text are required');
  }

  const resp = await fetch(`${AI_SERVICE_URL}/api/ai/rewrite`, {
    method: 'POST',
    headers: aiHeaders(),
    body: JSON.stringify({ review_id, text, context }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json(data);
    return;
  }
  res.json(data);
}

// ── GET /api/ai/rewrite/:reviewId ───────────────────────────
export async function getRewrite(req: AuthRequest, res: Response): Promise<void> {
  const { reviewId } = req.params;

  const resp = await fetch(`${AI_SERVICE_URL}/api/ai/rewrite/${reviewId}`, {
    headers: aiHeaders(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json(data);
    return;
  }
  res.json(data);
}

// ── PATCH /api/ai/rewrite/:reviewId/adopt ───────────────────
export async function adoptRewrite(req: AuthRequest, res: Response): Promise<void> {
  const { reviewId } = req.params;

  const resp = await fetch(`${AI_SERVICE_URL}/api/ai/rewrite/${reviewId}/adopt`, {
    method: 'PATCH',
    headers: aiHeaders(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    res.status(resp.status).json(data);
    return;
  }
  res.json(data);
}
