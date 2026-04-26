import { useState } from 'react';
import { ChevronDown, ChevronUp, Play, CheckCircle2, Dumbbell } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { ActivePlan, NavState } from '../../types';
import { POSITION_PLANS, POSITION_TEMPLATES, getCurrentPlanWeek } from '../../data/positionPlans';

interface PlanDetailProps {
  planId: string;
  activePlan: ActivePlan | null;
  onSetActivePlan: (plan: ActivePlan | null) => void;
  onNavigate: (nav: NavState) => void;
  onBack: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PHASE_COLOURS: Record<string, { bg: string; text: string }> = {
  Foundation: { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Build:      { bg: 'bg-purple-100', text: 'text-purple-700' },
  Strength:   { bg: 'bg-brand-100',  text: 'text-brand-700'  },
  Power:      { bg: 'bg-orange-100', text: 'text-orange-700' },
  Peak:       { bg: 'bg-red-100',    text: 'text-red-700'    },
};

export function PlanDetail({ planId, activePlan, onSetActivePlan, onNavigate, onBack }: PlanDetailProps) {
  const plan = POSITION_PLANS.find(p => p.id === planId);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  if (!plan) {
    return (
      <Layout title="Plan" onBack={onBack}>
        <p className="text-gray-500 text-sm">Plan not found.</p>
      </Layout>
    );
  }

  const isActive = activePlan?.planId === plan.id;
  const currentWeekIdx = isActive ? getCurrentPlanWeek(activePlan!.startDate) : -1;

  const handleStart = () => {
    const today = new Date();
    const day = today.getDay();
    const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
    const startDate = new Date(today);
    if (daysToMonday > 0) startDate.setDate(today.getDate() + daysToMonday);
    onSetActivePlan({ planId: plan.id, startDate: startDate.toISOString().split('T')[0] });
    onNavigate({ screen: 'dashboard' });
  };

  const handleStop = () => {
    onSetActivePlan(null);
  };

  return (
    <Layout title={plan.position} onBack={onBack}>
      {/* Header card */}
      <Card className="p-4 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">
            {{ GK: '🧤', CB: '🛡️', FB: '⚡', CM: '⚙️', W: '💨', ST: '🎯' }[plan.shortName] ?? '⚽'}
          </span>
          <div>
            <div className="font-bold text-gray-900 text-lg">{plan.position}</div>
            <div className="text-xs text-gray-400">8 weeks · 3 sessions/wk · Mon/Wed/Fri</div>
          </div>
          {isActive && (
            <span className="ml-auto text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-semibold">Active</span>
          )}
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">{plan.description}</p>

        {isActive ? (
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 justify-center py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
              <CheckCircle2 size={16} />
              Currently Active — Week {currentWeekIdx + 1}
            </div>
            <button
              onClick={handleStop}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200"
            >
              Stop
            </button>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            <Play size={14} />
            Start This Plan
          </button>
        )}
      </Card>

      {/* Week-by-week breakdown */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">8-Week Schedule</h2>
      <div className="flex flex-col gap-2">
        {plan.weeks.map(planWeek => {
          const isCurrentWeek = isActive && currentWeekIdx + 1 === planWeek.weekNumber;
          const phaseCol = PHASE_COLOURS[planWeek.phase] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
          const open = expandedWeek === planWeek.weekNumber;

          return (
            <div
              key={planWeek.weekNumber}
              className={`rounded-2xl border overflow-hidden ${isCurrentWeek ? 'border-brand-300 ring-2 ring-brand-100' : 'border-gray-100'}`}
            >
              {/* Week header */}
              <button
                className="w-full flex items-center justify-between p-3 bg-white text-left"
                onClick={() => setExpandedWeek(open ? null : planWeek.weekNumber)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${isCurrentWeek ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {planWeek.weekNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">Week {planWeek.weekNumber}</span>
                      {isCurrentWeek && <span className="text-xs text-brand-500 font-semibold">← Current</span>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${phaseCol.bg} ${phaseCol.text}`}>
                      {planWeek.phase}
                    </span>
                  </div>
                </div>
                {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {/* Session list */}
              {open && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {planWeek.sessions.map(planSession => {
                    const template = POSITION_TEMPLATES.find(t => t.id === planSession.templateId);
                    return (
                      <div key={planSession.dayOfWeek} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50">
                        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                          <Dumbbell size={16} className="text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-brand-500">{DAY_LABELS[planSession.dayOfWeek]}</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 truncate">{planSession.name}</div>
                          {template && (
                            <div className="text-xs text-gray-400 truncate">{template.description}</div>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {planSession.tags.map(tag => (
                              <span key={tag} className="text-xs bg-white text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        </div>
                        {isCurrentWeek && (
                          <button
                            onClick={() => onNavigate({ screen: 'workout-builder', templateId: planSession.templateId })}
                            className="flex-shrink-0 p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600"
                          >
                            <Play size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
