import { useState, useEffect } from 'react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPE_COLORS = {
  session: 'bg-blue-100 text-blue-800 border-blue-200',
  assignment: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  extension: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function CalendarPage() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    API.get('/deadlines/calendar')
      .then(r => setDeadlines(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const navigate = (dir) => setCurrent(new Date(year, month + dir, 1));

  const getDeadlinesForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return deadlines.filter(d => d.date?.startsWith(dateStr) || d.deadline?.startsWith(dateStr));
  };

  const selectedDeadlines = selectedDate ? getDeadlinesForDay(selectedDate) : [];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (loading) return <div className="max-w-5xl mx-auto p-6"><div className="animate-pulse h-96 bg-slate-100 rounded-2xl" /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#000E2F] flex items-center gap-2"><CalendarIcon size={24} /> Deadline Calendar</h1>
        <div className="flex items-center gap-4">
          {Object.entries(TYPE_COLORS).map(([type, cls]) => (
            <span key={type} className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{type}</span>
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}><ChevronLeft size={20} /></Button>
          <h2 className="text-lg font-semibold text-slate-900">
            {current.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <Button variant="ghost" onClick={() => navigate(1)}><ChevronRight size={20} /></Button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
          {DAYS.map(d => (
            <div key={d} className="bg-slate-50 p-2 text-center text-xs font-medium text-slate-500">{d}</div>
          ))}
          {cells.map((day, i) => {
            const dayDeadlines = day ? getDeadlinesForDay(day) : [];
            const isToday = day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
            return (
              <div
                key={i}
                onClick={() => day && setSelectedDate(day)}
                className={`bg-white min-h-[80px] p-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedDate === day ? 'ring-2 ring-[#000E2F] ring-inset' : ''
                }`}
              >
                {day && (
                  <>
                    <span className={`text-xs font-medium ${isToday ? 'bg-[#000E2F] text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-600'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayDeadlines.slice(0, 2).map((dl, j) => (
                        <div key={j} className={`text-[10px] px-1 py-0.5 rounded truncate ${TYPE_COLORS[dl.type] || 'bg-slate-100 text-slate-600'}`}>
                          {dl.title || dl.name}
                        </div>
                      ))}
                      {dayDeadlines.length > 2 && <span className="text-[10px] text-slate-400">+{dayDeadlines.length - 2} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {selectedDate && (
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">
            {new Date(year, month, selectedDate).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          {selectedDeadlines.length === 0 ? (
            <p className="text-sm text-slate-400">No deadlines on this date</p>
          ) : (
            <div className="space-y-2">
              {selectedDeadlines.map((dl, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{dl.title || dl.name}</p>
                    {dl.description && <p className="text-sm text-slate-500">{dl.description}</p>}
                  </div>
                  <Badge type={dl.type === 'session' ? 'info' : dl.type === 'assignment' ? 'success' : 'warning'}>{dl.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
