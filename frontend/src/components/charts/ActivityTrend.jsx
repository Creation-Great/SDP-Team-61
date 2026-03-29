import { useMemo } from 'react';
import ChartCard from './ChartCard';

export default function ActivityTrend({ data = [], loading }) {
  const { points, maxY, width, height, padding } = useMemo(() => {
    const w = 400;
    const h = 200;
    const pad = { top: 20, right: 20, bottom: 40, left: 40 };
    const maxVal = Math.max(...data.map(d => Math.max(d.submissions || 0, d.reviews || 0)), 1);

    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const submissionPts = data.map((d, i) => ({
      x: pad.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
      y: pad.top + chartH - ((d.submissions || 0) / maxVal) * chartH,
    }));

    const reviewPts = data.map((d, i) => ({
      x: pad.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
      y: pad.top + chartH - ((d.reviews || 0) / maxVal) * chartH,
    }));

    return { points: { submissions: submissionPts, reviews: reviewPts }, maxY: maxVal, width: w, height: h, padding: pad };
  }, [data]);

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <ChartCard title="Activity Trend" loading={loading}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Y-axis */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="1" />
        {/* X-axis */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="1" />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = padding.top + (height - padding.top - padding.bottom) * (1 - frac);
          return (
            <text key={frac} x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(maxY * frac)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = padding.left + (data.length > 1 ? (i / (data.length - 1)) * (width - padding.left - padding.right) : (width - padding.left - padding.right) / 2);
          return (
            <text key={i} x={x} y={height - padding.bottom + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {d.week}
            </text>
          );
        })}

        {/* Submission line */}
        {points.submissions.length > 0 && (
          <path d={toPath(points.submissions)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Review line */}
        {points.reviews.length > 0 && (
          <path d={toPath(points.reviews)} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dots */}
        {points.submissions.map((p, i) => (
          <circle key={`s-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
        ))}
        {points.reviews.map((p, i) => (
          <circle key={`r-${i}`} cx={p.x} cy={p.y} r="3" fill="#14b8a6" />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-600">Submissions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-teal-500" />
          <span className="text-xs text-slate-600">Reviews</span>
        </div>
      </div>
    </ChartCard>
  );
}
