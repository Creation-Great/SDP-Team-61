import { useMemo } from 'react';
import ChartCard from './ChartCard';

const AXES = [
  { key: 'technical', label: 'Technical', angle: -90 },
  { key: 'interactions', label: 'Interactions', angle: 30 },
  { key: 'management', label: 'Management', angle: 150 },
];

export default function PeerReviewRadar({ technical = 0, interactions = 0, management = 0, loading }) {
  const scores = { technical, interactions, management };
  const maxScore = 5;
  const cx = 150;
  const cy = 140;
  const radius = 100;

  const vertices = useMemo(() => {
    return AXES.map(axis => {
      const rad = (axis.angle * Math.PI) / 180;
      const value = (scores[axis.key] || 0) / maxScore;
      return {
        ...axis,
        x: cx + Math.cos(rad) * radius * value,
        y: cy + Math.sin(rad) * radius * value,
        labelX: cx + Math.cos(rad) * (radius + 20),
        labelY: cy + Math.sin(rad) * (radius + 20),
        outerX: cx + Math.cos(rad) * radius,
        outerY: cy + Math.sin(rad) * radius,
      };
    });
  }, [scores]);

  const polygon = vertices.map(v => `${v.x},${v.y}`).join(' ');

  return (
    <ChartCard title="Peer Review Breakdown" loading={loading}>
      <svg viewBox="0 0 300 280" className="w-full h-auto max-w-xs mx-auto">
        {/* Grid rings */}
        {[0.2, 0.4, 0.6, 0.8, 1].map(frac => (
          <polygon
            key={frac}
            points={AXES.map(axis => {
              const rad = (axis.angle * Math.PI) / 180;
              return `${cx + Math.cos(rad) * radius * frac},${cy + Math.sin(rad) * radius * frac}`;
            }).join(' ')}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {vertices.map(v => (
          <line key={v.key} x1={cx} y1={cy} x2={v.outerX} y2={v.outerY} stroke="#cbd5e1" strokeWidth="1" />
        ))}

        {/* Data polygon */}
        <polygon points={polygon} fill="rgba(0,14,47,0.2)" stroke="#000E2F" strokeWidth="2" />

        {/* Data points */}
        {vertices.map(v => (
          <circle key={v.key} cx={v.x} cy={v.y} r="4" fill="#000E2F" />
        ))}

        {/* Labels */}
        {vertices.map(v => (
          <text
            key={v.key}
            x={v.labelX}
            y={v.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fill="#475569"
            fontWeight="500"
          >
            {v.label}
          </text>
        ))}
      </svg>
    </ChartCard>
  );
}
