/**
 * Reusable search text input with debounce feel.
 *
 * Props:
 *   value       – current query string
 *   onChange     – (string) => void
 *   placeholder  – input placeholder
 *   className    – extra wrapper className
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}) {
  return (
    <div className={`search-input-wrapper ${className}`}>
      <span className="search-input-icon" aria-hidden>🔍</span>
      <input
        type="text"
        className="form-input search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          className="search-input-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
