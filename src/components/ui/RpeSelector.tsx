import { RPE_LABELS } from '../../lib/rpeProgression';

interface RpeSelectorProps {
  value: number | null;
  onChange: (rpe: number) => void;
  onSkip?: () => void;
  targetRpe?: number;
  compact?: boolean;
}

function getRpeBg(rpe: number, selected: boolean, isTarget: boolean): string {
  if (selected) {
    if (rpe <= 3) return 'bg-green-500 text-white border-green-500';
    if (rpe <= 5) return 'bg-yellow-400 text-white border-yellow-400';
    if (rpe <= 7) return 'bg-orange-500 text-white border-orange-500';
    return 'bg-red-500 text-white border-red-500';
  }
  const ring = isTarget ? ' ring-2 ring-brand-400 ring-offset-1' : '';
  if (rpe <= 3) return `bg-green-50 text-green-700 border-green-200 hover:bg-green-100${ring}`;
  if (rpe <= 5) return `bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100${ring}`;
  if (rpe <= 7) return `bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100${ring}`;
  return `bg-red-50 text-red-700 border-red-200 hover:bg-red-100${ring}`;
}

export function RpeSelector({ value, onChange, onSkip, targetRpe, compact = false }: RpeSelectorProps) {
  return (
    <div className={`${compact ? 'p-2.5' : 'p-3'} bg-gray-50 rounded-xl border border-gray-100 mt-2`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700">How hard was that?</span>
          {targetRpe && (
            <span className="text-xs text-gray-400">(target {targetRpe})</span>
          )}
        </div>
        {value && (
          <span className="text-xs text-gray-500 font-medium">{RPE_LABELS[value]}</span>
        )}
      </div>

      <div className="flex gap-1 mb-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-8 rounded-lg text-xs font-bold border transition-all ${getRpeBg(n, value === n, targetRpe === n)}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-400 px-0.5">
        <span>Easy</span>
        <span>Max</span>
      </div>

      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full mt-2 text-xs text-gray-400 hover:text-gray-500 text-center py-1"
        >
          Skip RPE logging
        </button>
      )}
    </div>
  );
}
