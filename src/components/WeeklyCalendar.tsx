import { CheckCircle2, Play, Calendar } from 'lucide-react';
import { WorkoutSession, ActivePlan, NavState, GeneratedProgramme } from '../types';
import {
  POSITION_PLANS,
  POSITION_TEMPLATES,
  getCurrentPlanWeek,
  getWeekDates,
  isSameDay,
} from '../data/positionPlans';

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

interface WeeklyCalendarProps {
  sessions: WorkoutSession[];
  activePlan: ActivePlan | null;
  generatedProgramme?: GeneratedProgramme | null;
  onNavigate: (nav: NavState) => void;
  onStartWorkout: (templateId: string, name: string) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PHASE_COLOURS: Record<string, string> = {
  Foundation: 'bg-blue-100 text-blue-700',
  Build:      'bg-purple-100 text-purple-700',
  Strength:   'bg-brand-100 text-brand-700',
  Power:      'bg-orange-100 text-orange-700',
  Peak:       'bg-red-100 text-red-700',
};

function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function WeeklyCalendar({ sessions, activePlan, generatedProgramme, onNavigate, onStartWorkout }: WeeklyCalendarProps) {
  const weekDates = getWeekDates(0);
  const today = new Date();

  // Find the plan and current week if a plan is active
  const plan = activePlan ? POSITION_PLANS.find(p => p.id === activePlan.planId) : null;
  const weekIdx = activePlan ? getCurrentPlanWeek(activePlan.startDate) : -1;
  const planWeek = plan && weekIdx >= 0 && weekIdx < plan.weeks.length ? plan.weeks[weekIdx] : null;

  // Build a map: dayOfWeek (0-6) → session template info
  const plannedByDay = new Map<number, { templateId: string; name: string; tags: string[] }>();
  if (planWeek) {
    for (const s of planWeek.sessions) {
      plannedByDay.set(s.dayOfWeek, s);
    }
  }

  // Completed session dates (as YYYY-MM-DD strings) for this week
  const completedDates = new Set(
    sessions
      .filter(s => s.endTime != null && weekDates.some(d => isSameDay(new Date(s.date), d)))
      .map(s => s.date)
  );

  const hasPlan = !!plan;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">This Week</h2>
        {hasPlan && planWeek && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PHASE_COLOURS[planWeek.phase] ?? 'bg-gray-100 text-gray-600'}`}>
            {plan!.shortName} · Wk {planWeek.weekNumber} · {planWeek.phase}
          </span>
        )}
        {!hasPlan && (
          <button
            onClick={() => onNavigate({ screen: 'plans' })}
            className="text-xs text-brand-500 font-medium"
          >
            Start a plan →
          </button>
        )}
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          const dateStr = dateToStr(date);
          const done = completedDates.has(dateStr);
          const planned = plannedByDay.has(i);

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className={`text-xs font-medium ${isToday ? 'text-brand-500' : 'text-gray-400'}`}>
                {DAY_LABELS[i]}
              </span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all ${
                  isToday
                    ? 'bg-brand-500 text-white shadow-md'
                    : done
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : planned
                    ? 'bg-brand-50 text-brand-600 border border-brand-200'
                    : 'bg-white text-gray-400 border border-gray-100'
                }`}
              >
                {done ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  date.getDate()
                )}
              </div>
              {/* dot indicator */}
              <div className={`w-1.5 h-1.5 rounded-full ${planned && !done ? 'bg-brand-400' : done ? 'bg-green-400' : 'bg-transparent'}`} />
            </div>
          );
        })}
      </div>

      {/* Session cards for planned days */}
      {/* Generated programme sessions (shown when no activePlan) */}
      {!hasPlan && generatedProgramme && (() => {
        const week1 = generatedProgramme.weeks[0];
        if (!week1) return null;
        return (
          <div className="flex flex-col gap-2 mb-2">
            {week1.sessions.map((session, i) => {
              const dowIndex = DAY_NAME_TO_INDEX[session.dayOfWeek];
              const date = dowIndex != null ? weekDates[dowIndex] : null;
              const dateStr = date ? dateToStr(date) : '';
              const done = dateStr ? completedDates.has(dateStr) : false;
              const isToday = date ? isSameDay(date, today) : false;
              const mdDisplay = session.mdDay.replace('MD-', 'MD');
              return (
                <div key={i} className={`rounded-2xl border p-3 flex items-center justify-between transition-all ${
                  done ? 'bg-green-50 border-green-200' :
                  isToday ? 'bg-brand-50 border-brand-300 shadow-sm' :
                  'bg-white border-gray-100'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">{mdDisplay}</span>
                      <span className={`text-xs font-semibold ${isToday ? 'text-brand-500' : 'text-gray-400'}`}>{session.dayOfWeek}</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{session.objective}</div>
                  </div>
                  {done
                    ? <CheckCircle2 size={22} className="text-green-500 ml-3 flex-shrink-0" />
                    : <button
                        onClick={() => onNavigate({ screen: 'generated-programme' })}
                        className={`ml-3 flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isToday ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        <Play size={12} />
                        View
                      </button>
                  }
                </div>
              );
            })}
          </div>
        );
      })()}

      {hasPlan && planWeek && planWeek.sessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {planWeek.sessions.map(planSession => {
            const date = weekDates[planSession.dayOfWeek];
            const dateStr = dateToStr(date);
            const done = completedDates.has(dateStr);
            const isPast = date < today && !isSameDay(date, today);
            const template = POSITION_TEMPLATES.find(t => t.id === planSession.templateId);
            const isToday = isSameDay(date, today);

            return (
              <div
                key={planSession.dayOfWeek}
                className={`rounded-2xl border p-3 flex items-center justify-between transition-all ${
                  done
                    ? 'bg-green-50 border-green-200'
                    : isToday
                    ? 'bg-brand-50 border-brand-300 shadow-sm'
                    : isPast
                    ? 'bg-gray-50 border-gray-100 opacity-60'
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold ${isToday ? 'text-brand-500' : 'text-gray-400'}`}>
                      {DAY_LABELS[planSession.dayOfWeek]}
                    </span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="font-semibold text-gray-900 text-sm truncate">{planSession.name}</div>
                  {template && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {planSession.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {done ? (
                  <CheckCircle2 size={22} className="text-green-500 ml-3 flex-shrink-0" />
                ) : (
                  <button
                    onClick={() => onStartWorkout(planSession.templateId, planSession.name)}
                    className={`ml-3 flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isToday
                        ? 'bg-brand-500 text-white hover:bg-brand-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Play size={12} />
                    Start
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : !hasPlan ? (
        <div
          className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 flex flex-col items-center text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-all"
          onClick={() => onNavigate({ screen: 'plans' })}
        >
          <Calendar size={28} className="text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-600">No active plan</p>
          <p className="text-xs text-gray-400 mt-0.5">Choose a position plan to fill your week with sessions</p>
        </div>
      ) : null}
    </section>
  );
}
