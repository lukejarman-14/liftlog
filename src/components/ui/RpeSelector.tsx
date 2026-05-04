import { RIR_LABELS } from '../../lib/rpeProgression';

interface RpeSelectorProps {
  value: number | null;
  onChange: (rir: number) => void;
  onSkip?: () => void;
  targetRir?: number;
  compact?: boolean;
}

// RIR: 0 = max effort (red), 4 = very easy (green) — inverted from RPE
function getRirBg(rir: number, selected: boolean, isTarget: boolean): string {
  const ring = isTarget ? ' ring-2 ring-brand-400 ring-offset-1' : '';
  if (selected) {
    if (rir === 0) return 'bg-red-500 text-white border-red-500';
    if (rir === 1) return 'bg-orange-500 text-white border-orange-500';
    if (rir === 2) return 'bg-yellow-400 text-gray-900 border-yellow-400';
    if (rir === 3) return 'bg-green-400 text-white border-green-400';
    return 'bg-green-200 text-green-900 border-green-300';
  }
  if (rir === 0) return `bg-red-50 text-red-700 border-red-200 hover:bg-red-100${ring}`;
  if (rir === 1) return `bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100${ring}`;
  if (rir === 2) return `bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100${ring}`;
  if (rir === 3) return `bg-green-50 text-green-700 border-green-200 hover:bg-green-100${ring}`;
  return `bg-green-50 text-green-600 border-green-100 hover:bg-green-100${ring}`;
}

export function RpeSelector({ value, onChange, onSkip, targetRir, compact = false }: RpeSelectorProps) {
  return (
    <div className={`${compact ? 'p-2.5' : 'p-3'} bg-gray-50 rounded-xl border border-gray-100 mt-2`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700">Reps in reserve?</span>
          {targetRir !== undefined && (
            <span className="text-xs text-gray-400">(target {targetRir} RIR)</span>
          )}
        </div>
        {value !== null && value !== undefined && (
          <span className="text-xs text-gray-500 font-medium">{RIR_LABELS[value]}</span>
        )}
      </div>

      <div className="flex gap-1.5 mb-1.5">
        {[0, 1, 2, 3, 4].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold border transition-all ${getRirBg(n, value === n, targetRir === n)}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-400 px-0.5">
        <span>Max effort</span>
        <span>Very easy</span>
      </div>

      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full mt-2 text-xs text-gray-400 hover:text-gray-500 text-center py-1"
        >
          Skip RIR logging
        </button>
      )}
    </div>
  );
}
