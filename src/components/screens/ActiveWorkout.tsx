import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, SkipForward, Plus, Minus, ChevronDown, ChevronUp, Trophy, Clock } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useTimer } from '../../hooks/useTimer';
import { useStore } from '../../hooks/useStore';
import { WorkoutSession, SessionExercise, CompletedSet, NavState, MeasureType } from '../../types';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  onUpdateSession: (session: WorkoutSession) => void;
  onFinish: (session: WorkoutSession) => void;
  onNavigate: (nav: NavState) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getMeasureLabel(type: MeasureType, unit?: string): string {
  if (unit) return unit;
  switch (type) {
    case 'time':     return 's';
    case 'distance': return 'm';
    case 'height':   return 'cm';
    case 'score':    return 'score';
    case 'reps':     return 'reps';
    default:         return 'kg';
  }
}

function formatSetDisplay(set: CompletedSet, type: MeasureType, unit?: string): string {
  const label = getMeasureLabel(type, unit);
  switch (type) {
    case 'strength': return `${set.weight}kg × ${set.reps}`;
    case 'reps':     return `${set.reps} reps`;
    case 'time':     return `${set.weight}${label}`;
    case 'distance': return `${set.weight}${label}`;
    case 'height':   return `${set.weight}${label}`;
    case 'score':    return `${set.weight} ${label}`;
    default:         return `${set.weight}kg × ${set.reps}`;
  }
}

// ── Rest timer overlay ─────────────────────────────────────────────────────

function RestTimer({ remaining, progress, onSkip }: {
  remaining: number;
  progress: number;
  onSkip: () => void;
}) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const circumference = 2 * Math.PI * 44;
  const dash = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 mx-4 w-full max-w-xs text-center shadow-2xl">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Rest</p>
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44"
              fill="none" stroke="#f97316" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dash}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-gray-900">
              {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}`}
            </span>
          </div>
        </div>
        <Button variant="ghost" onClick={onSkip} className="text-gray-500">
          <SkipForward size={16} /> Skip Rest
        </Button>
      </div>
    </div>
  );
}

// ── Set row — adapts to measureType ───────────────────────────────────────

function SetRow({
  setIndex,
  completed,
  defaultWeight,
  defaultReps,
  measureType = 'strength',
  unit,
  onComplete,
}: {
  setIndex: number;
  completed: CompletedSet | null;
  defaultWeight: number;
  defaultReps: number;
  measureType?: MeasureType;
  unit?: string;
  onComplete: (set: CompletedSet) => void;
}) {
  const [reps, setReps]     = useState(defaultReps);
  const [weight, setWeight] = useState(defaultWeight);

  const label = getMeasureLabel(measureType, unit);

  // Step size for the +/− buttons based on measure type
  const step = measureType === 'strength'  ? 2.5
             : measureType === 'time'      ? 1
             : measureType === 'height'    ? 1
             : measureType === 'distance'  ? 0.1
             : measureType === 'score'     ? 1
             : 1;

  const handleLog = () => {
    if (completed) return;
    // For reps-only, value goes into reps; for everything else, measured value goes into weight
    if (measureType === 'reps') {
      onComplete({ reps, weight: 0, completedAt: Date.now() });
    } else {
      onComplete({ reps: measureType === 'strength' ? reps : 1, weight, completedAt: Date.now() });
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
      completed ? 'bg-green-50 border border-green-100' : 'bg-gray-50'
    }`}>
      {/* Set / trial number */}
      <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">
        {setIndex + 1}
      </span>

      <div className="flex-1 flex items-center gap-2 flex-wrap">

        {/* STRENGTH: weight × reps */}
        {measureType === 'strength' && (
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => setWeight(w => Math.max(0, parseFloat((w - 2.5).toFixed(1))))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
                <Minus size={12} />
              </button>
              <input type="number" value={weight} min="0" step="0.5"
                onChange={e => setWeight(parseFloat(e.target.value) || 0)}
                className="w-16 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button onClick={() => setWeight(w => parseFloat((w + 2.5).toFixed(1)))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
                <Plus size={12} />
              </button>
              <span className="text-xs text-gray-400">kg</span>
            </div>
            <span className="text-gray-300">×</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setReps(r => Math.max(1, r - 1))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
                <Minus size={12} />
              </button>
              <input type="number" value={reps} min="1"
                onChange={e => setReps(parseInt(e.target.value) || 1)}
                className="w-12 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button onClick={() => setReps(r => r + 1)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
                <Plus size={12} />
              </button>
              <span className="text-xs text-gray-400">reps</span>
            </div>
          </>
        )}

        {/* REPS ONLY: no weight */}
        {measureType === 'reps' && (
          <div className="flex items-center gap-1">
            <button onClick={() => setReps(r => Math.max(1, r - 1))}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
              <Minus size={12} />
            </button>
            <input type="number" value={reps} min="1"
              onChange={e => setReps(parseInt(e.target.value) || 1)}
              className="w-14 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={() => setReps(r => r + 1)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
              <Plus size={12} />
            </button>
            <span className="text-xs text-gray-400">reps</span>
          </div>
        )}

        {/* SINGLE VALUE: time / distance / height / score */}
        {(measureType === 'time' || measureType === 'distance' || measureType === 'height' || measureType === 'score') && (
          <div className="flex items-center gap-1">
            <button onClick={() => setWeight(w => Math.max(0, parseFloat((w - step).toFixed(2))))}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
              <Minus size={12} />
            </button>
            <input
              type="number" value={weight} min="0" step={step}
              onChange={e => setWeight(parseFloat(e.target.value) || 0)}
              className="w-20 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={() => setWeight(w => parseFloat((w + step).toFixed(2)))}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
              <Plus size={12} />
            </button>
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        )}
      </div>

      {/* Log / tick button */}
      <button
        onClick={handleLog}
        className={`p-1 rounded-full transition-colors flex-shrink-0 ${
          completed ? 'text-green-500' : 'text-gray-300 hover:text-brand-500'
        }`}
      >
        <CheckCircle2 size={26} strokeWidth={completed ? 2.5 : 1.5} />
      </button>
    </div>
  );
}

