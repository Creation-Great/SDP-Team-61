import { useMemo } from 'react';
import ChartCard from './ChartCard';

export default function CompletionHeatmap({ students = [], loading }) {
  const assignmentIds = useMemo(() => {
    const ids = new Set();
    students.forEach(s => (s.assignments || []).forEach(a => ids.add(a.id)));
    return [...ids].sort();
  }, [students]);

  const getColor = (completed) => {
    if (completed === true) return 'bg-green-500';
    if (completed === false) return 'bg-red-500';
    return 'bg-slate-200';
  };

  return (
    <ChartCard title="Completion Heatmap" loading={loading}>
      <div className="overflow-auto max-h-96">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-white p-2 text-left font-medium text-slate-600 border-b border-slate-200 min-w-[120px]">
                Student
              </th>
              {assignmentIds.map(id => (
                <th
                  key={id}
                  className="sticky top-0 z-10 bg-white p-2 text-center font-medium text-slate-600 border-b border-slate-200 min-w-[40px]"
                >
                  A{id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => {
              const assignmentMap = {};
              (student.assignments || []).forEach(a => { assignmentMap[a.id] = a.completed; });

              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white p-2 font-medium text-slate-700 border-b border-slate-100 truncate max-w-[150px]">
                    {student.name}
                  </td>
                  {assignmentIds.map(id => (
                    <td key={id} className="p-1 border-b border-slate-100 text-center">
                      <div
                        className={`w-6 h-6 mx-auto rounded-sm ${getColor(assignmentMap[id])} transition-colors`}
                        title={
                          assignmentMap[id] === true ? 'Complete' :
                          assignmentMap[id] === false ? 'Incomplete' :
                          'No data'
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500" /> Complete</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500" /> Incomplete</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-200" /> No data</div>
      </div>
    </ChartCard>
  );
}
