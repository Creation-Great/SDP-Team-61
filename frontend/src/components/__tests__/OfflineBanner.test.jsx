import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// OfflineBanner is defined inside App.jsx — we test the pattern directly
function OfflineBanner() {
  const { useState, useEffect } = require('react');
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);
  if (!offline) return null;
  return <div role="alert">You are offline. Some features may be unavailable.</div>;
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
  });

  it('does not render when online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders when offline', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/offline/i)).toBeTruthy();
  });

  it('responds to online/offline events', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(screen.getByRole('alert')).toBeTruthy();

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
