import { useState, useEffect } from 'react';

const SIZES = [
  { key: 'sm', label: 'S', value: '14px' },
  { key: 'md', label: 'M', value: '16px' },
  { key: 'lg', label: 'L', value: '18px' },
];

export default function FontSizeSelector() {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return 'md';
    return localStorage.getItem('fontSize') || 'md';
  });

  useEffect(() => {
    const size = SIZES.find(s => s.key === active);
    if (size) {
      document.documentElement.style.setProperty('--font-size-base', size.value);
      localStorage.setItem('fontSize', active);
    }
  }, [active]);

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5" role="radiogroup" aria-label="Font size">
      {SIZES.map(size => (
        <button
          key={size.key}
          onClick={() => setActive(size.key)}
          role="radio"
          aria-checked={active === size.key}
          className={`
            px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${active === size.key
              ? 'bg-white text-[#000E2F] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
            }
          `}
        >
          {size.label}
        </button>
      ))}
    </div>
  );
}
