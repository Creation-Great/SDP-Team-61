import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE_URL } from '../config';

/**
 * React hook for Server-Sent Events (SSE).
 *
 * Automatically reconnects on error with exponential back-off.
 * Cleans up the EventSource when the component unmounts or the URL changes.
 *
 * @param {string|null} url   – SSE endpoint path (e.g. '/instructor/events')
 * @param {Object}      opts
 * @param {function}    opts.onEvent – called with (eventName, parsedData)
 * @param {boolean}     [opts.enabled=true] – set to false to disable
 * @returns {{ connected: boolean }}
 */
export default function useSSE(url, { onEvent, enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const retriesRef = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!url || !enabled) return;

    const fullUrl = `${API_BASE_URL}${url}`;
    const es = new EventSource(fullUrl, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    // Named events from backend (submission_created, review_submitted, etc.)
    const events = [
      'submission_created',
      'review_submitted',
      'peer_review_submitted',
    ];
    events.forEach((name) => {
      es.addEventListener(name, (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current?.(name, data);
        } catch { /* ignore parse errors */ }
      });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect with exponential back-off (max 30 s)
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
      retriesRef.current += 1;
      setTimeout(connect, delay);
    };
  }, [url, enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [connect]);

  return { connected };
}
