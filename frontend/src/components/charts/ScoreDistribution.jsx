import { useMemo } from 'react';
import ChartCard from './ChartCard';

export default function ScoreDistribution({ scores = [], loading }) {
  const distribution = useMemo(() => {
    const bins = [0, 0, 0, 0, 0];
    scores.forEach(s => { if (s >= 1 && s <= 5) bins[Math.round(s) - 1]++; });
    return [1,2,3,4,5].map((score, i) => ({ score: `${score}`, count: bins[i] }));
  }, [scores]);

  const max = Math.max(...distribution.map(d => d.count), 1);

  return (
    <ChartCard title="Score Distribution" loading={loading}>
      <div className="flex items-end gap-2 h-48">
        {distribution.map(d => (
          <div key={d.score} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[#000E2F] rounded-t-md transition-all duration-500"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
            />
            <span className="text-xs font-medium text-slate-600">{d.score}</span>
            <span className="text-xs text-slate-400">{d.count}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
