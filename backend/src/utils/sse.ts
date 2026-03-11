import type { Response } from 'express';
import { logger } from './logger.js';

/**
 * Lightweight Server-Sent Events (SSE) hub.
 *
 * Channels are arbitrary strings – callers decide the granularity:
 *   - `course:{courseId}`    — all events for a course
 *   - `session:{sessionId}` — peer-review session events
 *   - `global`              — system-wide broadcasts
 *
 * Ported from anish-dev's SSE utility, adapted for the integrated
 * channel-based domain model.
 */

// channel → set of connected SSE Response objects
const clients = new Map<string, Set<Response>>();

/**
 * Register an SSE client for a given channel.
 * Automatically cleans up when the connection closes.
 */
export function addSseClient(channel: string, res: Response): void {
  if (!clients.has(channel)) {
    clients.set(channel, new Set());
  }
  clients.get(channel)!.add(res);

  res.on('close', () => {
    clients.get(channel)?.delete(res);
    if (clients.get(channel)?.size === 0) {
      clients.delete(channel);
    }
  });

  logger.debug({ channel, count: clients.get(channel)!.size }, 'SSE client connected');
}

/**
 * Broadcast an SSE event to every client subscribed to `channel`.
 */
export function emitSseEvent(channel: string, event: string, data: unknown): void {
  const set = clients.get(channel);
  if (!set || set.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }

  logger.debug({ channel, event, listeners: set.size }, 'SSE event emitted');
}

/**
 * Get the number of connected clients for a channel (useful for diagnostics).
 */
export function getSseClientCount(channel: string): number {
  return clients.get(channel)?.size ?? 0;
}
