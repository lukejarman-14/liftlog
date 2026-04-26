import { ChevronRight, CheckCircle2, Play, Trophy } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { ActivePlan, NavState } from '../../types';
import { POSITION_PLANS } from '../../data/positionPlans';

interface PlanBrowserProps {
  activePlan: ActivePlan | null;
  onSetActivePlan: (plan: ActivePlan | null) => void;
  onNavigate: (nav: NavState) => void;
}

const POSITION_EMOJI: Record<string, string> = {
  GK: '🧤',
  CB: '🛡️',
  FB: '⚡',
  CM: '⚙️',
  W: '💨',
  ST: '🎯',
};

const POSITION_COLOUR: Record<string, { bg: string; text: string; border: string }> = {
  GK: { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  CB: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'   },
  FB: { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  CM: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200'  },
  W:  { bg: 'bg-brand-50',   text: 'text-brand-700',   border: 'border-brand-200'  },
  ST: { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'    },
};

export function PlanBrowser({ activePlan, onSetActivePlan, onNavigate }: PlanBrowserProps) {
  const handleStart = (planId: string) => {
    // Start the plan from next Monday (or today if today is Monday)
    const today = new Date();
    const day = today.getDay(); // 0=Sun,1=Mon…
    const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
    const startDate = new Date(today);
    if (daysToMonday > 0) startDate.setDate(today.getDate() + daysToMonday);
    onSetActivePlan({ planId, startDate: startDate.toISOString().split('T')[0] });
    onNavigate({ screen: 'dashboard' });
  };

  const handleStop = () => {
    onSetActivePlan(null);
  };

  return (
    <Layout title="Position Plans">
      <p className="text-sm text-gray-500 mb-5">
        Choose a position-specific 8-week programme. Each plan runs Mon / Wed / Fri with Plyos → Strength → Eccentric → Isometric → Conditioning sessions.
      </p>

      <div className="flex flex-col gap-4">
        {POSITION_PLANS.map(plan => {
          const col = POSITION_COLOUR[plan.shortName] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
          const isActive = activePlan?.planId === plan.id;

          return (
            <Card key={plan.id} className={`p-4 border ${isActive ? 'border-brand-400 ring-2 ring-brand-200' : 'border-gray-100'}`}>
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${col.bg} border ${col.border}`}>
                    {POSITION_EMOJI[plan.shortName] ?? '⚽'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{plan.position}</span>
                      {isActive && (
                        <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-semibold">Active</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.bg} ${col.text} border ${col.border}`}>
                        {plan.shortName}
                      </span>
                      <span className="text-xs text-gray-400">8 weeks · 3 sessions/wk</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate({ screen: 'plan-detail', planId: plan.id })}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{plan.description}</p>

              {/* Phase chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {['Foundation', 'Build', 'Strength', 'Power / Peak'].map(phase => (
                  <span key={phase} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{phase}</span>
                ))}
              </div>

              {/* Action button */}
              {isActive ? (
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 justify-center py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
                    <CheckCircle2 size={16} />
                    Plan Active
                  </div>
                  <button
                    onClick={handleStop}
                    className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200"
                  >
                    Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleStart(plan.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
                >
                  <Play size={14} />
                  Start Plan
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={14} className="text-brand-400" />
          <span className="text-xs font-semibold text-gray-600">How it works</span>
        </div>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• Plans run for 8 weeks with 3 sessions per week</li>
          <li>• Sessions automatically appear in your weekly calendar</li>
          <li>• Each session follows: Plyos → Strength → Eccentric → Isometric → Conditioning</li>
          <li>• Tap <strong>Start</strong> on any session card from the home screen to begin</li>
        </ul>
      </div>
    </Layout>
  );
}
