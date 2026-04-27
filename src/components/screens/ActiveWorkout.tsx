import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, SkipForward, Plus, Minus, ChevronDown, ChevronUp,
  Trophy, Clock, PlayCircle, BookOpen, Lightbulb, MapPin, ChevronRight,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useTimer } from '../../hooks/useTimer';
import { useStore } from '../../hooks/useStore';
import { WorkoutSession, SessionExercise, CompletedSet, NavState, MeasureType } from '../../types';
import { EXERCISE_VIDEOS } from '../../data/exerciseVideos';
import { EXERCISE_DESCRIPTIONS } from '../../data/exerciseDescriptions';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  showTutorials: boolean;
  onUpdateSession: (session: WorkoutSession) => void;
  onFinish: (session: WorkoutSession) => void;
  onNavigate: (nav: NavState) => void;
}

// ── Sound ──────────────────────────────────────────────────────────────────

function playRestEndSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ([[880, 0], [1100, 0.18], [1320, 0.36]] as [number, number][]).forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.15);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
  } catch (_) { /* audio not available */ }
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

function formatRestTime(secs: number): string {
  if (secs >= 60) return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return `${secs}s`;
}

// ── Inline rest timer ──────────────────────────────────────────────────────

interface RestInfo {
  remaining: number;
  progress: number;
  onSkip: () => void;
}

function InlineRestTimer({ restInfo }: { restInfo: RestInfo }) {
  return (
    <div className="flex items-center gap-3 mt-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
      <Clock size={14} className="text-orange-500 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-orange-700">Rest</span>
          <span className="text-sm font-bold text-orange-800 tabular-nums">
            {formatRestTime(restInfo.remaining)}
          </span>
        </div>
        <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all duration-1000"
            style={{ width: `${(1 - restInfo.progress) * 100}%` }}
          />
        </div>
      </div>
      <button
        onClick={restInfo.onSkip}
        className="flex items-center gap-1 text-xs text-orange-600 font-semibold px-2.5 py-1.5 bg-white border border-orange-200 rounded-lg hover:bg-orange-50 flex-shrink-0"
      >
        <SkipForward size={11} />
        Skip
      </button>
    </div>
  );
}

// ── Tutorial panel (collapsible, inside the exercise card) ─────────────────

