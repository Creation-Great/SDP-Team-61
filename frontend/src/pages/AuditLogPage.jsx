import { useState, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Shield, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTION_TYPES = ['all', 'create', 'update', 'delete', 'login', 'submit', 'review'];

export default function AuditLogPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const pageSize = 20;

  const fetchEvents = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, pageSize });
    if (actionFilter !== 'all') params.append('action', actionFilter);
    if (search) params.append('search', search);
    API.get(`/compliance/audit?${params}`)
      .then(r => {
        setEvents(r.data.events || r.data || []);
        setTotalPages(r.data.totalPages || Math.ceil((r.data.total || 0) / pageSize) || 1);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchEvents(); }, [page, actionFilter, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const actionColor = (action) => {
    const map = { create: 'success', delete: 'error', update: 'warning', login: 'info' };
    return map[action] || 'default';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={24} className="text-[#000E2F]" />
        <h1 className="text-2xl font-bold text-[#000E2F]">Audit Log</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]"
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>
        <div className="flex gap-1">
          {ACTION_TYPES.map(type => (
            <button
              key={type}
              onClick={() => { setActionFilter(type); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                actionFilter === type ? 'bg-[#000E2F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-3 font-medium">Timestamp</th>
                  <th className="text-left p-3 font-medium">Actor</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Entity</th>
                  <th className="text-left p-3 font-medium">Entity ID</th>
                </tr>
              </thead>
            </table>
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No audit events found</div>
            ) : (
              <Virtuoso
                style={{ height: '500px' }}
                data={events}
                itemContent={(index, evt) => (
                  <div className="grid grid-cols-5 hover:bg-slate-50 border-t border-slate-100 text-sm">
                    <div className="p-3 text-slate-500 whitespace-nowrap">{new Date(evt.timestamp).toLocaleString()}</div>
                    <div className="p-3 font-medium text-slate-900">{evt.actor}</div>
                    <div className="p-3"><Badge type={actionColor(evt.action)}>{evt.action}</Badge></div>
                    <div className="p-3 text-slate-600">{evt.entity}</div>
                    <div className="p-3 text-slate-400 font-mono text-xs">{evt.entity_id}</div>
                  </div>
                )}
              />
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={16} /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
