import { useMemo, useState } from 'react';

/**
 * Generic hook for client-side search, filter, sort and pagination.
 *
 * @param {Array}    items           – full data array
 * @param {Object}   options
 * @param {Function} options.searchKeys  – (item) => string[]  fields to search
 * @param {number}   options.pageSize    – items per page (default 10)
 * @param {Function} [options.filterFn]  – (item, filters) => boolean
 * @param {Function} [options.sortFn]    – (a, b) => number  (applied after filter)
 *
 * @returns {{ query, setQuery, filters, setFilters,
 *             page, setPage, pageSize, totalPages,
 *             pageItems, filtered, total }}
 */
export default function useFilteredList(items, {
  searchKeys = () => [],
  pageSize = 10,
  filterFn,
  sortFn,
} = {}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);

  /* ── Filter + search ── */
  const filtered = useMemo(() => {
    let result = items ?? [];

    // Custom filter
    if (filterFn) {
      result = result.filter((item) => filterFn(item, filters));
    }

    // Text search
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => {
        const fields = searchKeys(item);
        return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
      });
    }

    // Sort
    if (sortFn) {
      result = [...result].sort(sortFn);
    }

    return result;
  }, [items, query, filters, filterFn, sortFn, searchKeys]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  // Reset to page 1 when query/filters change
  const setQueryAndReset = (v) => { setQuery(v); setPage(1); };
  const setFiltersAndReset = (v) => { setFilters(v); setPage(1); };

  return {
    query,
    setQuery: setQueryAndReset,
    filters,
    setFilters: setFiltersAndReset,
    page: safePage,
    setPage,
    pageSize,
    totalPages,
    pageItems,
    filtered,
    total: (items ?? []).length,
  };
}
