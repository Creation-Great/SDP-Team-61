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
      // Move focus to the newly selected radio button
      const container = e.currentTarget.parentElement;
      const buttons = container?.querySelectorAll('[role="radio"]');
      buttons?.[next - 1]?.focus();
    }
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      {label && <label className="form-label">{label}</label>}
      <div
        role="radiogroup"
        aria-label={label || 'Score selection'}
        style={{ display: 'flex', gap: '8px' }}
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
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              border: value === n ? '2px solid var(--primary)' : '1px solid var(--glass-border, #ccc)',
              background: value === n ? 'var(--primary)' : 'var(--glass-bg, #f5f5f5)',
              color: value === n ? '#fff' : 'var(--text-secondary, #555)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
