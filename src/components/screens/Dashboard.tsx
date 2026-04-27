import { Dumbbell, Plus, TrendingUp, Clock, Flame } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { WeeklyCalendar } from '../WeeklyCalendar';
import { WorkoutSession, WorkoutTemplate, NavState, ActivePlan } from '../../types';
import { useStore } from '../../hooks/useStore';

interface DashboardProps {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  activePlan: ActivePlan | null;
  profilePicture: string | null;
  onNavigate: (nav: NavState) => void;
  onStartWorkout: (templateId: string, name: string) => void;
}

function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function totalVolume(session: WorkoutSession) {
  return session.exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0);
}

export function Dashboard({ sessions, templates, activePlan, profilePicture, onNavigate, onStartWorkout }: DashboardProps) {
  const { getExercise, userProfile } = useStore();
  const recent = [...sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 5);

  const thisWeekSessions = sessions.filter(s => {
    const d = new Date(s.date);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return d >= weekStart;
  });

  const totalWeekVolume = thisWeekSessions.reduce((acc, s) => acc + totalVolume(s), 0);

  const initials = userProfile
    ? `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}`.toUpperCase()
    : '?';

  return (
    <Layout
      title="LiftLog"
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
          onClick={() => onNavigate({ screen: 'workout-builder' })}
          className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors"
        >
          <Plus size={18} />
        </button>
      }
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-brand-500">{thisWeekSessions.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">This week</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-brand-500">{sessions.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-brand-500">
            {totalWeekVolume >= 1000 ? `${(totalWeekVolume / 1000).toFixed(1)}k` : totalWeekVolume}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Vol (kg)</div>
        </Card>
      </div>

      {/* Weekly calendar */}
      <WeeklyCalendar sessions={sessions} activePlan={activePlan} onNavigate={onNavigate} onStartWorkout={onStartWorkout} />

      {/* Quick start */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Start</h2>
        <Button fullWidth size="lg" onClick={() => onNavigate({ screen: 'workout-builder' })}>
          <Dumbbell size={18} />
          Start New Workout
        </Button>
        {templates.length > 0 && (
          <div className="grid grid-cols-1 gap-2 mt-3">
            {templates.slice(0, 3).map(t => (
              <Card
                key={t.id}
                className="p-3 flex items-center justify-between"
                onClick={() => onNavigate({ screen: 'workout-builder', templateId: t.id })}
              >
                <div>
                  <div className="font-medium text-gray-900 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.exercises.length} exercises</div>
                </div>
                <Flame size={16} className="text-brand-400" />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent workouts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent</h2>
          {sessions.length > 5 && (
            <button
              onClick={() => onNavigate({ screen: 'history' })}
              className="text-xs text-brand-500 font-medium"
            >
              View all
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <Card className="p-8 text-center">
            <Dumbbell size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No workouts yet.</p>
            <p className="text-gray-400 text-xs mt-1">Start your first one above!</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map(session => {
              const duration = session.endTime
                ? formatDuration(session.endTime - session.startTime)
                : null;
              const vol = totalVolume(session);
              return (
                <Card
                  key={session.id}
                  className="p-4"
                  onClick={() => onNavigate({ screen: 'history', sessionId: session.id })}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">{session.name}</div>
                      <div className="text-xs text-gray-400">{formatDate(session.date)}</div>
                    </div>
                    {duration && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} />
                        {duration}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {session.exercises.slice(0, 4).map(ex => {
                      const exercise = getExercise(ex.exerciseId);
                      return exercise ? (
                        <span key={ex.exerciseId} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {exercise.name}
                        </span>
                      ) : null;
                    })}
                    {session.exercises.length > 4 && (
                      <span className="text-xs text-gray-400">+{session.exercises.length - 4} more</span>
                    )}
                  </div>
                  {vol > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-brand-500 font-medium">
                      <TrendingUp size={12} />
                      {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol} kg total volume
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}
