import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';

const WEIGHT_FIELDS = [
  { key: 'file_review', label: 'File Review', color: 'bg-blue-500' },
  { key: 'peer_review', label: 'Peer Review', color: 'bg-teal-500' },
  { key: 'checkin', label: 'Check-in', color: 'bg-purple-500' },
];

export default function GradeWeightEditor({ weights = {}, onChange, onSave, saving = false }) {
  const totalWeight = useMemo(() => {
    return WEIGHT_FIELDS.reduce((sum, f) => sum + (weights[f.key] || 0), 0);
  }, [weights]);

  const isValid = totalWeight === 100;

  const handleSliderChange = (key, value) => {
    onChange?.({ ...weights, [key]: Number(value) });
  };

  const handleDropChange = (key, value) => {
    onChange?.({ ...weights, [key]: Number(value) });
  };

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-semibold text-[#000E2F]">Grade Weight Configuration</h3>

      {/* Weight sliders */}
      <div className="space-y-4">
        {WEIGHT_FIELDS.map(field => (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">{field.label}</label>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{weights[field.key] || 0}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={weights[field.key] || 0}
              onChange={(e) => handleSliderChange(field.key, e.target.value)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#000E2F]"
            />
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${field.color} transition-all duration-300`}
                style={{ width: `${weights[field.key] || 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Total indicator */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        {!isValid && <AlertTriangle size={16} className="text-red-500" />}
        <span className={`text-sm font-medium ${isValid ? 'text-green-700' : 'text-red-700'}`}>
          Total: {totalWeight}% {!isValid && '(must equal 100%)'}
        </span>
      </div>

      {/* Drop lowest/highest */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Drop Lowest</label>
          <input
            type="number"
            min="0"
            max="5"
            value={weights.drop_lowest || 0}
            onChange={(e) => handleDropChange('drop_lowest', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Drop Highest</label>
          <input
            type="number"
            min="0"
            max="5"
            value={weights.drop_highest || 0}
            onChange={(e) => handleDropChange('drop_highest', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Save */}
      <Button onClick={onSave} disabled={!isValid || saving} className="w-full">
        {saving ? 'Saving...' : 'Save Weights'}
      </Button>
    </Card>
  );
}
