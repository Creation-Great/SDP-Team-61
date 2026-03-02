import type { Response } from 'express';

// Map from weekId -> Set of connected SSE Response objects
const clients = new Map<string, Set<Response>>();

/**
 * Register an SSE client for a given week.
 * Automatically removes the client when the connection closes.
 */
export function addSseClient(weekId: string, res: Response): void {
  if (!clients.has(weekId)) {
    clients.set(weekId, new Set());
  }
  clients.get(weekId)!.add(res);

  res.on('close', () => {
    const set = clients.get(weekId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        clients.delete(weekId);
      }
    }
  });
}

/**
 * Emit an SSE event to all clients subscribed to a given week.
 */
export function emitSseEvent(weekId: string, event: string, data: unknown): void {
  const set = clients.get(weekId);
  if (!set || set.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected mid-write — will be cleaned up on 'close'
    }
  }
}
