import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

/**
 * Header search bar with real-time dropdown results.
 * Calls GET /api/ai/search?q=<query> (proxied through backend).
 */
export default function HeaderSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ submissions: [], users: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup on unmount: abort in-flight request and cancel debounce timer
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearTimeout(debounceRef.current);
    };
  }, []);

  // Debounced search with AbortController to prevent out-of-order results
  const doSearch = useCallback(async (q) => {
    // Cancel any in-flight request
    abortRef.current?.abort();

    if (!q || q.trim().length < 2) {
      setResults({ submissions: [], users: [] });
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await API.get('/api/ai/search', {
        params: { q: q.trim() },
        signal: controller.signal,
      });
      setResults(res.data);
      setOpen(true);
    } catch (err) {
      if (err?.name !== 'CanceledError') {
        setResults({ submissions: [], users: [] });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleClear = () => {
    setQuery('');
    setResults({ submissions: [], users: [] });
    setOpen(false);
  };

  const hasResults = results.submissions?.length > 0 || results.users?.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-96">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (hasResults) setOpen(true); }}
        placeholder="Search courses, students..."
        className="w-full pl-10 pr-9 py-2 bg-slate-100 border-transparent rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#000E2F]/10"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown results */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-lg border border-slate-200 max-h-80 overflow-auto z-50">
          {loading && (
            <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
          )}

          {!loading && !hasResults && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-slate-400">No results found</div>
          )}

          {results.submissions?.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                Submissions
              </div>
              {results.submissions.map((s) => (
                <button
                  key={s.submission_id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                  onClick={() => {
                    navigate(`/view-review/${s.submission_id}`);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <FileText className="w-4 h-4 text-[#000E2F] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      {s.original_filename || `Submission #${s.submission_id}`}
                    </div>
                    {s.uploader_name && (
                      <div className="text-xs text-slate-400">by {s.uploader_name}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.users?.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                Users
              </div>
              {results.users.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <User className="w-4 h-4 text-[#000E2F] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email} · {u.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
