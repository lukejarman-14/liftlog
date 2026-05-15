import { TrendingUp, Dumbbell, BookOpen, Lightbulb, MapPin } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Exercise, WorkoutSession, NavState, MeasureType, CompletedSet } from '../../types';
import { EXERCISE_DESCRIPTIONS } from '../../data/exerciseDescriptions';
import { CATEGORY_COLORS } from '../../data/exercises';

function formatSetChip(set: CompletedSet, measureType: MeasureType, unit?: string): string {
  const lbl = unit ?? (measureType === 'time' ? 's' : measureType === 'distance' ? 'm' : measureType === 'height' ? 'cm' : '');
  switch (measureType) {
    case 'reps':     return `${set.reps} reps`;
    case 'strength': return `${set.weight}kg × ${set.reps}`;
    default:         return `${set.weight}${lbl ? ' ' + lbl : ''}`;
  }
}

interface ExerciseDetailProps {
  exercise: Exercise;
  sessions: WorkoutSession[];
  onNavigate: (nav: NavState) => void;
  onBack: () => void;
}

interface ChartPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
  sets: number;
}

export function ExerciseDetail({ exercise, sessions, onNavigate, onBack }: ExerciseDetailProps) {
  const exerciseSessions = sessions
    .filter(s => s.exercises.some(e => e.exerciseId === exercise.id))
    .sort((a, b) => a.startTime - b.startTime);

  const chartData: ChartPoint[] = exerciseSessions.map(session => {
    const ex = session.exercises.find(e => e.exerciseId === exercise.id)!;
    const maxWeight = Math.max(...ex.sets.map(s => s.weight), 0);
    const totalVolume = ex.sets.reduce((acc, s) => acc + s.reps * s.weight, 0);
    const date = new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { date, maxWeight, totalVolume, sets: ex.sets.length };
  });

  const allSets = exerciseSessions.flatMap(s =>
    s.exercises.find(e => e.exerciseId === exercise.id)?.sets ?? []
  );
  const bestSet = allSets.reduce<{ weight: number; reps: number } | null>(
    (best, set) => (!best || set.weight > best.weight ? set : best),
    null
  );
  const totalSets = allSets.length;
  const totalVolume = allSets.reduce((acc, s) => acc + s.reps * s.weight, 0);

  const desc = EXERCISE_DESCRIPTIONS[exercise.id];

  return (
    <Layout title={exercise.name} onBack={onBack}>
      {/* Meta tags */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[exercise.category]}`}>
          {exercise.category}
        </span>
        {exercise.secondaryCategory && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[exercise.secondaryCategory]}`}>
            {exercise.secondaryCategory}
          </span>
        )}
        {exercise.muscleGroups.map(m => (
          <span key={m} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{m}</span>
        ))}
        {exercise.suggestedRir !== undefined && (
          <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-2 py-1 rounded-full">
            {exercise.suggestedRir} RIR suggested
          </span>
        )}
        <span className="text-xs text-gray-400 ml-auto">Rest: {exercise.defaultRestSeconds}s</span>
      </div>

      {/* How to do it */}
      {desc && (
        <Card className="mb-5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={15} className="text-brand-500" />
            <span className="text-sm font-semibold text-gray-700">How to do it</span>
          </div>
          <ol className="flex flex-col gap-2">
            {desc.how.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          {desc.tips && desc.tips.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={13} className="text-yellow-500" />
                <span className="text-xs font-semibold text-yellow-700">Coaching Tips</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {desc.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-relaxed flex gap-2">
                    <span className="text-yellow-400 flex-shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {desc.footballContext && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={13} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">Football Context</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                {desc.footballContext}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Personal records */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <div className="text-xl font-bold text-brand-500">{bestSet ? `${bestSet.weight}kg` : '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Best Weight</div>
          {bestSet && <div className="text-xs text-gray-400">× {bestSet.reps} reps</div>}
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl font-bold text-brand-500">{totalSets}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Sets</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl font-bold text-brand-500">
            {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Vol (kg)</div>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length >= 2 ? (
        <Card className="p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-brand-500" /> Progress
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string) => [
                  `${value} kg`,
                  name === 'maxWeight' ? 'Max Weight' : 'Volume',
                ]}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="maxWeight"
                name="Max Weight"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : chartData.length === 1 ? (
        <Card className="p-4 mb-6 text-center text-sm text-gray-400">
          Log this exercise again to see your progress chart.
        </Card>
      ) : null}

      {/* Session history */}
      {exerciseSessions.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">History</h3>
          <div className="flex flex-col gap-2">
            {[...exerciseSessions].reverse().map(session => {
              const ex = session.exercises.find(e => e.exerciseId === exercise.id)!;
              return (
                <Card key={session.id} className="p-3">
                  <div className="text-xs text-gray-400 mb-1.5">
                    {new Date(session.date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.sets.map((set, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                        {formatSetChip(set, exercise.measureType ?? 'strength', exercise.unit)}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        <Card className="p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No history for this exercise yet.</p>
          <Button className="mt-4" onClick={() => onNavigate({ screen: 'workout-builder' })}>
            Start a Workout
          </Button>
        </Card>
      )}
    </Layout>
  );
}
