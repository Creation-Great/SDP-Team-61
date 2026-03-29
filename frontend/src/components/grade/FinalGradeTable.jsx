import { useState, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ArrowUpDown, Search } from 'lucide-react';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const COLUMNS = [
  { key: 'name', label: 'Student' },
  { key: 'fileReviewAvg', label: 'File Review' },
  { key: 'peerReviewAvg', label: 'Peer Review' },
  { key: 'checkinAvg', label: 'Check-in' },
  { key: 'weightedTotal', label: 'Total' },
];

function scoreColor(val) {
  if (val >= 4) return 'text-green-700 bg-green-50';
  if (val >= 3) return 'text-yellow-700 bg-yellow-50';
  if (val >= 2) return 'text-orange-700 bg-orange-50';
  return 'text-red-700 bg-red-50';
}

export default function FinalGradeTable({ grades = [], loading }) {
  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = grades;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(g => g.name?.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'string') return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [grades, search, sortKey, sortAsc]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (loading) {
    return <Card className="p-5"><Skeleton variant="row" count={8} /></Card>;
  }

  return (
    <Card className="overflow-hidden">
      {/* Search */}
      <div className="p-4 border-b border-slate-200">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown size={14} className={sortKey === col.key ? 'text-[#000E2F]' : 'text-slate-300'} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
        </table>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">No students found</div>
        ) : (
          <Virtuoso
            style={{ height: '500px' }}
            data={filtered}
            itemContent={(index, row) => (
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                    {['fileReviewAvg', 'peerReviewAvg', 'checkinAvg', 'weightedTotal'].map(key => (
                      <td key={key} className="px-4 py-3">
                        {row[key] != null ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreColor(row[key])}`}>
                            {row[key].toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
          />
        )}
      </div>
    </Card>
  );
}
