import { useState, useEffect } from 'react';

/** Safe localStorage getter — returns null in private browsing mode */
function safeGetItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export default function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = safeGetItem('theme');
    return stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch { /* private mode */ }
    } else {
      root.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch { /* private mode */ }
    }
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);
  return [isDark, toggle];
}
