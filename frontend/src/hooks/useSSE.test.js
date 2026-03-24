import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSSE from './useSSE';

// Mock config
vi.mock('../config', () => ({ API_BASE_URL: '' }));

// Mock EventSource: hook sets .onopen, .onerror and .addEventListener(name, handler)
const mockAddEventListener = vi.fn();
const mockClose = vi.fn();
let eventSourceInstance = null;

beforeEach(() => {
  vi.useFakeTimers();
  mockAddEventListener.mockClear();
  mockClose.mockClear();
  eventSourceInstance = null;
  window.EventSource = vi.fn(function () {
    const es = {
      addEventListener: (name, handler) => {
        if (name === 'open') es._onopen = handler;
        if (name === 'error') es._onerror = handler;
        mockAddEventListener(name, handler);
      },
      close: mockClose,
      _onopen: null,
      _onerror: null,
    };
    Object.defineProperty(es, 'onopen', {
      get: () => es._onopen,
      set: (f) => { es._onopen = f; },
      configurable: true,
    });
    Object.defineProperty(es, 'onerror', {
      get: () => es._onerror,
      set: (f) => { es._onerror = f; },
      configurable: true,
    });
    eventSourceInstance = es;
    return es;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useSSE', () => {
  it('opens EventSource with correct url when enabled', () => {
    renderHook(() => useSSE('/instructor/events', { enabled: true }));
    expect(window.EventSource).toHaveBeenCalledWith('/instructor/events', { withCredentials: true });
  });

  it('does not open EventSource when url is null', () => {
    renderHook(() => useSSE(null, { enabled: true }));
    expect(window.EventSource).not.toHaveBeenCalled();
  });

  it('does not open EventSource when enabled is false', () => {
    renderHook(() => useSSE('/instructor/events', { enabled: false }));
    expect(window.EventSource).not.toHaveBeenCalled();
  });

  it('returns connected false initially then true after onopen', () => {
    const { result } = renderHook(() => useSSE('/instructor/events'));
    expect(result.current.connected).toBe(false);
    act(() => {
      if (eventSourceInstance && eventSourceInstance._onopen) {
        eventSourceInstance._onopen();
      }
    });
    expect(result.current.connected).toBe(true);
  });

  it('registers listeners for submission_created, review_submitted, peer_review_submitted', () => {
    renderHook(() => useSSE('/instructor/events'));
    expect(mockAddEventListener).toHaveBeenCalledWith('submission_created', expect.any(Function));
    expect(mockAddEventListener).toHaveBeenCalledWith('review_submitted', expect.any(Function));
    expect(mockAddEventListener).toHaveBeenCalledWith('peer_review_submitted', expect.any(Function));
  });

  it('calls onEvent when named event is received', () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE('/instructor/events', { onEvent }));
    const calls = mockAddEventListener.mock.calls.filter((c) => c[0] === 'submission_created');
    expect(calls.length).toBe(1);
    const handler = calls[0][1];
    handler({ data: JSON.stringify({ student_name: 'Alice' }) });
    expect(onEvent).toHaveBeenCalledWith('submission_created', { student_name: 'Alice' });
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSE('/instructor/events'));
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });
});
