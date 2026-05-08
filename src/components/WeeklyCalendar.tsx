import { useState } from 'react';
import { CheckCircle2, Play, Clock } from 'lucide-react';
import { WorkoutSession, ActivePlan, NavState, GeneratedProgramme, Exercise, WorkoutExercise, MatchEntry } from '../types';
import {
  POSITION_PLANS,
  POSITION_TEMPLATES,
  getCurrentPlanWeek,
  getWeekDates,
  isSameDay,
} from '../data/positionPlans';
import { sessionToWorkoutExercises, getProgrammeWeekIndex } from '../lib/sessionUtils';
import { SessionPreviewModal } from './screens/GeneratedProgramme';
import { useStore } from '../hooks/useStore';

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

interface WeeklyCalendarProps {
  sessions: WorkoutSession[];
  activePlan: ActivePlan | null;
  generatedProgramme?: GeneratedProgramme | null;
  exercises?: Exercise[];
  onNavigate: (nav: NavState) => void;
  onStartWorkout: (templateId: string, name: string) => void;
  onStartProgrammeSession?: (name: string, items: WorkoutExercise[]) => void;
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

export function WeeklyCalendar({ sessions, activePlan, generatedProgramme, exercises = [], onNavigate, onStartWorkout, onStartProgrammeSession }: WeeklyCalendarProps) {
  const { matchEntries } = useStore();
  const [previewSession, setPreviewSession] = useState<import('../types').ProgrammeSession | null>(null);
  const weekDates = getWeekDates(0);
  const today = new Date();

  // Find the plan and current week if a plan is active
  const plan = activePlan ? POSITION_PLANS.find(p => p.id === activePlan.planId) : null;
  const hasPlan = !!plan;
  const weekIdx = activePlan ? getCurrentPlanWeek(activePlan.startDate) : -1;
  const planWeek = plan && weekIdx >= 0 && weekIdx < plan.weeks.length ? plan.weeks[weekIdx] : null;

  // Build a map: dayOfWeek (0-6) → session template info (position plan)
  const plannedByDay = new Map<number, { templateId: string; name: string; tags: string[] }>();
  if (planWeek) {
    for (const s of planWeek.sessions) {
      plannedByDay.set(s.dayOfWeek, s);
    }
  }

  // Current week of the generated programme
  const progWeekIdx = generatedProgramme ? getProgrammeWeekIndex(generatedProgramme) : -1;
  const progWeek = generatedProgramme && progWeekIdx >= 0
    ? generatedProgramme.weeks[progWeekIdx] ?? null
    : null;

  // Build map: day index → programme session (for tap-to-preview + dots)
  const progSessionByDay = new Map<number, import('../types').ProgrammeSession>();
  if (!hasPlan && progWeek) {
    for (const s of progWeek.sessions) {
      const idx = DAY_NAME_TO_INDEX[s.dayOfWeek];
      if (idx != null) progSessionByDay.set(idx, s);
    }
  }
  const progDayIndices = new Set(progSessionByDay.keys());

  // Match entries this week keyed by day index
  const matchByDay = new Map<number, MatchEntry>();
  for (const entry of matchEntries) {
    const d = new Date(entry.date + 'T12:00:00');
    const idx = weekDates.findIndex(wd => isSameDay(wd, d));
    if (idx >= 0) matchByDay.set(idx, entry);
  }

  // Completed session dates (as YYYY-MM-DD strings) for this week
  const completedDates = new Set(
    sessions
      .filter(s => s.endTime != null && weekDates.some(d => isSameDay(new Date(s.date), d)))
      .map(s => s.date)
  );

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">This Week</h2>
        {hasPlan && planWeek && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PHASE_COLOURS[planWeek.phase] ?? 'bg-gray-100 text-gray-600'}`}>
            {plan!.shortName} · Wk {planWeek.weekNumber} · {planWeek.phase}
          </span>
        )}
        {!hasPlan && progWeek && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PHASE_COLOURS[progWeek.phase] ?? 'bg-gray-100 text-gray-600'}`}>
            Wk {progWeekIdx + 1} · {progWeek.phase}
          </span>
        )}
        {!hasPlan && !progWeek && (
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
          const planned = plannedByDay.has(i) || progDayIndices.has(i);

          const sess = progSessionByDay.get(i);
          const El = sess ? 'button' : 'div';
          return (
            <El
              key={i}
              {...(sess ? { onClick: () => setPreviewSession(sess) } : {})}
              className="flex flex-col items-center gap-1"
            >
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
            </El>
          );
        })}
      </div>

      {/* Session cards for planned days */}
      {/* Generated programme sessions (shown when no activePlan) */}
      {!hasPlan && generatedProgramme && progWeek && (() => {
        return (
          <div className="flex flex-col gap-2 mb-2">
            {progWeek.sessions.map((session, i) => {
              const dowIndex = DAY_NAME_TO_INDEX[session.dayOfWeek];
              const date = dowIndex != null ? weekDates[dowIndex] : null;
              const dateStr = date ? dateToStr(date) : '';
              const done = dateStr ? completedDates.has(dateStr) : false;
              const isToday = date ? isSameDay(date, today) : false;
              const isCond = session.mdDay === 'Conditioning';
              const mdDisplay = isCond ? 'Conditioning' : session.mdDay.replace('MD-', 'MD');
              // Match entry on the same day (to show opponent)
              const matchOnDay = dowIndex != null ? matchByDay.get(dowIndex) : undefined;
              return (
                <div key={i} className={`rounded-2xl border p-3.5 flex items-center justify-between transition-all ${
                  done ? 'bg-green-50 border-green-200' :
                  isCond && isToday ? 'bg-emerald-50 border-emerald-300 shadow-sm' :
                  isCond ? 'bg-white border-emerald-200' :
                  isToday ? 'bg-brand-50 border-brand-300 shadow-sm' :
                  'bg-white border-gray-100'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        isCond ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                      }`}>{mdDisplay}</span>
                      <span className={`text-xs font-semibold ${
                        isCond && isToday ? 'text-emerald-600' : isToday ? 'text-brand-500' : 'text-gray-400'
                      }`}>{session.dayOfWeek}</span>
                      <span className="text-xs text-gray-300 flex items-center gap-0.5">
                        <Clock size={10} className="text-gray-300" />{session.durationMin}m
                      </span>
                      {matchOnDay && (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                          ⚽ {matchOnDay.label ?? (matchOnDay.type === 'match' ? 'Match' : 'Training')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 leading-snug">{session.objective}</div>
                    {session.fvProfile && (
                      <div className={`text-xs font-medium mt-0.5 truncate ${isCond ? 'text-emerald-600' : 'text-indigo-500'}`}>
                        {isCond ? '🏃' : '⚡'} {session.fvProfile}
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0 flex flex-col gap-1.5 items-end">
                    {done
                      ? <CheckCircle2 size={22} className="text-green-500" />
                      : isToday && onStartProgrammeSession
                      ? <button
                          onClick={() => {
                            const items = sessionToWorkoutExercises(session, exercises);
                            onStartProgrammeSession(`${mdDisplay} · ${session.dayOfWeek}`, items);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors ${
                            isCond ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
                          }`}
                        >
                          <Play size={12} />
                          Start
                        </button>
                      : null
                    }
                    <button
                      onClick={() => setPreviewSession(session)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      Preview
                    </button>
                  </div>
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
      ) : null}

      {/* Session preview modal */}
      {previewSession && (
        <SessionPreviewModal session={previewSession} onClose={() => setPreviewSession(null)} />
      )}
    </section>
  );
}
