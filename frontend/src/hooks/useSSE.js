import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE_URL } from '../config';

/**
 * React hook for Server-Sent Events (SSE).
 *
 * Automatically reconnects on error with exponential back-off.
 * Cleans up the EventSource when the component unmounts or the URL changes.
 *
 * Authentication: With same-origin (e.g. Vite proxy or nginx), the browser sends
 * httpOnly cookie via withCredentials. For cross-origin SSE, pass getToken to append
 * JWT to the URL; backend supports ?token= for EventSource.
 *
 * @param {string|null} url   – SSE endpoint path (e.g. '/instructor/events')
 * @param {Object}      opts
 * @param {function(eventName: string, data: Object): void} opts.onEvent – called with (eventName, parsedData)
 * @param {boolean}     [opts.enabled=true] – set to false to disable
 * @param {function(): string | Promise<string>} [opts.getToken] – optional; if provided, append ?token=… to URL for cross-origin auth
 * @returns {{ connected: boolean }}
 */
export default function useSSE(url, { onEvent, enabled = true, getToken } = {}) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const connectRef = useRef(null);
  const retriesRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!url || !enabled) return;

    let fullUrl = `${API_BASE_URL}${url}`;
    if (typeof getToken === 'function') {
      try {
        const token = typeof getToken() === 'string' ? getToken() : '';
        if (token) {
          fullUrl += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
        }
      } catch { /* ignore */ }
    }
    const es = new EventSource(fullUrl, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    // Named events from backend (submission_created, review_submitted, heartbeat, etc.)
    const lastMessageAtRef = { current: Date.now() };
    const silenceCheckIntervalMs = 30_000;
    const silenceThresholdMs = 90_000; // 3x backend heartbeat interval

    const onAnyMessage = () => {
      lastMessageAtRef.current = Date.now();
    };

    const events = [
      'submission_created',
      'review_submitted',
      'peer_review_submitted',
      'heartbeat',
    ];
    events.forEach((name) => {
      es.addEventListener(name, (e) => {
        onAnyMessage();
        if (name === 'heartbeat') return;
        try {
          const data = JSON.parse(e.data);
          onEventRef.current?.(name, data);
        } catch { /* ignore parse errors */ }
      });
    });

    silenceTimerRef.current = setInterval(() => {
      if (!esRef.current || Date.now() - lastMessageAtRef.current <= silenceThresholdMs) return;
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setConnected(false);
      es.close();
      esRef.current = null;
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
      retriesRef.current += 1;
      setTimeout(() => connectRef.current?.(), delay);
    }, silenceCheckIntervalMs);

    es.onerror = () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setConnected(false);
      es.close();
      esRef.current = null;
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
      retriesRef.current += 1;
      setTimeout(() => connectRef.current?.(), delay);
    };
  }, [url, enabled, getToken]);

  useEffect(() => {
    connectRef.current = connect;
    connect();
    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [connect]);

  return { connected };
}
