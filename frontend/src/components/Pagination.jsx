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

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        {filtered === total
          ? `${total} ${noun}`
          : `${filtered} of ${total} ${noun}`}
      </span>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="btn btn-sm btn-secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ‹ Prev
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="pagination-ellipsis">…</span>
            ) : (
              <button
                key={p}
                className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ),
          )}

          <button
            className="btn btn-sm btn-secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next ›
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
