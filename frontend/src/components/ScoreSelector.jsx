/**
 * Reusable 1–5 score selector button row.
 *
 * Props:
 *   value    – currently selected score (1-5 | null)
 *   onChange – (number) => void
 *   label    – optional label text displayed above the buttons
 *   disabled – disables interaction and dims the buttons
 *   max      – highest score (default 5)
 */
export default function ScoreSelector({ value, onChange, label, disabled = false, max = 5 }) {
  const scores = Array.from({ length: max }, (_, i) => i + 1);

  const handleKeyDown = (e, n) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = n < max ? n + 1 : 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = n > 1 ? n - 1 : max;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(n);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      if (!disabled) onChange(next);
      const container = e.currentTarget.parentElement;
      const buttons = container?.querySelectorAll('[role="radio"]');
      buttons?.[next - 1]?.focus();
    }
  };

  return (
    <div className="mb-3">
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <div
        role="radiogroup"
        aria-label={label || 'Score selection'}
        className="flex gap-2"
      >
        {scores.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`Score ${n}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            onClick={() => !disabled && onChange(n)}
            onKeyDown={(e) => handleKeyDown(e, n)}
            disabled={disabled}
            className={`w-11 h-11 rounded-xl font-semibold text-base transition-all duration-200 ${
              value === n
                ? 'bg-indigo-600 text-white border-2 border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
            } ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
