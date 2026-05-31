import { useState, useCallback, useMemo } from 'react';
import { CalendarDays, AlertTriangle, ChevronRight, Activity, Zap, FlaskConical, Dumbbell, Share2 } from 'lucide-react';
import { Layout } from '../Layout';
import { trackEvent } from '../../lib/analytics';
import { ShareStatsCard } from '../ShareStatsCard';
import { WeeklyCalendar } from '../WeeklyCalendar';
import { DailyReadinessWidget } from '../DailyReadinessWidget';
import { WorkoutSession, NavState, ActivePlan, DailyReadiness, GeneratedProgramme, Exercise, WorkoutExercise, ProgrammeSession } from '../../types';
import { useStore } from '../../hooks/useStore';
import { POSITION_PLANS, getCurrentPlanWeek } from '../../data/positionPlans';
import { getProgrammeWeekIndex, getProgrammeAnchorMonday } from '../../lib/sessionUtils';
import { localDateStr } from '../../lib/loadManagement';
import { DAY_INDEX } from '../../lib/utils';

interface DashboardProps {
  sessions: WorkoutSession[];
  activePlan: ActivePlan | null;
  activeProgramme: GeneratedProgramme | null;
  profilePicture: string | null;
  todayReadiness: DailyReadiness | null;
  exercises: Exercise[];
  onSaveReadiness: (r: DailyReadiness) => void;
  onNavigate: (nav: NavState) => void;
  onStartWorkout: (templateId: string, name: string) => void;
  onStartProgrammeSession: (name: string, items: WorkoutExercise[]) => void;
  onStartTodayProgrammeSession?: (session: ProgrammeSession) => void;
  onOpenStrengthSetup?: () => void;
  onSkipSession?: (weekIdx: number, sessionIdx: number, reason: string) => void;
  onRescheduleSession?: (weekIdx: number, sessionIdx: number, newDate: string) => void;
  referralCode?: string;
  cloudUnlinked?: boolean; // Supabase configured but no active session — data not backed up
}


