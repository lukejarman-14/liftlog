import { useState } from 'react';
import { CalendarDays, AlertTriangle, ChevronRight, Activity, Zap } from 'lucide-react';
import { Layout } from '../Layout';

import { WeeklyCalendar } from '../WeeklyCalendar';
import { DailyReadinessWidget } from '../DailyReadinessWidget';
import { WorkoutSession, WorkoutTemplate, NavState, ActivePlan, DailyReadiness, GeneratedProgramme, Exercise, WorkoutExercise } from '../../types';
import { useStore } from '../../hooks/useStore';
import { POSITION_PLANS, getCurrentPlanWeek } from '../../data/positionPlans';

interface DashboardProps {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  activePlan: ActivePlan | null;
  activeProgramme: GeneratedProgramme | null;
  profilePicture: string | null;
  todayReadiness: DailyReadiness | null;
  exercises: Exercise[];
  onSaveReadiness: (r: DailyReadiness) => void;
  onNavigate: (nav: NavState) => void;
  onStartWorkout: (templateId: string, name: string) => void;
  onStartProgrammeSession: (name: string, items: WorkoutExercise[]) => void;
}

// ── Football session intensity prompt ──────────────────────────────────────

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

export function Dashboard({ sessions, activePlan, activeProgramme, profilePicture, todayReadiness, exercises, onSaveReadiness, onNavigate, onStartWorkout, onStartProgrammeSession }: DashboardProps) {
  const { userProfile, getPendingIntensityCheck, saveFootballIntensity, saveMatchEntry, matchEntries } = useStore();
  const pendingIntensityDate = getPendingIntensityCheck();

  const initials = userProfile
    ? `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}`.toUpperCase()
    : '?';

  // Progression bar: derive current week / total weeks
  let progWeek: number | null = null;
  let progTotal: number | null = null;
  let progLabel = '';
  if (activeProgramme) {
    progTotal = activeProgramme.durationWeeks;
    const weeksSinceCreated = Math.floor((Date.now() - activeProgramme.createdAt) / (7 * 24 * 60 * 60 * 1000));
    progWeek = Math.min(weeksSinceCreated + 1, progTotal);
    progLabel = activeProgramme.summary.split('·')[0].trim();
  } else if (activePlan) {
    const plan = POSITION_PLANS.find(p => p.id === activePlan.planId);
    if (plan) {
      progTotal = plan.weeks.length;
      progWeek = Math.min(getCurrentPlanWeek(activePlan.startDate) + 1, progTotal);
      progLabel = plan.shortName;
    }
  }

  return (
    <Layout
      title="VectorFootball"
      leftAction={
        <button
          onClick={() => onNavigate({ screen: 'profile' })}
          className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-200 flex items-center justify-center bg-brand-100 flex-shrink-0 hover:border-brand-400 transition-colors"
        >
          {profilePicture ? (
            <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-brand-600">{initials}</span>
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
      {/* Current Plan */}
      {progWeek !== null && progTotal !== null && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Plan</p>
          <button
            onClick={() => onNavigate({ screen: activeProgramme ? 'generated-programme' : 'plans' })}
            className="w-full flex items-center justify-between p-3 rounded-2xl border border-brand-200 bg-white hover:bg-brand-50 transition-colors"
          >
            <div className="text-left min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{progLabel}</div>
              <div className="text-xs text-gray-400 mt-0.5">Week {progWeek} of {progTotal}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full"
                  style={{ width: `${(progWeek / progTotal) * 100}%` }}
                />
              </div>
              <ChevronRight size={14} className="text-gray-400" />
            </div>
          </button>
        </div>
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
            // update the match entry with minutes if provided
            const entry = matchEntries.find(e => e.date === pendingIntensityDate);
            if (entry && minutes) saveMatchEntry({ ...entry, minutes, intensity });
          }}
        />
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
      />

      {/* Daily readiness check-in */}
      <DailyReadinessWidget existing={todayReadiness} onSave={onSaveReadiness} />

    </Layout>
  );
}
