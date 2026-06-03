import { Zap, Check, X } from 'lucide-react';

interface SquadEndedModalProps {
  /** Coach/squad name if known, for a more personal message. */
  squadName?: string;
  onKeepPremium: () => void;
  onDismiss: () => void;
}

const KEEP_FEATURES = [
  'Your full training history & test results',
  'Smart programme builder',
  'Training load & readiness tracking',
];

/**
 * Shown to a player whose Premium-via-coach access has ended (coach cancelled
 * or removed them from the squad). Converts them into a personal subscriber.
 */
export function SquadEndedModal({ squadName, onKeepPremium, onDismiss }: SquadEndedModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={16} className="text-gray-500" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mb-4">
          <Zap size={28} className="text-yellow-300" />
        </div>

        <h2 className="text-xl font-extrabold text-gray-900 mb-2">
          Your squad access has ended
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          {squadName ? `${squadName}'s` : 'Your coach’s'} subscription has ended, so your Premium
          access through the squad has stopped. <span className="font-semibold text-gray-700">Your data is
          safe</span> — keep Premium on a personal plan to carry on without losing a thing.
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Keep access to</p>
          <div className="flex flex-col gap-2">
            {KEEP_FEATURES.map(f => (
              <div key={f} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={11} className="text-brand-600" strokeWidth={3} />
                </div>
                <span className="text-sm text-gray-700 leading-snug">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onKeepPremium}
          className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors mb-2"
        >
          Keep Premium — start 14-day free trial
        </button>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-2xl text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Continue with free version
        </button>
      </div>
    </div>
  );
}
