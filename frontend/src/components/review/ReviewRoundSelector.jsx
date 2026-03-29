import { ChevronDown } from 'lucide-react';

export default function ReviewRoundSelector({ rounds = [], selectedRound, onChange }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={selectedRound ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">All Rounds</option>
        {rounds.map(round => (
          <option key={round} value={round}>
            Round {round}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

      {selectedRound != null && (
        <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#000E2F] text-white text-xs font-bold">
          {selectedRound}
        </span>
      )}
    </div>
  );
}
