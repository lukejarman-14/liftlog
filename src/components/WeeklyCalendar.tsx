import { useState } from 'react';
import { CheckCircle2, Play, Clock, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { WorkoutSession, ActivePlan, NavState, GeneratedProgramme, Exercise, WorkoutExercise, MatchEntry, ProgrammeSession } from '../types';
import {
  POSITION_PLANS,
  POSITION_TEMPLATES,
  getCurrentPlanWeek,
  getWeekDates,
  isSameDay,
} from '../data/positionPlans';
import { sessionToWorkoutExercises, getProgrammeWeekIndex, getProgrammeAnchorMonday } from '../lib/sessionUtils';
import { localDateStr } from '../lib/loadManagement';
import { SessionPreviewModal } from './screens/GeneratedProgramme';
import { useStore } from '../hooks/useStore';
import { isConditioningSession } from '../utils/sessionClassify';

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
  onStartTodayProgrammeSession?: (session: ProgrammeSession) => void;
  onSkipSession?: (weekIdx: number, sessionIdx: number, reason: string) => void;
  onRescheduleSession?: (weekIdx: number, sessionIdx: number, newDate: string) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


const PHASE_COLOURS: Record<string, string> = {
  Foundation: 'bg-blue-100 text-blue-700',
  Build:      'bg-purple-100 text-purple-700',
  Strength:   'bg-brand-100 text-brand-700',
  Power:      'bg-orange-100 text-orange-700',
  Peak:       'bg-red-100 text-red-700',
};


export function WeeklyCalendar({ sessions, activePlan, generatedProgramme, exercises = [], onNavigate, onStartWorkout, onStartProgrammeSession, onStartTodayProgrammeSession, onSkipSession, onRescheduleSession }: WeeklyCalendarProps) {
  const { matchEntries } = useStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [previewSession, setPreviewSession] = useState<ProgrammeSession | null>(null);
  const [previewWeekNumber, setPreviewWeekNumber] = useState<number>(1);
  const [previewOnStart, setPreviewOnStart] = useState<(() => void) | null>(null);
  const [daySheet, setDaySheet] = useState<{ sessions: ProgrammeSession[]; date: Date } | null>(null);
  const [skipSheet, setSkipSheet] = useState<{
    weekIdx: number;
    sessionIdx: number;
    session: ProgrammeSession;
    availableDates: { label: string; date: string }[];
  } | null>(null);
  const [skipView, setSkipView] = useState<'pick' | 'skip-reason' | 'reschedule'>('pick');
  const weekDates = getWeekDates(weekOffset);
  const today = new Date();

  // Header label: "This Week" on current week, date range otherwise
  const weekLabel = (() => {
    if (weekOffset === 0) return 'This Week';
    const mon = weekDates[0];
    const sun = weekDates[6];
    const sameYear = mon.getFullYear() === sun.getFullYear();
    const fmtMon = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
    const fmtSun = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
    return `${fmtMon} – ${fmtSun}`;
  })();

  // Find the plan and current week if a plan is active
  const plan = activePlan ? POSITION_PLANS.find(p => p.id === activePlan.planId) : null;
  const hasPlan = !!plan;
  const weekIdx = activePlan ? getCurrentPlanWeek(activePlan.startDate) + weekOffset : -1;
  const planWeek = plan && weekIdx >= 0 && weekIdx < plan.weeks.length ? plan.weeks[weekIdx] : null;

  // Build a map: dayOfWeek (0-6) → session template info (position plan)
  const plannedByDay = new Map<number, { templateId: string; name: string; tags: string[] }>();
  if (planWeek) {
    for (const s of planWeek.sessions) {
      plannedByDay.set(s.dayOfWeek, s);
    }
  }

  // Week index in the generated programme (offset-adjusted)
  const baseProgWeekIdx = generatedProgramme ? getProgrammeWeekIndex(generatedProgramme) : -1;
  const progWeekIdx = baseProgWeekIdx >= 0
    ? baseProgWeekIdx + weekOffset
    : -1;
  // Only show programme sessions for weeks that actually exist — never clamp to final week
  // (clamping would show final-week sessions on future empty weeks and corrupt skip keys)
  const progWeekInBounds = progWeekIdx >= 0 && progWeekIdx < (generatedProgramme?.weeks.length ?? 0);
  const progWeek = generatedProgramme && progWeekInBounds
    ? generatedProgramme.weeks[progWeekIdx] ?? null
    : null;

  // Compute effective day for each session using absolute dates from the anchor Monday.
  // This prevents sessions mapping to past dates when the programme starts next week.
  const progSessionsByDay = new Map<number, import('../types').ProgrammeSession[]>();
  const progSessionsThisWeek: { session: import('../types').ProgrammeSession; effectiveDayIdx: number; effectiveDate: Date }[] = [];

  if (!hasPlan && progWeek && generatedProgramme) {
    const anchorMonday = getProgrammeAnchorMonday(generatedProgramme);
    const overrides = generatedProgramme.sessionOverrides ?? {};
    progWeek.sessions.forEach((s, si) => {
      const sessionKey = `${progWeekIdx}-${si}`;
      const override = overrides[sessionKey];
      let effectiveDayIdx = -1;

      if (override) {
        const od = new Date(override + 'T12:00:00');
        effectiveDayIdx = weekDates.findIndex(wd => isSameDay(wd, od));
      } else {
        // Absolute date: anchorMonday + week offset + day-of-week offset
        const dayOffset = DAY_NAME_TO_INDEX[s.dayOfWeek] ?? -1;
        if (dayOffset >= 0) {
          const sessionDate = new Date(anchorMonday);
          sessionDate.setDate(anchorMonday.getDate() + progWeekIdx * 7 + dayOffset);
          effectiveDayIdx = weekDates.findIndex(wd => isSameDay(wd, sessionDate));
        }
      }

      if (effectiveDayIdx >= 0) {
        const effectiveDate = weekDates[effectiveDayIdx];
        // Skip sessions that fall before the programme start date — they never existed for this user
        const startDateStr = generatedProgramme.programmeStartDate;
        if (startDateStr) {
          const startMidnight = new Date(startDateStr + 'T00:00:00');
          const sessionMidnight = new Date(
            effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate()
          );
          if (sessionMidnight < startMidnight) return;
        }
        progSessionsThisWeek.push({ session: s, effectiveDayIdx, effectiveDate });
        const existing = progSessionsByDay.get(effectiveDayIdx) ?? [];
        progSessionsByDay.set(effectiveDayIdx, [...existing, s]);
      }
    });
  }
  // Sort sessions into Mon→Sun order so cards always appear chronologically
  progSessionsThisWeek.sort((a, b) => a.effectiveDayIdx - b.effectiveDayIdx);

  const progDayIndices = new Set(progSessionsByDay.keys());

  const handleDayTap = (daySessions: import('../types').ProgrammeSession[], tapDate: Date) => {
    if (daySessions.length === 1) {
      setPreviewWeekNumber(progWeekIdx >= 0 ? progWeekIdx + 1 : 1);
      setPreviewSession(daySessions[0]);
    } else {
      setDaySheet({ sessions: daySessions, date: tapDate });
    }
  };

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
      .filter(s => s.endTime != null && weekDates.some(d => isSameDay(new Date(s.date + 'T12:00:00'), d)))
      .map(s => s.date)
  );

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        {/* Prev / label / next */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-sm font-semibold text-gray-500 uppercase tracking-wide hover:text-brand-500 transition-colors"
            title={weekOffset !== 0 ? 'Back to current week' : undefined}
          >
            {weekLabel}
          </button>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={15} />
          </button>
        </div>

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
          const dateStr = localDateStr(date);
          const done = completedDates.has(dateStr);
          const planned = plannedByDay.has(i) || progDayIndices.has(i);

          const daySessions = progSessionsByDay.get(i);
          const sessionCount = daySessions?.length ?? 0;

          const dayInner = (
            <>
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
              <div className="flex gap-0.5">
                {sessionCount > 0 && !done
                  ? Array.from({ length: Math.min(sessionCount, 3) }).map((_, di) => (
                      <div key={di} className={`w-1.5 h-1.5 rounded-full ${di === 0 ? 'bg-brand-400' : 'bg-emerald-400'}`} />
                    ))
                  : done
                  ? <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  : <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                }
              </div>
            </>
          );

          return daySessions ? (
            <button
              key={i}
              type="button"
              onClick={() => handleDayTap(daySessions, date)}
              className="flex flex-col items-center gap-1"
            >
              {dayInner}
            </button>
          ) : (
            <div key={i} className="flex flex-col items-center gap-1">
              {dayInner}
            </div>
          );
        })}
      </div>

      {/* Banner when programme hasn't started yet this week — offer to start today */}
      {weekOffset === 0 && !hasPlan && generatedProgramme && progWeek && progSessionsThisWeek.length === 0 && (() => {
        const anchorMonday = getProgrammeAnchorMonday(generatedProgramme);
        const firstSession = generatedProgramme.weeks[0]?.sessions[0];
        const firstDayOffset = firstSession ? (DAY_NAME_TO_INDEX[firstSession.dayOfWeek] ?? 0) : 0;
        const firstDate = new Date(anchorMonday);
        firstDate.setDate(anchorMonday.getDate() + firstDayOffset);
        const label = firstDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
        const isCond = firstSession ? isConditioningSession(firstSession) : false;
        return (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 mb-2 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-700">Want to train today?</p>
              <p className="text-xs text-brand-500 mt-0.5">
                First scheduled session is <span className="font-semibold">{label}</span>.
                You can start your Week 1 session now instead.
              </p>
            </div>
            <div className="flex gap-2">
              {firstSession && onStartTodayProgrammeSession && (
                <button
                  onClick={() => onStartTodayProgrammeSession(firstSession)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white ${
                    isCond ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
                  } transition-colors`}
                >
                  <Play size={12} /> Start Session
                </button>
              )}
              {firstSession && (
                <button
                  onClick={() => { setPreviewWeekNumber(1); setPreviewSession(firstSession); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Preview
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Session cards for planned days */}
      {/* Generated programme sessions (shown when no activePlan) */}
      {!hasPlan && generatedProgramme && progWeek && (() => {
        const skipped = generatedProgramme.skippedSessions ?? {};
        return (
          <div className="flex flex-col gap-2 mb-2">
            {progSessionsThisWeek.map(({ session, effectiveDayIdx, effectiveDate }, i) => {
              const date = effectiveDate;
              const dateStr = localDateStr(date);
              const done = completedDates.has(dateStr);
              const isToday = isSameDay(date, today);
              const isPast = date < today && !isToday;
              const isMissed = isPast && !done;
              const sessionKey = `${progWeekIdx}-${i}`;
              const isSkipped = !!skipped[sessionKey];
              const isCond = isConditioningSession(session);
              const mdDisplay = isCond ? 'Conditioning' : session.mdDay.replace('MD-', 'MD');
              const matchOnDay = matchByDay.get(effectiveDayIdx);

              // Available future dates this week for rescheduling
              const availableDates = weekDates
                .map((d, di) => ({ d, di }))
                .filter(({ d }) => d > today || isSameDay(d, today))
                .filter(({ di }) => di !== effectiveDayIdx)
                .map(({ d }) => ({
                  label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
                  date: localDateStr(d),
                }));

              return (
                <div key={i} className={`rounded-2xl border p-3.5 flex items-center justify-between transition-all ${
                  done       ? 'bg-green-50 border-green-200' :
                  isSkipped  ? 'bg-gray-50 border-gray-200 opacity-70' :
                  isMissed   ? 'bg-red-50 border-red-200' :
                  isCond && isToday ? 'bg-emerald-50 border-emerald-300 shadow-sm' :
                  isCond     ? 'bg-white border-emerald-200' :
                  isToday    ? 'bg-brand-50 border-brand-300 shadow-sm' :
                               'bg-white border-gray-100'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        isSkipped  ? 'bg-gray-200 text-gray-500' :
                        isMissed   ? 'bg-red-100 text-red-600' :
                        isCond     ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                      }`}>{isSkipped ? 'Skipped' : isMissed ? 'Missed' : mdDisplay}</span>
                      <span className={`text-xs font-semibold ${
                        isSkipped || isMissed ? 'text-gray-400' :
                        isCond && isToday ? 'text-emerald-600' : isToday ? 'text-brand-500' : 'text-gray-400'
                      }`}>{DAY_LABELS[effectiveDayIdx]}</span>
                      <span className="text-xs text-gray-300 flex items-center gap-0.5">
                        <Clock size={10} className="text-gray-300" />{session.durationMin}m
                      </span>
                      {matchOnDay && (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                          ⚽ {matchOnDay.label ?? (matchOnDay.type === 'match' ? 'Match' : 'Training')}
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-semibold leading-snug ${isSkipped || isMissed ? 'text-gray-400' : 'text-gray-900'}`}>
                      {session.objective}
                    </div>
                    {isSkipped && (
                      <p className="text-xs text-gray-400 mt-0.5">{skipped[sessionKey].reason}</p>
                    )}
                    {session.fvProfile && !isSkipped && (
                      <div className={`text-xs font-medium mt-0.5 truncate ${isCond ? 'text-emerald-600' : 'text-indigo-500'}`}>
                        {isCond ? '🏃' : '⚡'} {session.fvProfile}
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0 flex flex-col gap-1.5 items-end">
                    {done ? (
                      <CheckCircle2 size={22} className="text-green-500" />
                    ) : isSkipped ? (
                      <span className="text-lg">✕</span>
                    ) : isMissed ? (
                      <button
                        onClick={() => { setSkipView('pick'); setSkipSheet({ weekIdx: progWeekIdx, sessionIdx: i, session, availableDates }); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      >
                        <X size={11} /> Missed
                      </button>
                    ) : isToday && onStartProgrammeSession ? (
                      <button
                        onClick={() => {
                          const wk = progWeekIdx >= 0 ? progWeekIdx + 1 : 1;
                          setPreviewWeekNumber(wk);
                          setPreviewOnStart(() => () => {
                            const items = sessionToWorkoutExercises(session, exercises, {
                              strengthSetup: generatedProgramme?.strengthSetup,
                              weekNumber: progWeekIdx >= 0 ? progWeekIdx + 1 : 1,
                              totalWeeks: generatedProgramme?.durationWeeks,
                            });
                            onStartProgrammeSession(`${mdDisplay} · ${session.dayOfWeek}`, items);
                          });
                          setPreviewSession(session);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors ${
                          isCond ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
                        }`}
                      >
                        <Play size={12} /> Start
                      </button>
                    ) : null}
                    {!done && !isSkipped && (
                      <button
                        onClick={() => { setPreviewWeekNumber(progWeekIdx >= 0 ? progWeekIdx + 1 : 1); setPreviewSession(session); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        Preview
                      </button>
                    )}
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
            const dateStr = localDateStr(date);
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

      {/* Day session picker — shown when multiple sessions exist on a tapped day */}
      {daySheet && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={() => setDaySheet(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl p-5 pb-10 z-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-base">
                {isSameDay(daySheet.date, today)
                  ? 'Sessions today'
                  : `Sessions — ${daySheet.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
              </h3>
              <button onClick={() => setDaySheet(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {daySheet.sessions.map((s, i) => {
                const isCond = isConditioningSession(s);
                return (
                  <button
                    key={i}
                    onClick={() => { setDaySheet(null); setPreviewWeekNumber(progWeekIdx >= 0 ? progWeekIdx + 1 : 1); setPreviewSession(s); }}
                    className={`w-full text-left rounded-2xl border p-3.5 flex items-center justify-between transition-all active:scale-[0.98] ${
                      isCond ? 'bg-emerald-50 border-emerald-200' : 'bg-brand-50 border-brand-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isCond ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                        }`}>
                          {isCond ? 'Conditioning' : s.mdDay.replace('MD-', 'MD')}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Clock size={10} />{s.durationMin}m
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{s.objective}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 ml-2 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Skip / Reschedule bottom sheet */}
      {skipSheet && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end" onClick={() => setSkipSheet(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-3xl p-5 pb-10 z-10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-base">
                {skipView === 'pick' ? 'Missed session' : skipView === 'skip-reason' ? 'Mark as skipped' : 'Reschedule to…'}
              </h3>
              <button onClick={() => setSkipSheet(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Session summary */}
            <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">{skipSheet.session.dayOfWeek} · {skipSheet.session.durationMin}min</p>
              <p className="text-sm font-semibold text-gray-800">{skipSheet.session.objective}</p>
            </div>

            {skipView === 'pick' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSkipView('skip-reason')}
                  className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                  <X size={15} /> Mark as skipped
                </button>
                {skipSheet.availableDates.length > 0 && (
                  <button
                    onClick={() => setSkipView('reschedule')}
                    className="w-full py-3.5 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-100 transition-colors"
                  >
                    📅 Move to another day
                  </button>
                )}
              </div>
            )}

            {skipView === 'skip-reason' && (
              <div className="flex flex-col gap-2">
                {['Needed rest', 'Illness / injury', 'Scheduling conflict', 'Other'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => {
                      onSkipSession?.(skipSheet.weekIdx, skipSheet.sessionIdx, reason);
                      setSkipSheet(null);
                    }}
                    className="w-full py-3 px-4 rounded-2xl border border-gray-200 text-sm font-medium text-gray-700 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
                <button onClick={() => setSkipView('pick')} className="text-xs text-gray-400 mt-1 hover:text-gray-600">← Back</button>
              </div>
            )}

            {skipView === 'reschedule' && (
              <div className="flex flex-col gap-2">
                {skipSheet.availableDates.map(({ label, date }) => (
                  <button
                    key={date}
                    onClick={() => {
                      onRescheduleSession?.(skipSheet.weekIdx, skipSheet.sessionIdx, date);
                      setSkipSheet(null);
                    }}
                    className="w-full py-3 px-4 rounded-2xl border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-700 text-left hover:bg-brand-100 transition-colors"
                  >
                    {label}
                  </button>
                ))}
                <button onClick={() => setSkipView('pick')} className="text-xs text-gray-400 mt-1 hover:text-gray-600">← Back</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session preview modal */}
      {previewSession && (
        <SessionPreviewModal
          session={previewSession}
          weekNumber={previewWeekNumber}
          totalWeeks={generatedProgramme?.durationWeeks ?? 1}
          strengthSetup={generatedProgramme?.strengthSetup}
          exercises={exercises}
          onClose={() => { setPreviewSession(null); setPreviewOnStart(null); }}
          onStart={previewOnStart ?? undefined}
        />
      )}
    </section>
  );
}
