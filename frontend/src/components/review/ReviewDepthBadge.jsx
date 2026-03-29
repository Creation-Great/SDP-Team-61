const METRICS = [
  { key: 'constructiveness', label: 'Constructiveness', color: 'bg-blue-500' },
  { key: 'specificity', label: 'Specificity', color: 'bg-teal-500' },
  { key: 'actionability', label: 'Actionability', color: 'bg-purple-500' },
];

export default function ReviewDepthBadge({ constructiveness = 0, specificity = 0, actionability = 0 }) {
  const scores = { constructiveness, specificity, actionability };

  return (
    <div className="flex items-center gap-3">
      {METRICS.map(metric => {
        const value = scores[metric.key] || 0;
        const pct = Math.round(value * 100);

        return (
          <div key={metric.key} className="group relative flex items-center gap-1.5">
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${metric.color} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 tabular-nums">{pct}%</span>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {metric.label}: {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
