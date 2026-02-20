/**
 * Reusable Badge pill component.
 *
 * Types: success | warning | error | info | default
 */
export default function Badge({ children, type = 'default' }) {
  const types = {
    success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200',
    error: 'bg-red-100 text-red-700 border border-red-200',
    info: 'bg-blue-100 text-blue-700 border border-blue-200',
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${types[type] || types.default}`}
    >
      {children}
    </span>
  );
}