function IntensityPrompt({ date, onSave }: {
  date: string;
  onSave: (intensity: number, minutes: number | undefined) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [minutesStr, setMinutesStr] = useState('');
  const [skipped, setSkipped] = useState(false);
  const d = new Date(date + 'T12:00:00');
  const displayDate = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  if (skipped) {
    return (
      <div className="w-full mb-5 p-4 rounded-2xl border-2 border-orange-200 bg-orange-50">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-700">Load adjustment skipped</p>
            <p className="text-xs text-orange-600 mt-0.5">Without your session intensity, recovery load guidance may be less accurate. Rate it next time for best results.</p>
          </div>
        </div>
      </div>
    );
  }

  const LEVELS = [
    { v: 1, label: 'Very Easy', desc: 'Hardly any effort' },
    { v: 2, label: 'Easy', desc: 'Light session / warm-up' },
    { v: 3, label: 'Moderate', desc: 'Standard match / training' },
    { v: 4, label: 'Hard', desc: 'Intense, demanding session' },
    { v: 5, label: 'Max Effort', desc: 'Exhausting — left everything' },
  ];

  return (
    <div className="w-full mb-5 p-4 rounded-2xl border-2 border-brand-200 bg-white shadow-sm">
      <p className="text-sm font-bold text-gray-900 mb-0.5">⚽ How intense was your session?</p>
      <p className="text-xs text-gray-500 mb-3">{displayDate} — Rate to calibrate your recovery load</p>
      <div className="flex flex-col gap-1.5 mb-3">
        {LEVELS.map(({ v, label, desc }) => (
          <button
            key={v}
            onClick={() => setSelected(v)}
            className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
              selected === v
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="font-semibold text-sm">{v} — {label}</span>
            <span className="text-xs text-gray-400 ml-2">{desc}</span>
          </button>
        ))}
      </div>
      <div className="mb-4">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
          Minutes played (optional)
        </label>
        <input
          type="number"
          min="1"
          max="120"
          value={minutesStr}
          onChange={e => setMinutesStr(e.target.value)}
          placeholder="e.g. 90"
          style={{ fontSize: '16px' }}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { if (selected) onSave(selected, minutesStr ? parseInt(minutesStr, 10) : undefined); }}
          disabled={!selected}
          className="flex-1 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-brand-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => setSkipped(true)}
          className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export function Dashboard({ sessions, activePlan, activeProgramme, profilePicture, todayReadiness, exercises, onSaveReadiness, onNavigate, onStartWorkout, onStartProgrammeSession, onStartTodayProgrammeSession, onOpenStrengthSetup, onSkipSession, onRescheduleSession, referralCode, cloudUnlinked = false }: DashboardProps) {
  const { userProfile, getPendingIntensityCheck, saveFootballIntensity, saveMatchEntry, matchEntries, getDaysSinceLastTest } = useStore();
  const pendingIntensityDate = getPendingIntensityCheck();
  const [showShareCard, setShowShareCard] = useState(false);

  // Retest banner: dismissed for 10 days via localStorage timestamp
  const [retestDismissed, setRetestDismissed] = useState(
    () => Date.now() < Number(localStorage.getItem('vf_retest_dismissed_until') ?? 0),
  );
  const dismissRetest = useCallback(() => {
    localStorage.setItem('vf_retest_dismissed_until', String(Date.now() + 10 * 24 * 60 * 60 * 1000));
    setRetestDismissed(true);
  }, []);

  const daysSinceTest = getDaysSinceLastTest();
  const showRetestBanner = !retestDismissed && (daysSinceTest === null || daysSinceTest >= 42);

  const initials = userProfile
    ? `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const sessionStreak = useMemo(() => {
    if (!sessions.length) return 0;
    const toMonday = (d: Date) => {
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return localDateStr(mon); // local date, not UTC ISO string
    };
    // Parse date strings at local noon to avoid UTC midnight shifting the day
    const weeks = new Set(sessions.filter(s => s.date).map(s => toMonday(new Date(s.date + 'T12:00:00'))));
    let n = 0;
    const now = new Date();
    let cur = new Date(now);
    if (!weeks.has(toMonday(now))) cur.setDate(cur.getDate() - 7);
    while (n < 52) {
      if (!weeks.has(toMonday(cur))) break;
      n++;
      cur.setDate(cur.getDate() - 7);
    }
    return n;
  }, [sessions]);
  let progWeek: number | null = null;
  let progTotal: number | null = null;
  let progLabel = '';
  let progPhase = '';
  let progPct: number | null = null;
  if (activeProgramme) {
    progTotal = activeProgramme.durationWeeks;
    progWeek = getProgrammeWeekIndex(activeProgramme) + 1;
    progLabel = activeProgramme.summary.split('·')[0].trim();
    const weekData = activeProgramme.weeks[Math.min(progWeek - 1, activeProgramme.weeks.length - 1)];
    progPhase = weekData?.phase ?? '';

    // Session-based completion: count programme session dates that have a matching completed session.
    // Respect sessionOverrides so rescheduled sessions are checked against their new date.
    const anchor = getProgrammeAnchorMonday(activeProgramme);
    const completedDates = new Set(sessions.map(s => s.date));
    const overrides = activeProgramme.sessionOverrides ?? {};
    let totalSessions = 0;
    let completedSessions = 0;
    activeProgramme.weeks.forEach((week, wi) => {
      week.sessions.forEach((session, si) => {
        const overrideKey = `${wi}-${si}`;
        let dateStr: string;
        if (overrides[overrideKey]) {
          dateStr = overrides[overrideKey];
        } else {
          const dayIdx = DAY_INDEX[session.dayOfWeek] ?? 0;
          const d = new Date(anchor);
          d.setDate(anchor.getDate() + wi * 7 + dayIdx);
          dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        totalSessions++;
        if (completedDates.has(dateStr)) completedSessions++;
      });
    });
    progPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  } else if (activePlan) {
    const plan = POSITION_PLANS.find(p => p.id === activePlan.planId);
    if (plan) {
      progTotal = plan.weeks.length;
      progWeek = Math.min(getCurrentPlanWeek(activePlan.startDate) + 1, progTotal);
      progLabel = plan.shortName;
      progPct = Math.round((progWeek / progTotal) * 100);
    }
  }

  return (
    <>
    <Layout
      title="Vector Football"
      leftAction={
        <button
          onClick={() => onNavigate({ screen: 'profile' })}
          className="relative w-9 h-9 rounded-full overflow-visible flex-shrink-0"
          title={cloudUnlinked ? 'Confirm your email — details may be lost' : undefined}
        >
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-200 flex items-center justify-center bg-brand-100 hover:border-brand-400 transition-colors">
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-brand-600">{initials}</span>
            )}
          </div>
          {cloudUnlinked && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full" />
          )}
        </button>
      }
      rightAction={
        <button
          onClick={() => onNavigate({ screen: 'testing-battery' })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-200 text-brand-600 text-xs font-semibold rounded-xl hover:bg-brand-100 transition-colors"
        >
          <Activity size={14} />
          Take Test
        </button>
      }
    >
      {cloudUnlinked && (
        <button
          onClick={() => onNavigate({ screen: 'profile' })}
          className="w-full flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 text-left hover:bg-red-100 transition-colors"
        >
          <span className="text-red-500 text-base shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-700">Confirm your email address</p>
            <p className="text-xs text-red-500 leading-snug">Your data may be lost if your email is unconfirmed — tap to go to Profile.</p>
          </div>
          <ChevronRight size={14} className="text-red-400 shrink-0" />
        </button>
      )}

      {sessionStreak > 0 && (() => {
        const tier = sessionStreak >= 12 ? 'red' : sessionStreak >= 8 ? 'orange' : sessionStreak >= 4 ? 'amber' : 'green';

        const palette: Record<string, { bg: string; border: string; iconBg: string; textHead: string; textSub: string; numCol: string; emoji: string }> = {
          green:  { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', textHead: 'text-emerald-900', textSub: 'text-emerald-600', numCol: 'text-emerald-400', emoji: '🌱' },
          amber:  { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', textHead: 'text-amber-900', textSub: 'text-amber-600', numCol: 'text-amber-400', emoji: '🔥' },
          orange: { bg: 'bg-orange-50', border: 'border-orange-200', iconBg: 'bg-orange-100', textHead: 'text-orange-900', textSub: 'text-orange-600', numCol: 'text-orange-400', emoji: '🔥' },
          red:    { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', textHead: 'text-red-900', textSub: 'text-red-600', numCol: 'text-red-400', emoji: '💥' },
        };
        const s = palette[tier];

        const sub = sessionStreak >= 12 ? "Elite consistency. You're in the 1%."
          : sessionStreak >= 8 ? "Serious momentum — you're making real gains."
          : sessionStreak >= 4 ? "Building momentum — don't break the chain!"
          : sessionStreak === 1 ? 'You trained this week — keep it going!'
          : 'Good start — consistency is everything.';

        const milestoneLabel = sessionStreak >= 12 ? '🏅 12-week milestone'
          : sessionStreak >= 8 ? '🥈 8-week milestone'
          : sessionStreak >= 4 ? '🥉 4-week milestone'
          : null;

        const handleShare = () => {
          trackEvent('streak_shared', { streak: sessionStreak, tier });
          setShowShareCard(true);
        };

        return (
          <div className={`mb-4 flex items-center gap-3 p-3.5 rounded-2xl border ${s.bg} ${s.border}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center`}>
              <span className="text-xl leading-none">{s.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-bold ${s.textHead}`}>{sessionStreak}-week streak</p>
                {milestoneLabel && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.iconBg} ${s.textSub}`}>
                    {milestoneLabel}
                  </span>
                )}
              </div>
              <p className={`text-xs ${s.textSub} leading-snug mt-0.5`}>{sub}</p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="text-right">
                <span className={`text-2xl font-black ${s.numCol}`}>{sessionStreak}</span>
                <p className={`text-[10px] ${s.numCol} leading-tight`}>weeks</p>
              </div>
              <button
                onClick={handleShare}
                className={`w-8 h-8 rounded-xl ${s.iconBg} flex items-center justify-center hover:opacity-80 transition-opacity`}
              >
                <Share2 size={14} className={s.textSub} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Current Plan */}
      {progWeek !== null && progTotal !== null && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Plan</p>

          {progWeek >= progTotal ? (
            <div className="w-full rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-white overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🏆</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-brand-700 truncate">Programme Complete!</p>
                    <p className="text-xs text-brand-500 mt-0.5 truncate">{progLabel} · {progTotal} weeks done</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-brand-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full w-full bg-brand-500 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onNavigate({ screen: 'programme-builder' })}
                    className="flex-1 py-2.5 bg-brand-500 text-white font-bold rounded-xl text-xs hover:bg-brand-600 transition-colors"
                  >
                    ⚡ Build Next Programme
                  </button>
                  <button
                    onClick={() => onNavigate({ screen: 'generated-programme' })}
                    className="px-3 py-2.5 border border-brand-200 text-brand-600 font-semibold rounded-xl text-xs hover:bg-brand-50 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onNavigate({ screen: activeProgramme ? 'generated-programme' : 'plans' })}
              className="w-full p-4 rounded-2xl border border-brand-200 bg-white hover:bg-brand-50 transition-colors text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{progLabel}</div>
                  {progPhase && (
                    <div className="text-[11px] text-brand-500 font-medium mt-0.5">{progPhase}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  <span className="text-xs font-bold text-brand-600">
                    {progPct ?? 0}%
                  </span>
                  <ChevronRight size={14} className="text-gray-400" />
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${progPct ?? 0}%` }}
                />
              </div>
              <div className="text-[11px] text-gray-400 mt-1.5">Week {progWeek} of {progTotal}</div>
            </button>
          )}
        </div>
      )}

      {/* Strength setup nudge — shown when programme exists, not yet complete, and no baseline configured */}
      {activeProgramme && !activeProgramme.strengthSetup && onOpenStrengthSetup && progWeek !== null && progTotal !== null && progWeek < progTotal && (
        <button
          onClick={onOpenStrengthSetup}
          className="w-full mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100 transition-all active:scale-[0.98]"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
              <Dumbbell size={18} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-900">Unlock weight targets</span>
                <ChevronRight size={15} className="text-amber-400 flex-shrink-0" />
              </div>
              <p className="text-xs text-amber-700 mt-0.5 leading-snug">
                Enter your lift baselines to get week-specific loads and priming singles for every session.
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Build a Programme CTA — only shown when no active plan/programme */}
      {!activeProgramme && !activePlan && (
        <button
          onClick={() => onNavigate({ screen: 'programme-builder' })}
          className="w-full mb-4 p-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-left shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-300" />
              <span className="font-bold text-sm">Build My Programme</span>
            </div>
            <ChevronRight size={16} className="text-white/70" />
          </div>
          <p className="text-xs text-white/80 leading-snug">
            Football S&C plan — position-specific, match-day periodised.
          </p>
        </button>
      )}

      {/* Edit Calendar button */}
      <button
        onClick={() => onNavigate({ screen: 'load-calendar' })}
        className="w-full mb-5 py-3 px-4 rounded-2xl border-2 border-brand-200 bg-brand-50 text-brand-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-100 transition-colors"
      >
        <CalendarDays size={16} />
        Edit Match Calendar
      </button>

      {/* Post-football session intensity check */}
      {pendingIntensityDate && (
        <IntensityPrompt
          date={pendingIntensityDate}
          onSave={(intensity, minutes) => {
            saveFootballIntensity(pendingIntensityDate, intensity);
            const entry = matchEntries.find(e => e.date === pendingIntensityDate);
            if (entry) saveMatchEntry({ ...entry, intensity, ...(minutes ? { minutes } : {}) });
            trackEvent('football_intensity_logged', { intensity, minutes: minutes ?? null });
          }}
        />
      )}

      {/* Re-test reminder banner */}
      {showRetestBanner && (
        <div className="mb-4 p-4 rounded-2xl bg-blue-50 border border-blue-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <FlaskConical size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-800">
                  {daysSinceTest === null ? 'Run your fitness baseline' : `Time to re-test — ${daysSinceTest} days since last test`}
                </p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  {daysSinceTest === null
                    ? 'Sprint, CMJ and Yo-Yo tests give you a baseline to track real progress over the season.'
                    : 'Retesting every 6 weeks shows you exactly how much faster, higher, and fitter you\'ve become.'}
                </p>
                <button
                  onClick={() => onNavigate({ screen: 'testing-battery' })}
                  className="mt-2 text-xs font-semibold text-blue-600 underline underline-offset-2"
                >
                  Take test now →
                </button>
              </div>
            </div>
            <button onClick={dismissRetest} className="text-blue-400 hover:text-blue-600 flex-shrink-0 text-lg leading-none">✕</button>
          </div>
        </div>
      )}

      {/* Weekly Calendar */}
      <WeeklyCalendar
        sessions={sessions}
        activePlan={activePlan}
        generatedProgramme={activeProgramme}
        exercises={exercises}
        onNavigate={onNavigate}
        onStartWorkout={onStartWorkout}
        onStartProgrammeSession={onStartProgrammeSession}
        onStartTodayProgrammeSession={onStartTodayProgrammeSession}
        onSkipSession={onSkipSession}
        onRescheduleSession={onRescheduleSession}
      />

      {/* Daily readiness check-in */}
      <DailyReadinessWidget existing={todayReadiness} onSave={onSaveReadiness} />

      {/* Referral card — shown to all users with a code */}
      {referralCode && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white font-extrabold text-sm">🤝 Refer a Friend</p>
              <p className="text-white/70 text-xs mt-0.5">They get 21 days free · You get +14 days</p>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/20">
              <span className="text-white font-black tracking-widest text-sm">{referralCode}</span>
            </div>
          </div>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: 'Join Vector Football',
                    text: `Use my code ${referralCode} on Vector Football and get 21 days free! vectorfootball.co.uk`,
                  });
                } catch { /* user cancelled share sheet */ }
              } else {
                try {
                  await navigator.clipboard.writeText(referralCode);
                } catch { /* clipboard denied — silently ignore */ }
              }
            }}
            className="w-full py-2 rounded-xl bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors"
          >
            Share Code
          </button>
        </div>
      )}

    </Layout>

    {showShareCard && (
      <ShareStatsCard
        sessions={sessions}
        streak={sessionStreak}
        playerName={userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Footballer'}
        onClose={() => setShowShareCard(false)}
      />
    )}
    </>
  );
}
