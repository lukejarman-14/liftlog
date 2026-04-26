import { Trash2, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { WorkoutSession, NavState, MeasureType, CompletedSet } from '../../types';
import { useStore } from '../../hooks/useStore';

function formatSetChip(set: CompletedSet, measureType: MeasureType, unit?: string): string {
  const lbl = unit ?? (measureType === 'time' ? 's' : measureType === 'distance' ? 'm' : measureType === 'height' ? 'cm' : measureType === 'score' ? '' : 'kg');
  switch (measureType) {
    case 'reps':     return `${set.reps} reps`;
    case 'strength': return `${set.weight}kg × ${set.reps}`;
    default:         return `${set.weight}${lbl ? ' ' + lbl : ''}`;
  }
}

interface HistoryProps {
  sessions: WorkoutSession[];
  onNavigate: (nav: NavState) => void;
  onDeleteSession: (id: string) => void;
}

function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function totalVolume(session: WorkoutSession) {
  return session.exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0);
}

function SessionCard({ session, onDelete, onNavigate }: {
  session: WorkoutSession;
  onDelete: () => void;
  onNavigate: (nav: NavState) => void;
}) {
  const { getExercise } = useStore();
  const [expanded, setExpanded] = useState(false);
  const duration = session.endTime ? formatDuration(session.endTime - session.startTime) : null;
  const vol = totalVolume(session);

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">{session.name}</div>
            <div className="text-xs text-gray-400">{formatDate(session.date)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors ml-2"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          {duration && (
            <span className="flex items-center gap-1"><Clock size={12} />{duration}</span>
          )}
          {vol > 0 && (
            <span className="flex items-center gap-1 text-brand-500 font-medium">
              <TrendingUp size={12} />
              {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol} kg
            </span>
          )}
          <span>{session.exercises.length} exercises</span>
          <span>{session.exercises.reduce((a, e) => a + e.sets.length, 0)} sets</span>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide' : 'Show'} details
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          <div className="flex flex-col gap-3">
            {session.exercises.map(ex => {
              const exercise = getExercise(ex.exerciseId);
              if (!exercise) return null;
              return (
                <div key={ex.exerciseId}>
                  <button
                    onClick={() => onNavigate({ screen: 'exercise-detail', exerciseId: ex.exerciseId })}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 mb-1"
                  >
                    {exercise.name}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.sets.map((set, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {formatSetChip(set, exercise.measureType ?? 'strength', exercise.unit)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export function History({ sessions, onNavigate, onDeleteSession }: HistoryProps) {
  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  // Group by month
  const grouped: Record<string, WorkoutSession[]> = {};
  sorted.forEach(s => {
    const key = new Date(s.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  return (
    <Layout title="History">
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base">No workouts logged yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([month, monthSessions]) => (
            <section key={month}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{month}</h2>
              <div className="flex flex-col gap-3">
                {monthSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onDelete={() => onDeleteSession(session.id)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Layout>
  );
}
