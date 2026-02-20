import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable pagination controls.
 *
 * Props:
 *   page       – current page (1-based)
 *   totalPages – total number of pages
 *   onPageChange – (pageNumber) => void
 *   filtered   – number of items after filter
 *   total      – total items before filter
 *   noun       – item label, e.g. "submissions" (default "items")
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  filtered,
  total,
  noun = 'items',
}) {
  if (totalPages <= 1 && filtered === total) return null;

  const pages = buildPageNumbers(page, totalPages);

  const btnBase = 'inline-flex items-center justify-center h-9 min-w-[36px] px-2 rounded-lg text-sm font-medium transition-colors';
  const btnActive = `${btnBase} bg-indigo-600 text-white shadow-sm`;
  const btnInactive = `${btnBase} bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mt-5 pt-4 border-t border-slate-100">
      <span className="text-sm text-slate-500">
        {filtered === total
          ? `${total} ${noun}`
          : `${filtered} of ${total} ${noun}`}
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className={btnInactive}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-slate-400">…</span>
            ) : (
              <button
                key={p}
                className={p === page ? btnActive : btnInactive}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ),
          )}

          <button
            className={btnInactive}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Build an array of page numbers with ellipsis, e.g. [1, 2, '…', 9, 10]
 */
function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('…');
    }
    result.push(sorted[i]);
  }
  return result;
}
