import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

/** Safe localStorage accessors — avoid hard-crash in private / incognito modes */
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode / quota */ }
}

export default function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = safeGet('theme');
    return stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      safeSet('theme', 'dark');
    } else {
      root.classList.remove('dark');
      safeSet('theme', 'light');
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600" />}
    </button>
  );
}
