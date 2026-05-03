import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const SEVERITY_STYLES = {
  low: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  medium: 'bg-orange-50 border-orange-300 text-orange-800',
  high: 'bg-red-50 border-red-300 text-red-800',
};

const SEVERITY_ICON_STYLES = {
  low: 'text-yellow-500',
  medium: 'text-orange-500',
  high: 'text-red-500',
};

export default function CalibrationAlert({ deviation, recommendation, severity = 'low' }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const styles = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  const iconStyle = SEVERITY_ICON_STYLES[severity] || SEVERITY_ICON_STYLES.low;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${styles}`}>
      <AlertTriangle size={20} className={`flex-shrink-0 mt-0.5 ${iconStyle}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          Score Deviation: {deviation != null ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}` : 'N/A'}
        </p>
        {recommendation && (
          <p className="text-sm mt-1 opacity-90">{recommendation}</p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
        aria-label="Dismiss alert"
      >
        <X size={16} />
      </button>
    </div>
  );
}