function TutorialPanel({ exerciseId, exerciseName }: { exerciseId: string; exerciseName: string }) {
  const [open, setOpen] = useState(false);
  const hasVideo = !!EXERCISE_VIDEOS[exerciseId];
  const desc = EXERCISE_DESCRIPTIONS[exerciseId];

  if (!hasVideo && !desc) return null;

  return (
    <div className="border-t border-gray-100 mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <PlayCircle size={14} className="text-brand-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-brand-500 flex-1">
          {open ? 'Hide tutorial' : 'Show tutorial & how-to'}
        </span>
        {open
          ? <ChevronUp size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 bg-gray-50/60">
          {/* YouTube video */}
          {hasVideo && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <PlayCircle size={12} className="text-brand-500" />
                <span className="text-xs font-semibold text-gray-600">Demo Video</span>
              </div>
              <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${EXERCISE_VIDEOS[exerciseId]}?rel=0&modestbranding=1`}
                  title={`${exerciseName} demonstration`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* How-to steps */}
          {desc && (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={12} className="text-brand-500" />
                <span className="text-xs font-semibold text-gray-600">How to do it</span>
              </div>
              <ol className="flex flex-col gap-1.5 mb-3">
                {desc.how.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-brand-100 text-brand-600 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-700 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>

              {desc.tips && desc.tips.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb size={11} className="text-yellow-500" />
                    <span className="text-xs font-semibold text-yellow-700">Tips</span>
                  </div>
                  {desc.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-gray-600 leading-relaxed mb-1 pl-3">• {tip}</p>
                  ))}
                </div>
              )}

              {desc.footballContext && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MapPin size={11} className="text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Football context</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line pl-3">
                    {desc.footballContext}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Set row ────────────────────────────────────────────────────────────────

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
  const step = measureType === 'strength' ? 2.5 : measureType === 'distance' ? 0.1 : 1;

  const handleLog = () => {
    if (completed) return;
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
      <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">
        {setIndex + 1}
      </span>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
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

        {(measureType === 'time' || measureType === 'distance' || measureType === 'height' || measureType === 'score') && (
          <div className="flex items-center gap-1">
            <button onClick={() => setWeight(w => Math.max(0, parseFloat((w - step).toFixed(2))))}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
              <Minus size={12} />
            </button>
            <input type="number" value={weight} min="0" step={step}
              onChange={e => setWeight(parseFloat(e.target.value) || 0)}
              className="w-20 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={() => setWeight(w => parseFloat((w + step).toFixed(2)))}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200">
              <Plus size={12} />
            </button>
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        )}
      </div>

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

// ── Exercise section ───────────────────────────────────────────────────────

function ExerciseSection({
  sessionExercise,
  sessionId,
  showTutorials,
  restInfo,
  onCompleteSet,
}: {
  sessionExercise: SessionExercise;
  sessionId: string;
  showTutorials: boolean;
  restInfo?: RestInfo;
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

  const getSetDefaults = (i: number) => {
    if (i > 0 && sessionExercise.sets[i - 1]) {
      return { weight: sessionExercise.sets[i - 1].weight, reps: sessionExercise.sets[i - 1].reps };
    }
    if (lastSession?.sets[i]) return { weight: lastSession.sets[i].weight, reps: lastSession.sets[i].reps };
    if (lastSession?.sets[0]) return { weight: lastSession.sets[0].weight, reps: lastSession.sets[0].reps };
    return { weight: sessionExercise.targetWeight, reps: sessionExercise.targetReps };
  };

  const currentBest = sessionExercise.sets.reduce<{ weight: number; reps: number } | null>(
    (best, set) => (!best || set.weight > best.weight ? set : best), null,
  );
  const isNewPB = !!(currentBest && pb && currentBest.weight > pb.weight);
  const pbDisplay = pb ? formatSetDisplay({ ...pb, completedAt: 0 }, measureType, unit) : null;
  const lastBest = lastSession?.sets.length
    ? lastSession.sets.reduce((b, s) => s.weight > b.weight ? s : b)
    : null;
  const lastDisplay = lastBest ? formatSetDisplay({ ...lastBest, completedAt: 0 }, measureType, unit) : null;

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
        <>
          {/* Tutorial panel (when setting is on) */}
          {showTutorials && (
            <TutorialPanel exerciseId={exercise.id} exerciseName={exercise.name} />
          )}

          <div className="px-4 pb-4">
            {/* Last time & PB */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setShowAllLast(s => !s)} className="flex-1 bg-blue-50 rounded-xl px-3 py-2 text-left">
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

            {/* Inline rest timer */}
            {restInfo && <InlineRestTimer restInfo={restInfo} />}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function ActiveWorkout({ session, showTutorials, onUpdateSession, onFinish, onNavigate }: ActiveWorkoutProps) {
  const timer = useTimer();
  const [showFinish, setShowFinish] = useState(false);
  const [restingExerciseIdx, setRestingExerciseIdx] = useState<number | null>(null);

  const totalSets     = session.exercises.reduce((a, e) => a + e.targetSets, 0);
  const completedSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const progressPct   = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const elapsedMins   = Math.floor((Date.now() - session.startTime) / 60000);

  const handleSkipRest = useCallback(() => {
    timer.skip();
    setRestingExerciseIdx(null);
  }, [timer]);

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

    const ex = session.exercises[exerciseIdx];
    const isLastSet      = setIndex === ex.targetSets - 1;
    const isLastExercise = exerciseIdx === session.exercises.length - 1;
    if (!(isLastSet && isLastExercise) && ex.restSeconds > 0) {
      timer.start(ex.restSeconds);
      setRestingExerciseIdx(exerciseIdx);
    }
  }, [session, onUpdateSession, timer]);

  useEffect(() => {
    if (timer.finished) {
      playRestEndSound();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      timer.stop();
      setRestingExerciseIdx(null);
    }
  }, [timer.finished, timer]);

  const restInfo: RestInfo | undefined = (timer.running && restingExerciseIdx !== null)
    ? { remaining: timer.remaining, progress: timer.progress, onSkip: handleSkipRest }
    : undefined;

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
              showTutorials={showTutorials}
              restInfo={exerciseIdx === restingExerciseIdx ? restInfo : undefined}
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
