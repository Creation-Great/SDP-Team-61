import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useFilteredList from './useFilteredList';

describe('useFilteredList', () => {
  const items = [
    { id: 1, name: 'Alice', role: 'student' },
    { id: 2, name: 'Bob', role: 'instructor' },
    { id: 3, name: 'Carol', role: 'student' },
  ];

  it('returns all items on first page when pageSize is large', () => {
    const { result } = renderHook(() =>
      useFilteredList(items, { searchKeys: (i) => [i.name], pageSize: 10 })
    );
    expect(result.current.pageItems).toHaveLength(3);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.total).toBe(3);
  });

  it('paginates when pageSize is small', () => {
    const { result } = renderHook(() =>
      useFilteredList(items, { searchKeys: (i) => [i.name], pageSize: 2 })
    );
    expect(result.current.pageItems).toHaveLength(2);
    expect(result.current.pageItems[0].name).toBe('Alice');
    expect(result.current.totalPages).toBe(2);
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toHaveLength(1);
    expect(result.current.pageItems[0].name).toBe('Carol');
  });

  it('filters by search query', () => {
    const { result } = renderHook(() =>
      useFilteredList(items, { searchKeys: (i) => [i.name], pageSize: 10 })
    );
    act(() => result.current.setQuery('bob'));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.pageItems[0].name).toBe('Bob');
    expect(result.current.totalPages).toBe(1);
  });

  it('resets to page 1 when query changes', () => {
    const { result } = renderHook(() =>
      useFilteredList(items, { searchKeys: (i) => [i.name], pageSize: 1 })
    );
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    act(() => result.current.setQuery('a'));
    expect(result.current.page).toBe(1);
  });

  it('applies filterFn when provided', () => {
    const { result } = renderHook(() =>
      useFilteredList(items, {
        searchKeys: (i) => [i.name],
        pageSize: 10,
        filterFn: (item, f) => !f.role || item.role === f.role,
      })
    );
    act(() => result.current.setFilters({ role: 'instructor' }));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.pageItems[0].name).toBe('Bob');
  });

  it('handles null/undefined items', () => {
    const { result } = renderHook(() =>
      useFilteredList(null, { searchKeys: () => [], pageSize: 10 })
    );
    expect(result.current.pageItems).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(1);
  });
});
