import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Card from '../ui/Card';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEADLINE_COLORS = {
  assignment: 'bg-blue-500',
  review: 'bg-teal-500',
  checkin: 'bg-purple-500',
  default: 'bg-slate-400',
};

export default function DeadlineCalendar({ deadlines = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    return days;
  }, [year, month]);

  const deadlinesByDay = useMemo(() => {
    const map = {};
    deadlines.forEach(dl => {
      const d = new Date(dl.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(dl);
      }
    });
    return map;
  }, [deadlines, year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const today = new Date();
  const isToday = (day) => day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Previous month">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h3 className="text-lg font-semibold text-[#000E2F]">{monthName}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Next month">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => (
          <div
            key={i}
            onClick={() => day && deadlinesByDay[day] && setSelectedDay(day)}
            className={`
              relative h-12 flex flex-col items-center justify-center rounded-lg text-sm transition-colors
              ${day ? 'cursor-pointer hover:bg-slate-50' : ''}
              ${isToday(day) ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'}
              ${selectedDay === day ? 'ring-2 ring-[#000E2F]' : ''}
            `}
          >
            {day && (
              <>
                <span>{day}</span>
                {deadlinesByDay[day] && (
                  <div className="flex gap-0.5 mt-0.5">
                    {deadlinesByDay[day].slice(0, 3).map((dl, j) => (
                      <span
                        key={j}
                        className={`w-1.5 h-1.5 rounded-full ${DEADLINE_COLORS[dl.type] || DEADLINE_COLORS.default}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Selected day popup */}
      {selectedDay && deadlinesByDay[selectedDay] && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">
              {new Date(year, month, selectedDay).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
            </h4>
            <button onClick={() => setSelectedDay(null)} className="p-0.5 hover:bg-slate-200 rounded" aria-label="Close">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <ul className="space-y-1.5">
            {deadlinesByDay[selectedDay].map((dl, j) => (
              <li key={j} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${DEADLINE_COLORS[dl.type] || DEADLINE_COLORS.default}`} />
                <span className="text-slate-700">{dl.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