// ── Exercise section with progression ─────────────────────────────────────

function ExerciseSection({
  sessionExercise,
  sessionId,
  onCompleteSet,
}: {
  sessionExercise: SessionExercise;
  sessionId: string;
  onCompleteSet: (setIndex: number, set: CompletedSet) => void;
}) {
  const { getExercise, getLastSession, getPB } = useStore();
  const exercise = getExercise(sessionExercise.exerciseId);
  const [collapsed, setCollapsed] = useState(false);
  const [showAllLast, setShowAllLast] = useState(false);

  const lastSession = getLastSession(sessionExercise.exerciseId, sessionId);
  const pb          = getPB(sessionExercise.exerciseId);

  if (!exercise) return null;

  const measureType: MeasureType = exercise.measureType ?? 'strength';
  const unit = exercise.unit;

  const completedCount = sessionExercise.sets.length;
  const totalSets      = sessionExercise.targetSets;
  const allDone        = completedCount >= totalSets;

  // Per-set defaults: use previous set in this session → last session → template target
  const getSetDefaults = (i: number) => {
    if (i > 0 && sessionExercise.sets[i - 1]) {
      return { weight: sessionExercise.sets[i - 1].weight, reps: sessionExercise.sets[i - 1].reps };
    }
    if (lastSession?.sets[i]) {
      return { weight: lastSession.sets[i].weight, reps: lastSession.sets[i].reps };
    }
    if (lastSession?.sets[0]) {
      return { weight: lastSession.sets[0].weight, reps: lastSession.sets[0].reps };
    }
    return { weight: sessionExercise.targetWeight, reps: sessionExercise.targetReps };
  };

  // Live new-PB check
  const currentBest = sessionExercise.sets.reduce<{ weight: number; reps: number } | null>(
    (best, set) => (!best || set.weight > best.weight ? set : best), null,
  );
  const isNewPB = !!(currentBest && pb && currentBest.weight > pb.weight);

  // PB display value depends on measure type
  const pbDisplay = pb
    ? formatSetDisplay({ ...pb, completedAt: 0 }, measureType, unit)
    : null;

  const lastBest = lastSession?.sets.length
    ? lastSession.sets.reduce((b, s) => s.weight > b.weight ? s : b)
    : null;

  const lastDisplay = lastBest
    ? formatSetDisplay({ ...lastBest, completedAt: 0 }, measureType, unit)
    : null;

  return (
    <Card className={`overflow-hidden ${allDone ? 'opacity-80' : ''}`}>
      {/* Header */}
      <button className="w-full flex items-center justify-between p-4" onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-3 min-w-0">
          {allDone  && <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />}
          {isNewPB  && <Trophy size={16} className="text-yellow-500 flex-shrink-0" />}
          <div className="min-w-0 text-left">
            <div className="font-semibold text-gray-900 text-sm">{exercise.name}</div>
            <div className="text-xs text-gray-400">
              {completedCount}/{totalSets} {exercise.category === 'Testing' ? 'trials' : 'sets'}
              {sessionExercise.restSeconds > 0 && ` · ${sessionExercise.restSeconds}s rest`}
            </div>
          </div>
        </div>
        {collapsed
          ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
          : <ChevronUp   size={16} className="text-gray-400 flex-shrink-0" />
        }
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Progression panels — last time & PB */}
          <div className="flex gap-2 mb-3">
            {/* Last time */}
            <button
              onClick={() => setShowAllLast(s => !s)}
              className="flex-1 bg-blue-50 rounded-xl px-3 py-2 text-left"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock size={11} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-600">Last Time</span>
              </div>
              {lastSession && lastSession.sets.length > 0 ? (
                <div className="text-xs text-blue-700 leading-relaxed">
                  {showAllLast
                    ? lastSession.sets.map((s, i) => (
                        <span key={i} className="mr-2 whitespace-nowrap">
                          {formatSetDisplay(s, measureType, unit)}
                        </span>
                      ))
                    : <span className="font-medium">{lastDisplay}</span>
                  }
                </div>
              ) : (
                <div className="text-xs text-blue-400 italic">No history yet</div>
              )}
            </button>

            {/* PB */}
            <div className="flex-1 bg-yellow-50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Trophy size={11} className="text-yellow-500" />
                <span className="text-xs font-semibold text-yellow-600">
                  {measureType === 'time' || measureType === 'score' ? 'Best' : 'PB'}
                </span>
              </div>
              {pbDisplay ? (
                <div className="text-xs text-yellow-700 font-medium">
                  {pbDisplay}
                  {isNewPB && <span className="ml-1 font-bold">New!</span>}
                </div>
              ) : (
                <div className="text-xs text-yellow-400 italic">Not set yet</div>
              )}
            </div>
          </div>

          {/* Set rows */}
          <div className="flex flex-col gap-2">
            {Array.from({ length: totalSets }).map((_, i) => {
              const defaults = getSetDefaults(i);
              return (
                <SetRow
                  key={i}
                  setIndex={i}
                  completed={sessionExercise.sets[i] ?? null}
                  defaultWeight={defaults.weight}
                  defaultReps={defaults.reps}
                  measureType={measureType}
                  unit={unit}
                  onComplete={set => onCompleteSet(i, set)}
                />
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function ActiveWorkout({ session, onUpdateSession, onFinish, onNavigate }: ActiveWorkoutProps) {
  const timer = useTimer();
  const [showFinish, setShowFinish] = useState(false);

  const totalSets     = session.exercises.reduce((a, e) => a + e.targetSets, 0);
  const completedSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const progressPct   = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const elapsedMins   = Math.floor((Date.now() - session.startTime) / 60000);

  const handleCompleteSet = useCallback((exerciseIdx: number, setIndex: number, set: CompletedSet) => {
    const updated: WorkoutSession = {
      ...session,
      exercises: session.exercises.map((ex, i) => {
        if (i !== exerciseIdx) return ex;
        const sets = [...ex.sets];
        sets[setIndex] = set;
        return { ...ex, sets };
      }),
    };
    onUpdateSession(updated);

    // Start rest timer unless last set of last exercise
    const ex = session.exercises[exerciseIdx];
    const isLastSet      = setIndex === ex.targetSets - 1;
    const isLastExercise = exerciseIdx === session.exercises.length - 1;
    if (!(isLastSet && isLastExercise) && ex.restSeconds > 0) {
      timer.start(ex.restSeconds);
    }
  }, [session, onUpdateSession, timer]);

  // Vibrate when rest ends
  useEffect(() => {
    if (timer.finished) {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      timer.stop();
    }
  }, [timer.finished, timer]);

  return (
    <>
      <Layout
        title={session.name}
        onBack={() => setShowFinish(true)}
        rightAction={<Button size="sm" onClick={() => setShowFinish(true)}>Finish</Button>}
      >
        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{completedSets}/{totalSets} sets · {progressPct}%</span>
            <span>{elapsedMins}m elapsed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {session.exercises.map((ex, exerciseIdx) => (
            <ExerciseSection
              key={ex.exerciseId}
              sessionExercise={ex}
              sessionId={session.id}
              onCompleteSet={(setIndex, set) => handleCompleteSet(exerciseIdx, setIndex, set)}
            />
          ))}
        </div>

        <div className="mt-6">
          <Button variant="danger" fullWidth onClick={() => setShowFinish(true)}>
            Finish Workout
          </Button>
        </div>
      </Layout>

      {timer.running && (
        <RestTimer remaining={timer.remaining} progress={timer.progress} onSkip={timer.skip} />
      )}

      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-2">Finish Workout?</h2>
            <p className="text-sm text-gray-500 mb-4">
              {completedSets < totalSets
                ? `You've completed ${completedSets} of ${totalSets} sets.`
                : 'Great work — all sets done!'}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setShowFinish(false)}>Continue</Button>
              <Button fullWidth onClick={() => onFinish({ ...session, endTime: Date.now() })}>Finish</Button>
            </div>
            <button
              onClick={() => onNavigate({ screen: 'dashboard' })}
              className="w-full mt-3 text-xs text-red-400 hover:text-red-500 text-center"
            >
              Discard workout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
