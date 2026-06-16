import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { getAudioContext, makeSineBuffer, playAudioBuffer } from '../../lib/audio';
import {
  CheckCircle2, SkipForward, Plus, Minus, ChevronDown, ChevronUp,
  Trophy, Clock, BookOpen, Lightbulb, MapPin, ChevronRight,
  TrendingUp, TrendingDown, Pencil, Save, AlertTriangle, FileText, Dumbbell,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { RpeSelector } from '../ui/RpeSelector';
import { useTimer } from '../../hooks/useTimer';
import { useStore } from '../../hooks/useStore';
import { WorkoutSession, SessionExercise, CompletedSet, MeasureType, StrengthSetup, LiftBaseline } from '../../types';
import { EXERCISE_DESCRIPTIONS } from '../../data/exerciseDescriptions';
import { intraSessionSuggestion, interSessionBaseline, weeklyProgressionSuggestion } from '../../lib/rpeProgression';
import { calcPrimingWeights } from '../../lib/sessionUtils';
import { getLiftKey, LIFT_META, epley1RM } from '../../lib/progressiveOverload';
import { scheduleRestEndNotification, cancelRestNotification } from '../../lib/notifications';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  showTutorials: boolean;
  onUpdateSession: (session: WorkoutSession) => void;
  onFinish: (session: WorkoutSession) => void;
  onConditioningFeedback?: (updates: Record<string, number>) => void;
  conditioningStagnation?: Record<string, number>;
  onDiscard: () => void;
  strengthSetup?: StrengthSetup | null;
  onUpdateStrengthSetup?: (setup: StrengthSetup) => void;
}

function blurActiveFormControl() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

// Persistent AudioContext ref — reused across all sound calls to avoid iOS 6-context limit.
const _audioCtxRef = { current: null as AudioContext | null };

function playRestEndSound() {
  try {
    const ctx = getAudioContext(_audioCtxRef);
    if (!ctx) return;
    for (const [freq, offset] of [[880, 0], [1100, 0.18], [1320, 0.36]] as [number, number][]) {
      playAudioBuffer(ctx, makeSineBuffer(ctx, freq, 0.15, 0.4), ctx.currentTime + offset);
    }
  } catch { /* audio not available */ }
}

function playTimerDoneSound() {
  try {
    const ctx = getAudioContext(_audioCtxRef);
    if (!ctx) return;
    const bufLen = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 350;
    const gain = ctx.createGain();
    gain.gain.value = 1.2;
    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + 0.35);
  } catch { /* audio not available */ }
}


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


// Categories where RIR (reps in reserve) feedback applies
const RIR_CATEGORIES = new Set(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body']);

// Categories where Last Time & PB are not meaningful (explosive/reactive work — load is bodyweight, reps vary by intent)
const HIDE_HISTORY_CATEGORIES = new Set(['Plyometrics', 'Speed']);

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


function RpeSuggestionBanner({
  action, message,
}: {
  action: 'increase' | 'maintain' | 'decrease';
  message: string;
}) {
  const styles = {
    increase: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: <TrendingUp size={13} className="text-green-600 flex-shrink-0" /> },
    maintain: { bg: 'bg-blue-50 border-blue-200',  text: 'text-blue-700',  icon: <span className="text-blue-500 text-xs font-bold flex-shrink-0">→</span> },
    decrease: { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   icon: <TrendingDown size={13} className="text-red-600 flex-shrink-0" /> },
  }[action];

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mt-1 mb-1 ${styles.bg}`}>
      {styles.icon}
      <span className={`text-xs font-medium ${styles.text}`}>{message}</span>
    </div>
  );
}


function WeeklyGoalCard({
  suggestedWeight,
  goalReps,
  targetSets,
  action,
  reason,
}: {
  suggestedWeight: number;
  goalReps: number;
  targetSets: number;
  action: 'increase' | 'maintain' | 'decrease';
  reason: string;
}) {
  const colours = {
    increase: {
      bg:     'bg-green-50 border-green-200',
      label:  'text-green-600',
      value:  'text-green-800',
      icon:   <TrendingUp size={14} className="text-green-600 flex-shrink-0" />,
      badge:  'bg-green-100 text-green-700',
    },
    maintain: {
      bg:     'bg-blue-50 border-blue-200',
      label:  'text-blue-500',
      value:  'text-blue-800',
      icon:   <span className="text-blue-500 text-sm font-bold flex-shrink-0">→</span>,
      badge:  'bg-blue-100 text-blue-700',
    },
    decrease: {
      bg:     'bg-amber-50 border-amber-200',
      label:  'text-amber-500',
      value:  'text-amber-800',
      icon:   <TrendingDown size={14} className="text-amber-600 flex-shrink-0" />,
      badge:  'bg-amber-100 text-amber-700',
    },
  }[action];

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border mx-4 mb-3 ${colours.bg}`}>
      {colours.icon}
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold ${colours.label} mb-0.5`}>This week's goal</div>
        <div className={`text-sm font-bold ${colours.value}`}>
          {targetSets} × {goalReps} reps @ {suggestedWeight} kg
        </div>
        <div className={`text-xs mt-0.5 ${colours.label}`}>{reason}</div>
      </div>
    </div>
  );
}


function TutorialPanel({ exerciseId, coachingCue, isPerSide }: { exerciseId: string; coachingCue?: string; isPerSide?: boolean }) {
  const [open, setOpen] = useState(false);
  const desc = EXERCISE_DESCRIPTIONS[exerciseId];

  if (!desc && !coachingCue && !isPerSide) return null;

  return (
    <div className="border-t border-gray-100 dark:border-zinc-800 mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <BookOpen size={14} className="text-brand-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-brand-500 flex-1">
          {open ? 'Hide coaching notes' : 'Show coaching notes'}
        </span>
        {open
          ? <ChevronUp size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-gray-50/60 dark:bg-zinc-800/40">
          {/* Per-side order tip */}
          {isPerSide && (
            <div className="mb-3 flex items-start gap-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg px-3 py-2">
              <span className="text-orange-500 text-sm flex-shrink-0">💪</span>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 leading-relaxed">
                Always start with your <strong>weaker leg first</strong> — it gets the most quality reps when you're freshest.
              </p>
            </div>
          )}
          {/* Programme-specific coaching cue takes priority */}
          {coachingCue && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={12} className="text-brand-500" />
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-300">Coaching cue</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed">{coachingCue}</p>
            </div>
          )}
          {desc && (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={12} className="text-brand-500" />
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400">How to do it</span>
              </div>
              <ol className="flex flex-col gap-1.5 mb-3">
                {desc.how.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              {desc.tips?.length && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb size={11} className="text-yellow-500" />
                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Tips</span>
                  </div>
                  {desc.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed mb-1 pl-3">• {tip}</p>
                  ))}
                </div>
              )}
              {desc.footballContext && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MapPin size={11} className="text-green-600" />
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">Football context</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line pl-3">
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

interface SetRowProps {
  setIndex: number;
  completed: CompletedSet | null;
  defaultWeight: number;
  defaultReps: number;
  measureType?: MeasureType;
  unit?: string;
  targetRir?: number;
  /** When false, the RIR prompt is suppressed entirely (plyometrics, speed, etc.) */
  showRir?: boolean;
  isWarmup?: boolean;
  isPerSide?: boolean;
  /** 'L' or 'R' — shown instead of the set number for per-side strength exercises */
  sideLabel?: 'L' | 'R';
  onComplete: (set: CompletedSet) => void;
  onEdit?: (set: CompletedSet) => void;
  onUncomplete?: () => void;
}

function SetRow({
  setIndex, completed, defaultWeight, defaultReps,
  measureType = 'strength', unit, targetRir, showRir = true, isWarmup, isPerSide, sideLabel, onComplete, onEdit, onUncomplete,
}: SetRowProps) {
  // Use string state so we can show blank instead of "0"
  const [repsStr, setRepsStr]     = useState(defaultReps  > 0 ? String(defaultReps)  : '');
  const [weightStr, setWeightStr] = useState(defaultWeight > 0 ? String(defaultWeight) : '');
  const reps   = parseInt(repsStr)   || 0;
  const weight = parseFloat(weightStr) || 0;

  // Extra load for weighted isometrics (e.g. plate on Copenhagen Plank). Stored separately
  // from the timer's weight field (which holds duration in seconds for time-based sets).
  const [addedWeightStr, setAddedWeightStr] = useState(
    completed?.addedWeightKg ? String(completed.addedWeightKg) : '0',
  );
  const addedWeightKg = parseFloat(addedWeightStr) || 0;

  const [pendingSet, setPendingSet] = useState<Omit<CompletedSet, 'rir'> | null>(null);

  // Timer state for time-based exercises (background-safe: uses absolute endTime)
  const [timerSecs, setTimerSecs] = useState(defaultReps);
  const [timerRunning, setTimerRunning] = useState(false);
  // For per-side exercises: track which leg/side is currently active
  const [timerSide, setTimerSide] = useState<'left' | 'right'>('left');
  const timerEndRef = useRef<number | null>(null);
  const sideTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerSecsRef = useRef(timerSecs);
  timerSecsRef.current = timerSecs;
  const timerSideRef = useRef<'left' | 'right'>('left');
  timerSideRef.current = timerSide;
  const defaultRepsRef = useRef(defaultReps);
  defaultRepsRef.current = defaultReps;
  const isPerSideRef = useRef(isPerSide ?? false);
  isPerSideRef.current = isPerSide ?? false;
  const addedWeightKgRef = useRef(addedWeightKg);
  addedWeightKgRef.current = addedWeightKg;
  // Keep a ref to onComplete so the interval closure always calls the latest version
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  // Guard async side-effects (side-transition timeout) after unmount
  const rowMountedRef = useRef(true);
  useEffect(() => () => { rowMountedRef.current = false; }, []);

  useEffect(() => {
    if (!timerRunning) return;
    // Snapshot current remaining secs (supports both Start and Resume)
    timerEndRef.current = Date.now() + timerSecsRef.current * 1000;

    const tick = () => {
      if (!timerEndRef.current) return;
      const rem = Math.max(0, Math.ceil((timerEndRef.current - Date.now()) / 1000));
      setTimerSecs(rem);
      if (rem <= 0) {
        timerEndRef.current = null;
        playTimerDoneSound();
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);

        if (isPerSideRef.current && timerSideRef.current === 'left') {
          // Left side done — pause briefly then auto-start right side
          setTimerRunning(false);
          setTimerSide('right');
          setTimerSecs(defaultRepsRef.current);
          sideTransitionRef.current = setTimeout(() => {
            if (rowMountedRef.current) setTimerRunning(true);
          }, 700);
        } else {
          // Single-side or right side done — complete the set
          setTimerRunning(false);
          const awk = addedWeightKgRef.current;
          onCompleteRef.current({
            reps: 1,
            weight: defaultRepsRef.current,
            completedAt: Date.now(),
            ...(awk > 0 ? { addedWeightKg: awk } : {}),
          });
        }
      }
    };

    const id = setInterval(tick, 250);
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      if (sideTransitionRef.current !== null) {
        clearTimeout(sideTransitionRef.current);
        sideTransitionRef.current = null;
      }
    };
  }, [timerRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingRir, setIsEditingRir] = useState(false);
  const [editRepsStr, setEditRepsStr]     = useState('');
  const [editWeightStr, setEditWeightStr] = useState('');

  const handleStartEdit = () => {
    if (!completed) return;
    setEditRepsStr(String(completed.reps));
    setEditWeightStr(String(completed.weight));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!completed || !onEdit) return;
    const parsedReps   = parseInt(editRepsStr);
    const parsedWeight = parseFloat(editWeightStr);
    const newReps   = Number.isFinite(parsedReps)   ? parsedReps   : completed.reps;
    const newWeight = Number.isFinite(parsedWeight) ? parsedWeight : completed.weight;
    onEdit({ ...completed, reps: newReps, weight: newWeight });
    setIsEditing(false);
  };

  const label = getMeasureLabel(measureType, unit);
  const step  = measureType === 'strength' ? 2.5 : measureType === 'distance' ? 0.1 : 1;

  const handleInitialLog = () => {
    if (completed || pendingSet) return;
    if (isWarmup || sideLabel === 'L') {
      // Warmup or Left-side of a per-side pair: skip RIR — Right side captures it for the pair
      if (measureType === 'reps') {
        onComplete({ reps, weight: 0, completedAt: Date.now() });
      } else if (measureType === 'strength') {
        onComplete({ reps, weight, completedAt: Date.now() });
      } else {
        onComplete({ reps: 1, weight, completedAt: Date.now() });
      }
      return;
    }
    if (measureType === 'reps') {
      // RIR doesn't apply to plyometrics, speed, or other reps-only exercises — complete directly.
      // Only gate through pendingSet (and show the RpeSelector) when showRir is explicitly true.
      if (showRir) {
        setPendingSet({ reps, weight: 0, completedAt: Date.now() });
      } else {
        onComplete({ reps, weight: 0, completedAt: Date.now() });
      }
    } else if (measureType === 'strength') {
      setPendingSet({ reps, weight, completedAt: Date.now() });
    } else {
      // For non-strength exercises, still capture then await RPE
      setPendingSet({ reps: 1, weight, completedAt: Date.now() });
    }
  };

  const handleRir = (rir: number) => {
    if (!pendingSet) return;
    onComplete({ ...pendingSet, rir });
    setPendingSet(null);
  };

  const handleSkipRpe = () => {
    if (!pendingSet) return;
    onComplete(pendingSet);
    setPendingSet(null);
  };

  const isAwaitingRpe = pendingSet !== null && !completed;
  const isInteractive = !completed && !isAwaitingRpe;

  if (isEditing && completed) {
    const editStep = measureType === 'strength' ? 2.5 : measureType === 'distance' ? 0.1 : 1;
    return (
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            {(measureType === 'strength') && (
              <>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditWeightStr(w => String(Math.max(0, parseFloat((parseFloat(w || '0') - 2.5).toFixed(1)))))}
                    className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200">
                    <Minus size={12} />
                  </button>
                  <input type="number" value={editWeightStr} min="0" step="0.5"
                    onChange={e => setEditWeightStr(e.target.value)}
                    onFocus={e => e.target.select()}
                    style={{ fontSize: '16px' }}
                    className="w-16 text-center text-sm font-semibold border border-blue-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => setEditWeightStr(w => String(parseFloat((parseFloat(w || '0') + 2.5).toFixed(1))))}
                    className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200">
                    <Plus size={12} />
                  </button>
                  <span className="text-xs text-blue-400">kg</span>
                </div>
                <span className="text-blue-300">×</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditRepsStr(r => String(Math.max(1, parseInt(r || '0') - 1)))}
                    className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200">
                    <Minus size={12} />
                  </button>
                  <input type="number" value={editRepsStr} min="1"
                    onChange={e => setEditRepsStr(e.target.value)}
                    onFocus={e => e.target.select()}
                    style={{ fontSize: '16px' }}
                    className="w-12 text-center text-sm font-semibold border border-blue-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => setEditRepsStr(r => String(parseInt(r || '0') + 1))}
                    className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200">
                    <Plus size={12} />
                  </button>
                  <span className="text-xs text-blue-400">reps</span>
                </div>
              </>
            )}
            {(measureType === 'reps') && (
              <div className="flex items-center gap-1">
                <button onClick={() => setEditRepsStr(r => String(Math.max(1, parseInt(r || '0') - 1)))}
                  className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200"><Minus size={12} /></button>
                <input type="number" value={editRepsStr} min="1"
                  onChange={e => setEditRepsStr(e.target.value)} onFocus={e => e.target.select()}
                  style={{ fontSize: '16px' }}
                  className="w-14 text-center text-sm font-semibold border border-blue-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button onClick={() => setEditRepsStr(r => String(parseInt(r || '0') + 1))}
                  className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200"><Plus size={12} /></button>
                <span className="text-xs text-blue-400">reps</span>
              </div>
            )}
            {(measureType === 'time' || measureType === 'distance' || measureType === 'height' || measureType === 'score') && (
              <div className="flex items-center gap-1">
                <button onClick={() => setEditWeightStr(w => String(Math.max(0, parseFloat((parseFloat(w || '0') - editStep).toFixed(2)))))}
                  className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200"><Minus size={12} /></button>
                <input type="number" value={editWeightStr} min="0" step={editStep}
                  onChange={e => setEditWeightStr(e.target.value)} onFocus={e => e.target.select()}
                  style={{ fontSize: '16px' }}
                  className="w-20 text-center text-sm font-semibold border border-blue-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button onClick={() => setEditWeightStr(w => String(parseFloat((parseFloat(w || '0') + editStep).toFixed(2))))}
                  className="w-6 h-6 flex items-center justify-center text-blue-400 hover:text-blue-600 bg-white rounded-lg border border-blue-200"><Plus size={12} /></button>
                <span className="text-xs text-blue-400">{getMeasureLabel(measureType, unit)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleSaveEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors">
              <Save size={12} /> Save
            </button>
            <button onClick={() => setIsEditing(false)}
              className="px-2 py-1.5 text-xs text-blue-400 hover:text-blue-600 rounded-lg">
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (completed && measureType === 'time') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
        <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
        <span className="flex-1 text-sm font-semibold text-green-600">
          ✓ {defaultReps}s{isPerSide ? ' each side' : ''}
          {completed.addedWeightKg ? ` + ${completed.addedWeightKg}kg` : ''}
        </span>
        {completed && onEdit && (
          <button
            onClick={handleStartEdit}
            className="p-1 rounded-lg text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
            title="Edit this set"
          >
            <Pencil size={14} />
          </button>
        )}
        {onUncomplete && (
          <button
            onClick={onUncomplete}
            className="p-1 rounded-full text-green-500 hover:text-red-400 transition-colors flex-shrink-0"
            title="Tap to undo this set"
          >
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {measureType === 'time' && !completed && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
          <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
          <div className="flex flex-col items-center gap-2 py-2 w-full">
            {/* Added weight input for loaded isometrics (e.g. Copenhagen Plank with plate) */}
            {defaultWeight > 0 && (
              <div className="flex items-center gap-2 self-start">
                <span className="text-xs text-gray-500 font-medium">Added weight</span>
                <button
                  onClick={() => setAddedWeightStr(w => String(Math.max(0, parseFloat(w || '0') - 2.5)))}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200"
                ><Minus size={12} /></button>
                <input
                  type="number" value={addedWeightStr} min="0" step="2.5" placeholder="0"
                  onChange={e => setAddedWeightStr(e.target.value)}
                  onFocus={e => e.target.select()}
                  style={{ fontSize: '16px' }}
                  className="w-14 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={() => setAddedWeightStr(w => String(parseFloat(w || '0') + 2.5))}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200"
                ><Plus size={12} /></button>
                <span className="text-xs text-gray-400">kg</span>
              </div>
            )}

            {/* Per-side: show LEFT + RIGHT panels */}
            {isPerSide ? (
              <>
                <div className="flex gap-2 w-full">
                  {/* Left side */}
                  <div className={`flex-1 flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${
                    timerSide === 'left'
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-green-300 bg-green-50'
                  }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                      timerSide === 'left' ? 'text-brand-500' : 'text-green-600'
                    }`}>Left</span>
                    {timerSide === 'left' ? (
                      <span className="text-2xl font-black tabular-nums text-brand-600">{formatRestTime(timerSecs)}</span>
                    ) : (
                      <span className="text-2xl font-black text-green-500">✓</span>
                    )}
                  </div>
                  {/* Right side */}
                  <div className={`flex-1 flex flex-col items-center p-2.5 rounded-xl border-2 transition-all ${
                    timerSide === 'right'
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 bg-white opacity-60'
                  }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                      timerSide === 'right' ? 'text-orange-500' : 'text-gray-400'
                    }`}>Right</span>
                    {timerSide === 'right' ? (
                      <span className="text-2xl font-black tabular-nums text-orange-500">{formatRestTime(timerSecs)}</span>
                    ) : (
                      <span className="text-2xl font-black text-gray-300">{formatRestTime(defaultReps)}</span>
                    )}
                  </div>
                </div>
                {/* Progress bar for active side */}
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-1000 ${timerSide === 'left' ? 'bg-brand-500' : 'bg-orange-400'}`}
                    style={{ width: `${((defaultReps - timerSecs) / defaultReps) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-black tabular-nums text-brand-600">
                  {formatRestTime(timerSecs)}
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 bg-brand-500 rounded-full transition-all duration-1000"
                    style={{ width: `${((defaultReps - timerSecs) / defaultReps) * 100}%` }}
                  />
                </div>
              </>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {!timerRunning && timerSecs === defaultReps && (
                <button
                  onClick={() => setTimerRunning(true)}
                  className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600"
                >
                  {isPerSide
                    ? `Start ${timerSide === 'right' ? 'Right' : 'Left'} ${formatRestTime(defaultReps)}`
                    : `Start ${formatRestTime(defaultReps)}`}
                </button>
              )}
              {timerRunning && (
                <button
                  onClick={() => setTimerRunning(false)}
                  className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold"
                >
                  Pause
                </button>
              )}
              {!timerRunning && timerSecs < defaultReps && timerSecs > 0 && (
                <>
                  <button
                    onClick={() => setTimerRunning(true)}
                    className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => { setTimerSecs(defaultReps); setTimerSide('left'); }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold"
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {measureType !== 'time' && (<div className={`flex items-center flex-wrap gap-3 p-3 rounded-xl transition-colors ${
        completed       ? 'bg-green-50 border border-green-100' :
        isAwaitingRpe   ? 'bg-brand-50 border border-brand-200' :
                          'bg-gray-50'
      }`}>
        {sideLabel ? (
          <span className={`text-xs font-black w-6 text-center flex-shrink-0 rounded-md px-0.5 py-0.5 ${
            sideLabel === 'L' ? 'bg-brand-100 text-brand-700' : 'bg-orange-100 text-orange-700'
          }`}>{sideLabel}</span>
        ) : (
          <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">
            {setIndex + 1}
          </span>
        )}

        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {measureType === 'strength' && (
            <>
              <div className="flex items-center gap-1">
                <button
                  disabled={!isInteractive}
                  onClick={() => setWeightStr(w => String(Math.max(0, parseFloat((parseFloat(w || '0') - 2.5).toFixed(1)))))}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number" value={completed ? String(completed.weight) : weightStr} min="0" step="0.5"
                  placeholder="0"
                  disabled={!isInteractive}
                  onChange={e => setWeightStr(e.target.value)}
                  onFocus={e => e.target.select()}
                  style={{ fontSize: '16px' }}
                  className="w-16 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
                />
                <button
                  disabled={!isInteractive}
                  onClick={() => setWeightStr(w => String(parseFloat((parseFloat(w || '0') + 2.5).toFixed(1))))}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40"
                >
                  <Plus size={12} />
                </button>
                <span className="text-xs text-gray-400">kg</span>
              </div>
              <span className="text-gray-300">×</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={!isInteractive}
                  onClick={() => setRepsStr(r => String(Math.max(1, (parseInt(r || '0') - 1))))}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number" value={completed ? String(completed.reps) : repsStr} min="1"
                  placeholder="0"
                  disabled={!isInteractive}
                  onChange={e => setRepsStr(e.target.value)}
                  onFocus={e => e.target.select()}
                  style={{ fontSize: '16px' }}
                  className="w-12 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
                />
                <button
                  disabled={!isInteractive}
                  onClick={() => setRepsStr(r => String((parseInt(r || '0') + 1)))}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40"
                >
                  <Plus size={12} />
                </button>
                <span className="text-xs text-gray-400">reps</span>
              </div>
            </>
          )}

          {measureType === 'reps' && (
            <div className="flex items-center gap-1">
              <button disabled={!isInteractive} onClick={() => setRepsStr(r => String(Math.max(1, (parseInt(r || '0') - 1))))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40">
                <Minus size={12} />
              </button>
              <input type="number" value={completed ? String(completed.reps) : repsStr} min="1" placeholder="0" disabled={!isInteractive}
                onChange={e => setRepsStr(e.target.value)}
                onFocus={e => e.target.select()}
                style={{ fontSize: '16px' }}
                className="w-14 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50" />
              <button disabled={!isInteractive} onClick={() => setRepsStr(r => String((parseInt(r || '0') + 1)))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40">
                <Plus size={12} />
              </button>
              <span className="text-xs text-gray-400">reps</span>
            </div>
          )}

          {(measureType === 'distance' || measureType === 'height' || measureType === 'score') && (
            <div className="flex items-center gap-1">
              <button disabled={!isInteractive} onClick={() => setWeightStr(w => String(Math.max(0, parseFloat((parseFloat(w || '0') - step).toFixed(2)))))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40">
                <Minus size={12} />
              </button>
              <input type="number" value={completed ? String(completed.weight) : weightStr} min="0" step={step} placeholder="0" disabled={!isInteractive}
                onChange={e => setWeightStr(e.target.value)}
                onFocus={e => e.target.select()}
                style={{ fontSize: '16px' }}
                className="w-16 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50" />
              <button disabled={!isInteractive} onClick={() => setWeightStr(w => String(parseFloat((parseFloat(w || '0') + step).toFixed(2))))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-lg border border-gray-200 disabled:opacity-40">
                <Plus size={12} />
              </button>
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          )}
        </div>

        {/* Completed: show RIR badge (clickable to re-edit) */}
        {completed?.rir !== undefined && (
          <button
            onClick={() => setIsEditingRir(v => !v)}
            className={`text-xs font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0 border transition-colors ${
              isEditingRir
                ? 'bg-brand-100 border-brand-400 text-brand-700'
                : 'bg-white border-gray-200 text-gray-500 hover:border-brand-400 hover:text-brand-600'
            }`}
            title="Tap to edit RIR"
          >
            {completed.rir} RIR
          </button>
        )}

        {/* Edit button for completed sets */}
        {completed && onEdit && (
          <button
            onClick={handleStartEdit}
            className="p-1 rounded-lg text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
            title="Edit this set"
          >
            <Pencil size={14} />
          </button>
        )}

        <button
          onClick={completed ? onUncomplete : handleInitialLog}
          disabled={isAwaitingRpe}
          className={`p-1 rounded-full transition-colors flex-shrink-0 ${
            completed ? 'text-green-500 hover:text-red-400' :
            isAwaitingRpe ? 'text-brand-400' :
            'text-gray-300 hover:text-brand-500'
          }`}
          title={completed ? 'Tap to undo this set' : undefined}
        >
          <CheckCircle2 size={26} strokeWidth={completed ? 2.5 : 1.5} />
        </button>
      </div>)}

      {isAwaitingRpe && (
        <RpeSelector
          value={null}
          onChange={handleRir}
          onSkip={handleSkipRpe}
          targetRir={targetRir}
        />
      )}

      {isEditingRir && completed && onEdit && (
        <RpeSelector
          value={completed.rir ?? null}
          onChange={rir => {
            onEdit({ ...completed, rir });
            setIsEditingRir(false);
          }}
          onSkip={() => setIsEditingRir(false)}
          targetRir={targetRir}
        />
      )}
    </div>
  );
}

function CondSprintRow({
  setIndex, totalSets, completed, isActive, onComplete,
}: {
  setIndex: number;
  totalSets: number;
  completed: CompletedSet | null;
  isActive: boolean;
  onComplete: (set: CompletedSet) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  // Store exact elapsed milliseconds on pause so resume doesn't lose up to 999ms
  const elapsedMsRef = useRef(0);

  useEffect(() => {
    if (!running) {
      // Capture exact ms when pausing so the next resume anchors precisely
      if (startRef.current !== null) elapsedMsRef.current = Date.now() - startRef.current;
      return;
    }
    startRef.current = Date.now() - elapsedMsRef.current;
    const tick = () => {
      if (startRef.current !== null) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    };
    const id = setInterval(tick, 250);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtEl = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (completed) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
        <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
        <span className="flex-1 text-sm font-semibold text-green-600">✓ Sprint {setIndex + 1} complete</span>
      </div>
    );
  }

  if (running) {
    return (
      <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-emerald-700 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
          <div className="flex-1 flex flex-col items-center gap-0.5">
            <div className="text-3xl font-black tabular-nums text-emerald-600">{fmtEl(elapsed)}</div>
            <div className="text-xs text-emerald-500 font-semibold uppercase tracking-wide">
              Sprint {setIndex + 1} of {totalSets} · running
            </div>
          </div>
          <button
            onClick={() => {
              setRunning(false);
              onComplete({ reps: 1, weight: elapsed, completedAt: Date.now() });
              playTimerDoneSound();
              if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
            }}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all"
          >
            Done ✓
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-gray-50' : 'bg-gray-50 opacity-40'}`}>
      <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
      <span className="flex-1 text-sm text-gray-500">Sprint {setIndex + 1} of {totalSets}</span>
      {isActive && (
        <button
          onClick={() => { setElapsed(0); setRunning(true); }}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 active:scale-95 transition-all"
        >
          Start Sprint
        </button>
      )}
    </div>
  );
}


function ExerciseSection({
  sessionExercise,
  sessionId,
  showTutorials,
  globalShowRir,
  restInfo,
  isFlagged,
  onCompleteSet,
  onEditSet,
  onUncompleteSet,
  onFlagExercise,
}: {
  sessionExercise: SessionExercise;
  sessionId: string;
  showTutorials: boolean;
  globalShowRir: boolean;
  restInfo?: RestInfo;
  isFlagged?: boolean;
  onCompleteSet: (setIndex: number, set: CompletedSet) => void;
  onEditSet: (setIndex: number, set: CompletedSet) => void;
  onUncompleteSet: (setIndex: number) => void;
  onFlagExercise: () => void;
}) {
  const { getExercise, getLastSession, getPB } = useStore();
  const exercise   = getExercise(sessionExercise.exerciseId);
  const [collapsed, setCollapsed] = useState(false);
  const [showAllLast, setShowAllLast] = useState(false);

  if (!exercise) return null;

  // Isometric + timed-conditioning exercises use countdown timer
  // (conditioning: only when targetReps > 1, i.e. a real work duration was parsed — not a distance sprint)
  const measureType: MeasureType =
    exercise.category === 'Isometric' ||
    (exercise.category === 'Conditioning' && sessionExercise.targetReps > 1)
      ? 'time'
      : (exercise.measureType ?? 'strength');

  // Distance-based conditioning sprints (targetReps === 1) get the guided Start→timer→Done flow
  const isCondSprint = exercise.category === 'Conditioning' && measureType !== 'time';
  const unit        = exercise.unit;

  const lastSession = getLastSession(sessionExercise.exerciseId, sessionId);
  const pb          = getPB(sessionExercise.exerciseId, measureType);
  // Use programme-defined RIR if set, otherwise fall back to exercise suggested RIR
  const targetRir   = sessionExercise.targetRir ?? exercise.suggestedRir;
  // RIR applies to strength work only — never to eccentrics, plyometrics, isometrics, speed, warmup etc.
  const showRir = globalShowRir && !exercise.isWarmup && RIR_CATEGORIES.has(exercise.category) && sessionExercise.methodType !== 'eccentric';

  // Priming sets are stored at the start of sessionExercise.sets with isPriming:true.
  // Working sets follow immediately after. We separate them for all display/logic.
  const primingCount    = sessionExercise.hasPrimingSingles ? 2 : 0;
  const workingSets     = sessionExercise.sets.filter(s => !s.isPriming);
  const primingDone     = sessionExercise.sets.filter(s =>  s.isPriming).length;

  // For per-side STRENGTH exercises each physical set has a Left and Right row.
  // Time-based per-side (e.g. Copenhagen Plank) handles L/R inside the timer — no doubling.
  const isStrengthPerSide = !!(sessionExercise.isPerSide && measureType !== 'time');
  const completedCount  = workingSets.length;
  const totalSets       = isStrengthPerSide
    ? sessionExercise.targetSets * 2
    : sessionExercise.targetSets;
  const allDone         = completedCount >= totalSets;

  // Non-priming history used for defaults, PB display, and suggestion baseline
  const workingLastSets = (lastSession?.sets ?? []).filter(s => !s.isPriming);

  // Working weight for the priming percentages: best weight from last session,
  // or targetWeight as a fallback. If zero we skip rendering priming rows.
  const lastWorkingWeight = (() => {
    if (!sessionExercise.hasPrimingSingles || measureType !== 'strength') return 0;
    if (workingLastSets.length > 0) {
      return workingLastSets.reduce((best, s) => Math.max(best, s.weight), 0);
    }
    return sessionExercise.targetWeight;
  })();
  const primingWeights = (sessionExercise.hasPrimingSingles && lastWorkingWeight > 0)
    ? calcPrimingWeights(lastWorkingWeight)
    : null;

  const getSetDefaults = (i: number) => {
    // Intra-session: use the previous *working* set's values as base.
    // For time-based sets, completed.reps is always 1 (a flag, not duration),
    // so always use targetReps as the reps default to keep the timer initialised correctly.
    const prevWorkingIdx = primingCount + i - 1;
    if (i > 0 && sessionExercise.sets[prevWorkingIdx] && measureType !== 'time') {
      const prev = sessionExercise.sets[prevWorkingIdx];
      return { weight: prev.weight, reps: prev.reps };
    }
    // Inter-session: use RPE-calibrated baseline (strength sets only — time sets store
    // reps=1 as a flag, so inter-session reps would always be 1 and break the timer).
    if (workingLastSets.length && measureType !== 'time') {
      const base = interSessionBaseline(workingLastSets, targetRir ?? 2);
      if (base) return { weight: base.weight, reps: base.reps };
      if (workingLastSets[i]) return { weight: workingLastSets[i].weight, reps: workingLastSets[i].reps };
      return { weight: workingLastSets[0].weight, reps: workingLastSets[0].reps };
    }
    // For time-based exercises with previous session data, restore the last-used duration
    // (stored in the weight field) but use targetReps (1) as the reps flag.
    if (workingLastSets.length && measureType === 'time') {
      const lastSet = workingLastSets[i] ?? workingLastSets[0];
      return { weight: lastSet.weight, reps: sessionExercise.targetReps };
    }
    return { weight: sessionExercise.targetWeight, reps: sessionExercise.targetReps };
  };

  const weeklyGoal = (
    !exercise.isWarmup &&
    measureType === 'strength' &&
    completedCount === 0 &&
    workingLastSets.length > 0
  )
    ? weeklyProgressionSuggestion(
        workingLastSets,
        sessionExercise.targetSets,
        sessionExercise.targetReps,
        targetRir ?? 2,
      )
    : null;

  const lastCompleted = workingSets.length > 0 ? workingSets[workingSets.length - 1] : null;
  const suggestion = (
    lastCompleted?.rir !== undefined &&
    measureType === 'strength' &&
    completedCount < totalSets
  )
    ? intraSessionSuggestion(targetRir ?? 2, lastCompleted.rir, lastCompleted.weight)
    : null;

  const currentBest = workingSets.reduce<{ weight: number; reps: number } | null>(
    (best, set) => {
      if (!best) return set;
      if (measureType === 'reps') return set.reps > best.reps ? set : best;
      return set.weight > best.weight ? set : best;
    }, null,
  );
  const isNewPB = !!(currentBest && pb && (
    measureType === 'reps'
      ? currentBest.reps > pb.reps
      : currentBest.weight > pb.weight
  ));
  const pbDisplay = pb ? formatSetDisplay({ ...pb, completedAt: 0 }, measureType, unit) : null;
  const lastBest  = workingLastSets.length
    ? workingLastSets.reduce((b, s) => s.weight > b.weight ? s : b)
    : null;
  const lastDisplay = lastBest ? formatSetDisplay({ ...lastBest, completedAt: 0 }, measureType, unit) : null;

  return (
    <Card className={`overflow-hidden ${allDone ? 'opacity-80' : ''} ${isFlagged ? 'border-red-200' : ''}`}>
      <div className="flex items-center">
        <button className="flex-1 flex items-center justify-between p-4 min-w-0" onClick={() => setCollapsed(c => !c)}>
          <div className="flex items-center gap-3 min-w-0">
            {allDone  && <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />}
            {isFlagged && <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />}
            {!isFlagged && isNewPB && <Trophy size={16} className="text-yellow-500 flex-shrink-0" />}
            <div className="min-w-0 text-left">
              <div className="font-semibold text-gray-900 text-sm">{sessionExercise.displayName ?? exercise.name}</div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span>
                  {isStrengthPerSide
                    ? `${Math.floor(completedCount / 2)}/${sessionExercise.targetSets} sets (L+R)`
                    : `${completedCount}/${totalSets} ${exercise.category === 'Testing' ? 'trials' : 'sets'}`}
                </span>
                {sessionExercise.restSeconds > 0 && <span>· {sessionExercise.restSeconds}s rest</span>}
                {targetRir !== undefined && showRir && <span className="text-brand-500 font-medium">· {targetRir} RIR target</span>}
                {isFlagged && <span className="text-red-400 font-medium">· flagged</span>}
              </div>
            </div>
          </div>
          {collapsed
            ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
            : <ChevronUp   size={16} className="text-gray-400 flex-shrink-0" />}
        </button>
        {/* Pain/injury flag button */}
        <button
          onClick={onFlagExercise}
          title={isFlagged ? 'Remove flag' : 'Flag as painful / problematic'}
          className={`p-3 flex-shrink-0 transition-colors ${isFlagged ? 'text-red-400' : 'text-gray-200 hover:text-red-400'}`}
        >
          <AlertTriangle size={18} />
        </button>
      </div>

      {!collapsed && (
        <>
          {showTutorials && (
            <TutorialPanel exerciseId={exercise.id} coachingCue={sessionExercise.coachingCue} isPerSide={sessionExercise.isPerSide} />
          )}

          <div className="px-4 pb-4">
            {/* Last time & PB — hidden for warm-up and explosive/reactive exercises */}
            {!exercise.isWarmup && !HIDE_HISTORY_CATEGORIES.has(exercise.category) && <div className="flex gap-2 mb-3">
              <button onClick={() => setShowAllLast(s => !s)} className="flex-1 bg-blue-50 rounded-xl px-3 py-2 text-left">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Clock size={11} className="text-blue-500" />
                  <span className="text-xs font-semibold text-blue-600">Last Time</span>
                </div>
                {workingLastSets.length > 0 ? (
                  <div className="text-xs text-blue-700 leading-relaxed">
                    {showAllLast
                      ? workingLastSets.map((s, i) => (
                          <span key={i} className="mr-2 whitespace-nowrap">
                            {formatSetDisplay(s, measureType, unit)}{s.rir !== undefined ? ` @ ${s.rir} RIR` : ''}
                          </span>
                        ))
                      : <span className="font-medium">
                          {lastDisplay}
                          {lastBest?.rir !== undefined && <span className="text-blue-400 font-normal ml-1">@ {lastBest.rir} RIR</span>}
                        </span>
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
            </div>}

            {weeklyGoal && (
              <WeeklyGoalCard
                suggestedWeight={weeklyGoal.suggestedWeight}
                goalReps={weeklyGoal.goalReps}
                targetSets={sessionExercise.targetSets}
                action={weeklyGoal.action}
                reason={weeklyGoal.reason}
              />
            )}

            <div className="flex flex-col gap-2">
              {primingWeights && (
                <>
                  <div className="flex items-center gap-2 pt-1 pb-0.5">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">⚡ Priming Singles</span>
                    <div className="flex-1 h-px bg-purple-100" />
                  </div>
                  {primingWeights.map((pw, pi) => (
                    <div key={`p${pi}`}>
                      <SetRow
                        setIndex={pi}
                        completed={sessionExercise.sets[pi] ?? null}
                        defaultWeight={pw}
                        defaultReps={1}
                        measureType="strength"
                        unit={unit}
                        isWarmup={true}
                        onComplete={set => onCompleteSet(pi, { ...set, isPriming: true })}
                        onEdit={set => onEditSet(pi, { ...set, isPriming: true })}
                      />
                      {/* Rest timer after a completed priming set (not after the last priming set) */}
                      {restInfo && pi === primingDone - 1 && primingDone <= primingWeights.length && (
                        <InlineRestTimer restInfo={restInfo} />
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1 pb-0.5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Working Sets</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                </>
              )}

              {Array.from({ length: totalSets }).map((_, i) => {
                // wsIdx: when priming rows are visible, working sets are offset after them.
                // When priming can't be shown (no prior weight), store working sets from index 0.
                const wsIdx   = (primingWeights !== null ? primingCount : 0) + i;
                // For per-side strength: rows alternate L/R. getSetDefaults uses the pair index.
                const sideLabel: 'L' | 'R' | undefined = isStrengthPerSide
                  ? (i % 2 === 0 ? 'L' : 'R')
                  : undefined;
                const pairIdx  = isStrengthPerSide ? Math.floor(i / 2) : i;
                const defaults = getSetDefaults(pairIdx);
                return (
                  <div key={i}>
                    {/* Show suggestion banner just before the next uncompleted working set */}
                    {!isCondSprint && suggestion && i === completedCount && (
                      <RpeSuggestionBanner
                        action={suggestion.action}
                        message={suggestion.message}
                      />
                    )}
                    {isCondSprint ? (
                      <CondSprintRow
                        setIndex={i}
                        totalSets={totalSets}
                        completed={sessionExercise.sets[wsIdx] ?? null}
                        isActive={i === completedCount}
                        onComplete={set => onCompleteSet(wsIdx, set)}
                      />
                    ) : (
                      <SetRow
                        setIndex={i}
                        completed={sessionExercise.sets[wsIdx] ?? null}
                        defaultWeight={defaults.weight}
                        defaultReps={defaults.reps}
                        measureType={measureType}
                        unit={unit}
                        targetRir={(showRir && sideLabel !== 'L') ? targetRir : undefined}
                        showRir={showRir && sideLabel !== 'L'}
                        isWarmup={(exercise.isWarmup ?? false) || exercise.category === 'Conditioning'}
                        isPerSide={sessionExercise.isPerSide && measureType === 'time'}
                        sideLabel={sideLabel}
                        onComplete={set => onCompleteSet(wsIdx, set)}
                        onEdit={set => onEditSet(wsIdx, set)}
                        onUncomplete={() => onUncompleteSet(wsIdx)}
                      />
                    )}
                    {/* Rest timer: after Right rows (i % 2 === 1) for per-side strength,
                        or after any completed working set for normal exercises */}
                    {restInfo && i === completedCount - 1 &&
                      (!isStrengthPerSide || i % 2 === 1) && (
                      <InlineRestTimer restInfo={restInfo} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}


interface NewPBEntry {
  exerciseId: string;
  name: string;
  newWeight: number;
  newReps: number;
  prevWeight: number | null;
  prevReps: number | null;
}

// Maps a conditioning exercise id to its feedback type. Note: sprint
// activation/warm-up primers resolve to 'repeated-sprint' too, so a Zone 2 or
// Hi-Aerobic session will contain an 'RSA'-labelled primer — that is filtered
// out of post-session feedback below (see feedbackConditioningExercises).
function getCondTypeLabel(exerciseId: string): string {
  if (['aerobic-threshold-run', 'tempo-run', 'lactate-threshold-run'].includes(exerciseId)) return 'Zone 2';
  if (['hiit-run', 'ssg-simulation'].includes(exerciseId)) return 'HIIT';
  if (['repeated-sprint', 'shuttle-run'].includes(exerciseId)) return 'RSA';
  return 'Conditioning';
}

export function ActiveWorkout({ session, showTutorials, onUpdateSession, onFinish, onConditioningFeedback, conditioningStagnation, onDiscard, strengthSetup, onUpdateStrengthSetup }: ActiveWorkoutProps) {
  const timer = useTimer();
  const { getPB, getExercise, getLastSession, userSettings, updateSettings } = useStore();
  const showRir = userSettings.showRir ?? true;
  const [showFinish, setShowFinish] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showPBModal, setShowPBModal] = useState(false);
  const [pendingSession, setPendingSession] = useState<WorkoutSession | null>(null);
  const [newPBs, setNewPBs] = useState<NewPBEntry[]>([]);
  const [restingExerciseIdx, setRestingExerciseIdx] = useState<number | null>(null);
  const [showCondModal, setShowCondModal] = useState(false);
  const [pendingFinishSession, setPendingFinishSession] = useState<WorkoutSession | null>(null);
  const [condFeedbackByType, setCondFeedbackByType] = useState<Record<string, number | null>>({});
  const [condElapsedSecs, setCondElapsedSecs] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const [flaggedExercises, setFlaggedExercises] = useState<string[]>(session.flaggedExercises ?? []);

  // Session RPE modal — shown at the very end of the finish flow
  const [showRpeModal, setShowRpeModal] = useState(false);
  const [pendingRpeSession, setPendingRpeSession] = useState<WorkoutSession | null>(null);
  const [selectedRpe, setSelectedRpe] = useState(7);

  // Lift recalibration state — shown after session completes when tracked lifts are detected
  interface RecalLift { key: string; label: string; bestWeight: number; bestReps: number; current?: LiftBaseline; editWeight: string; editReps: string; }
  const [showRecalModal, setShowRecalModal] = useState(false);
  const [recalLifts, setRecalLifts] = useState<RecalLift[]>([]);
  const [pendingRecalSession, setPendingRecalSession] = useState<WorkoutSession | null>(null);

  // Capture pre-session PBs on mount (before any sets are saved)
  const prePBsRef = useRef<Record<string, { weight: number; reps: number } | null>>({});
  useEffect(() => {
    session.exercises.forEach(ex => {
      prePBsRef.current[ex.exerciseId] = getPB(ex.exerciseId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // For per-side strength exercises the UI shows targetSets × 2 rows (L + R each),
  // so count those doubles here to keep the progress bar accurate.
  // Use the same isPerSideStrength logic for both totals and completed so they always agree.
  const { totalSets, completedSets } = session.exercises.reduce((acc, e) => {
    const ex = getExercise(e.exerciseId);
    // Must match ExerciseRow's measureType logic: Isometric category → 'time'
    const effectiveMT = ex?.category === 'Isometric' ? 'time' : (ex?.measureType ?? 'strength');
    const isPerSideStrength = !!(e.isPerSide && effectiveMT !== 'time');
    const target = isPerSideStrength ? e.targetSets * 2 : e.targetSets;
    const done   = Math.min(e.sets.filter(s => !s.isPriming).length, target);
    return { totalSets: acc.totalSets + target, completedSets: acc.completedSets + done };
  }, { totalSets: 0, completedSets: 0 });
  const progressPct   = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const elapsedMins   = Math.floor((Date.now() - session.startTime) / 60000);

  const handleSkipRest = useCallback(() => {
    timer.skip();
    setRestingExerciseIdx(null);
    cancelRestNotification();
  }, [timer]);

  const conditioningExercises = session.exercises.filter(ex => {
    const exercise = getExercise(ex.exerciseId);
    return exercise?.category === 'Conditioning';
  });

  // Exercises that drive post-session conditioning feedback. A Zone 2 or
  // Hi-Aerobic session opens with a short sprint-activation primer that resolves
  // to 'repeated-sprint' (RSA). That primer is fixed CNS work, not the session's
  // conditioning focus, so when a Zone 2 / HIIT exercise is present we drop the
  // RSA-labelled primer — the athlete is only asked about the session's actual
  // focus (e.g. "how hard was the Zone 2?"), never a stray RSA question.
  const condTypeLabels = new Set(conditioningExercises.map(ex => getCondTypeLabel(ex.exerciseId)));
  const rsaIsPrimerOnly = condTypeLabels.has('RSA') && (condTypeLabels.has('Zone 2') || condTypeLabels.has('HIIT'));
  const feedbackConditioningExercises = rsaIsPrimerOnly
    ? conditioningExercises.filter(ex => getCondTypeLabel(ex.exerciseId) !== 'RSA')
    : conditioningExercises;

  // True when every non-warmup exercise is a conditioning exercise
  const isConditioningSession = session.exercises.length > 0 && session.exercises.every(ex => {
    const exercise = getExercise(ex.exerciseId);
    return !exercise || exercise.isWarmup || exercise.category === 'Conditioning';
  });

  const buildRecalLifts = useCallback((s: WorkoutSession) => {
    const seen = new Set<string>();
    const lifts: { key: string; label: string; bestWeight: number; bestReps: number; current?: LiftBaseline; editWeight: string; editReps: string }[] = [];
    for (const ex of s.exercises) {
      const exercise = getExercise(ex.exerciseId);
      if (!exercise) continue;
      const key = getLiftKey(exercise.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const workingSets = ex.sets.filter(ws => !ws.isPriming && ws.weight > 0 && ws.reps > 0);
      if (workingSets.length === 0) continue;
      // Best set by estimated 1RM
      const best = workingSets.reduce((a, b) =>
        epley1RM(b.weight, b.reps) > epley1RM(a.weight, a.reps) ? b : a,
      );
      const current = strengthSetup?.lifts.find(l => l.key === key);
      lifts.push({
        key,
        label: LIFT_META[key]?.label ?? key,
        bestWeight: best.weight,
        bestReps: best.reps,
        current,
        editWeight: String(best.weight),
        editReps: String(best.reps),
      });
    }
    return lifts;
  }, [getExercise, strengthSetup]);

  const finalFinish = useCallback((s: WorkoutSession) => {
    if (strengthSetup && onUpdateStrengthSetup) {
      const lifts = buildRecalLifts(s);
      if (lifts.length > 0) {
        setPendingRecalSession(s);
        setRecalLifts(lifts);
        setShowRecalModal(true);
        return;
      }
    }
    setSelectedRpe(7);
    setPendingRpeSession(s);
    setShowRpeModal(true);
  }, [strengthSetup, onUpdateStrengthSetup, buildRecalLifts]);

  const doFinish = useCallback((s: WorkoutSession) => {
    if (feedbackConditioningExercises.length > 0 && onConditioningFeedback) {
      setPendingFinishSession(s);
      setShowCondModal(true);
    } else {
      finalFinish(s);
    }
  }, [feedbackConditioningExercises.length, onConditioningFeedback, finalFinish]);

  const handleCondFeedbackConfirm = useCallback(() => {
    if (!pendingFinishSession || !onConditioningFeedback) return;
    blurActiveFormControl();
    const updates: Record<string, number> = {};
    feedbackConditioningExercises.forEach(ex => {
      const typeLabel = getCondTypeLabel(ex.exerciseId);
      const delta = condFeedbackByType[typeLabel] ?? 0;
      updates[ex.exerciseId] = Math.max(4, Math.min(25, ex.targetSets + delta));
    });
    onConditioningFeedback(updates);
    setShowCondModal(false);
    setCondFeedbackByType({});
    finalFinish(pendingFinishSession);
    setPendingFinishSession(null);
  }, [pendingFinishSession, feedbackConditioningExercises, condFeedbackByType, onConditioningFeedback, finalFinish]);

  const computeNewPBs = useCallback((s: WorkoutSession): NewPBEntry[] => {
    return s.exercises.flatMap(ex => {
      const exercise = getExercise(ex.exerciseId);
      if (!exercise || exercise.isWarmup) return [];
      const pre = prePBsRef.current[ex.exerciseId];
      // Exclude priming singles — they're sub-maximal and should not influence PB tracking
      const currentBest = ex.sets.filter(s => !s.isPriming).reduce<{ weight: number; reps: number } | null>(
        (best, set) => !best || set.weight > best.weight ? { weight: set.weight, reps: set.reps } : best,
        null,
      );
      if (!currentBest || currentBest.weight === 0) return [];
      const isNew = !pre
        || currentBest.weight > pre.weight
        || (currentBest.weight === pre.weight && currentBest.reps > pre.reps);
      if (!isNew) return [];
      return [{
        exerciseId: ex.exerciseId,
        name: exercise.name,
        newWeight: currentBest.weight,
        newReps: currentBest.reps,
        prevWeight: pre?.weight ?? null,
        prevReps: pre?.reps ?? null,
      }];
    });
  }, [getExercise]);

  const handleToggleFlag = useCallback((exerciseId: string) => {
    setFlaggedExercises(prev =>
      prev.includes(exerciseId) ? prev.filter(id => id !== exerciseId) : [...prev, exerciseId]
    );
  }, []);

  const handleFinishConfirm = useCallback((s: WorkoutSession) => {
    blurActiveFormControl();
    const finalSession = {
      ...s,
      endTime: Date.now(),
      notes: sessionNotes.trim() || undefined,
      flaggedExercises: flaggedExercises.length > 0 ? flaggedExercises : undefined,
    };
    const pbs = computeNewPBs(finalSession);
    setShowFinish(false);
    if (pbs.length > 0) {
      setPendingSession(finalSession);
      setNewPBs(pbs);
      setShowPBModal(true);
    } else {
      doFinish(finalSession);
    }
  }, [computeNewPBs, doFinish, sessionNotes, flaggedExercises]);

  const handleKeepPBs = useCallback(() => {
    if (pendingSession) doFinish(pendingSession);
    setShowPBModal(false);
  }, [pendingSession, doFinish]);

  const handleDiscardPBs = useCallback(() => {
    if (!pendingSession) return;
    const pbIds = newPBs.map(p => p.exerciseId);
    const updated: WorkoutSession = {
      ...pendingSession,
      exercises: pendingSession.exercises.map(ex => {
        if (!pbIds.includes(ex.exerciseId)) return ex;
        const pre = prePBsRef.current[ex.exerciseId];
        // When pre is null this is a first-ever lift — cap to 0 so the record
        // is not stored. Without this the discard has no effect for new exercises.
        const capWeight = pre ? pre.weight : 0;
        const sets = ex.sets.map(s => ({ ...s, weight: Math.min(s.weight, capWeight) }));
        return { ...ex, sets };
      }),
    };
    doFinish(updated);
    setShowPBModal(false);
  }, [pendingSession, newPBs, doFinish]);

  const handleEditSet = useCallback((exerciseIdx: number, setIndex: number, set: CompletedSet) => {
    const updated: WorkoutSession = {
      ...session,
      exercises: session.exercises.map((ex, i) => {
        if (i !== exerciseIdx) return ex;
        // Replace set at setIndex without creating sparse arrays
        const sets = ex.sets.map((s, si) => si === setIndex ? set : s);
        return { ...ex, sets };
      }),
    };
    onUpdateSession(updated);
  }, [session, onUpdateSession]);

  const handleResetWorkout = useCallback(() => {
    const updated: WorkoutSession = {
      ...session,
      exercises: session.exercises.map(ex => ({ ...ex, sets: [] })),
      startTime: Date.now(),
    };
    onUpdateSession(updated);
    setShowReset(false);
  }, [session, onUpdateSession]);

  const handleUncompleteSet = useCallback((exerciseIdx: number, setIndex: number) => {
    const updated: WorkoutSession = {
      ...session,
      exercises: session.exercises.map((ex, i) => {
        if (i !== exerciseIdx) return ex;
        // Drop the set at setIndex; keep all others in order
        const sets = ex.sets.filter((_, si) => si !== setIndex);
        return { ...ex, sets };
      }),
    };
    onUpdateSession(updated);
  }, [session, onUpdateSession]);

  const handleCompleteSet = useCallback((exerciseIdx: number, setIndex: number, set: CompletedSet) => {
    const ex = session.exercises[exerciseIdx];
    if (!ex) return; // guard against stale exerciseIdx

    const updated: WorkoutSession = {
      ...session,
      exercises: session.exercises.map((e, i) => {
        if (i !== exerciseIdx) return e;
        // Build a dense sets array, replacing or appending at setIndex
        const prev = (e.sets ?? []).filter(Boolean) as CompletedSet[];
        const sets: CompletedSet[] = setIndex < prev.length
          ? prev.map((s, si) => si === setIndex ? set : s)   // replace existing
          : [...prev, set];                                   // append next set
        return { ...e, sets };
      }),
    };
    onUpdateSession(updated);

    // Priming sets sit before working sets in the array; their rest durations differ (15 s / 60 s).
    // primingSetCount is 0 when there's no prior working weight (same guard as ExerciseSection).
    const lastExSession    = getLastSession(ex.exerciseId, session.id);
    const workingHistory   = (lastExSession?.sets ?? []).filter((s: { isPriming?: boolean }) => !s.isPriming);
    const lastWorkingWt    = ex.hasPrimingSingles
      ? (workingHistory.length > 0
          ? workingHistory.reduce((best: number, s: { weight: number }) => Math.max(best, s.weight), 0)
          : ex.targetWeight)
      : 0;
    const primingWasShown  = ex.hasPrimingSingles && lastWorkingWt > 0;
    const primingSetCount  = primingWasShown ? 2 : 0;
    const isPrimingSet     = setIndex < primingSetCount;
    const workingIdx       = setIndex - primingSetCount; // 0-based index within working sets

    // For per-side strength exercises: each physical set = 2 rows (L then R).
    // Rest fires only after the Right row (odd workingIdx). Left row (even) → no rest.
    const exerciseObj      = getExercise(ex.exerciseId);
    // Match ExerciseRow: Isometric category → 'time'
    const exMeasureType    = exerciseObj?.category === 'Isometric' ? 'time' : (exerciseObj?.measureType ?? 'strength');
    const isPerSideStrengthEx = !!(ex.isPerSide && exMeasureType !== 'time');
    const effectiveSets    = isPerSideStrengthEx ? ex.targetSets * 2 : ex.targetSets;
    const isLeftSide       = isPerSideStrengthEx && !isPrimingSet && workingIdx % 2 === 0;

    const isLastSet        = !isPrimingSet && setIndex >= primingSetCount + effectiveSets - 1;
    const isLastExercise   = exerciseIdx === session.exercises.length - 1;
    const restSecs         = isPrimingSet
      ? (setIndex === primingSetCount - 1 ? 60 : 15)  // 2nd priming single → 60 s; 1st → 15 s
      : ex.restSeconds;
    // Skip rest after Left-side rows — Right side follows immediately with no break
    if (!isLeftSide && !(isLastSet && isLastExercise) && restSecs > 0) {
      timer.start(restSecs);
      setRestingExerciseIdx(exerciseIdx);
      scheduleRestEndNotification(restSecs);
    }
  }, [session, onUpdateSession, timer, getExercise, getLastSession]);


  useEffect(() => {
    if (timer.finished) {
      playRestEndSound();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      timer.stop();
      setRestingExerciseIdx(null);
    }
  // timer.stop is stable; only re-run when finished flag flips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.finished]);

  // Live elapsed timer for conditioning sessions
  useEffect(() => {
    if (!isConditioningSession) return;
    const update = () => setCondElapsedSecs(Math.floor((Date.now() - session.startTime) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isConditioningSession, session.startTime]);

  const restInfo: RestInfo | undefined = (timer.running && restingExerciseIdx !== null)
    ? { remaining: timer.remaining, progress: timer.progress, onSkip: handleSkipRest }
    : undefined;

  const fmtElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Layout
        title={session.name}
        onBack={() => setShowFinish(true)}
        rightAction={<Button size="sm" onClick={() => setShowFinish(true)}>Finish</Button>}
      >
        {/* Progress bar — for conditioning shows interval count, for strength shows set count */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>
              {isConditioningSession
                ? `${completedSets}/${totalSets} intervals · ${fmtElapsed(condElapsedSecs)}`
                : `${completedSets}/${totalSets} sets · ${progressPct}%`}
            </span>
            <div className="flex items-center gap-2">
              {!isConditioningSession && (
                <>
                  <span>{elapsedMins}m elapsed</span>
                  <button
                    onClick={() => updateSettings({ showRir: !showRir })}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${
                      showRir
                        ? 'bg-brand-50 border-brand-300 text-brand-600'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                    title={showRir ? 'RIR tracking on — tap to hide' : 'RIR tracking off — tap to enable'}
                  >
                    <span className={`w-2 h-2 rounded-full ${showRir ? 'bg-brand-500' : 'bg-gray-300'}`} />
                    RIR
                  </button>
                  <button
                    onClick={() => setShowReset(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-gray-100 border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                    title="Reset all sets — start this workout from scratch"
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
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
            <Fragment key={`${exerciseIdx}-${ex.exerciseId}`}>
              {ex.blockTitle && (
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 whitespace-nowrap">
                    {ex.blockTitle.replace(/^[^\w\s]*\s*/, '')}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
              <ExerciseSection
                sessionExercise={ex}
                sessionId={session.id}
                showTutorials={showTutorials}
                globalShowRir={showRir}
                restInfo={exerciseIdx === restingExerciseIdx ? restInfo : undefined}
                isFlagged={flaggedExercises.includes(ex.exerciseId)}
                onCompleteSet={(setIndex, set) => handleCompleteSet(exerciseIdx, setIndex, set)}
                onEditSet={(setIndex, set) => handleEditSet(exerciseIdx, setIndex, set)}
                onUncompleteSet={(setIndex) => handleUncompleteSet(exerciseIdx, setIndex)}
                onFlagExercise={() => handleToggleFlag(ex.exerciseId)}
              />
            </Fragment>
          ))}
        </div>

        <div className="mt-6">
          <Button variant="danger" fullWidth onClick={() => setShowFinish(true)} className="mb-4">
            Finish Workout
          </Button>
        </div>
      </Layout>

      {showReset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-2">Reset Workout?</h2>
            <p className="text-sm text-gray-500 mb-5">This will clear all completed sets so you can start from scratch. Your session history won't be affected.</p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setShowReset(false)}>Cancel</Button>
              <Button variant="danger" fullWidth onClick={handleResetWorkout}>Reset</Button>
            </div>
          </div>
        </div>
      )}

      {showFinish && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-2">Finish Workout?</h2>
            <p className="text-sm text-gray-500 mb-4">
              {completedSets < totalSets
                ? `You've completed ${completedSets} of ${totalSets} sets.`
                : 'Great work — all sets done!'}
            </p>

            {/* Session notes */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                <FileText size={12} />
                Session notes (optional)
              </label>
              <textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="How did it feel? Anything to note for next time…"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700 placeholder-gray-300"
              />
            </div>

            {/* Flagged exercises summary */}
            {flaggedExercises.length > 0 && (
              <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-xs font-semibold text-red-600">Flagged exercises will be saved</span>
                </div>
                <p className="text-xs text-red-500">
                  {flaggedExercises.length} exercise{flaggedExercises.length > 1 ? 's' : ''} flagged as painful/problematic. Visible in your session history.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  blurActiveFormControl();
                  setShowFinish(false);
                }}
              >
                Continue
              </Button>
              <Button fullWidth onClick={() => handleFinishConfirm(session)}>Finish</Button>
            </div>
            <button
              onClick={onDiscard}
              className="w-full mt-3 text-xs text-red-400 hover:text-red-500 text-center"
            >
              Discard workout
            </button>
          </div>
        </div>
      )}

      {showCondModal && pendingFinishSession && (() => {
        // Group exercises by type label for per-type feedback
        const typeGroups: Map<string, { exercises: typeof conditioningExercises; stagnation: number }> = new Map();
        feedbackConditioningExercises.forEach(ex => {
          const typeLabel = getCondTypeLabel(ex.exerciseId);
          const existing = typeGroups.get(typeLabel);
          const stag = conditioningStagnation?.[ex.exerciseId] ?? 0;
          if (existing) {
            existing.exercises.push(ex);
            existing.stagnation = Math.max(existing.stagnation, stag);
          } else {
            typeGroups.set(typeLabel, { exercises: [ex], stagnation: stag });
          }
        });
        const groups = Array.from(typeGroups.entries());
        const allSelected = groups.every(([label]) => condFeedbackByType[label] !== undefined && condFeedbackByType[label] !== null);

        const FEEDBACK_OPTIONS = [
          { delta: -2, emoji: '😓', label: 'Too hard', colour: 'border-red-200 bg-red-50 text-red-700' },
          { delta: 0,  emoji: '✅', label: 'Just right', colour: 'border-gray-200 bg-gray-50 text-gray-700' },
          { delta: 1,  emoji: '💪', label: '1–2 more', colour: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
          { delta: 2,  emoji: '🔥', label: '3+ more', colour: 'border-brand-200 bg-brand-50 text-brand-700' },
        ];

        return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <p className="text-lg font-bold text-gray-900 mb-1">How was the conditioning?</p>
            <p className="text-xs text-gray-400 mb-4">Rate each type — your answers adjust next session independently.</p>

            {groups.map(([typeLabel, { exercises: groupExs, stagnation }]) => {
              const selected = condFeedbackByType[typeLabel];
              return (
                <div key={typeLabel} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-800">{typeLabel}</p>
                    <p className="text-xs text-gray-400">{groupExs[0]?.targetSets ?? '—'} intervals</p>
                  </div>
                  {stagnation >= 3 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                      <p className="text-xs text-amber-700">
                        💡 Same volume for {stagnation} sessions — ready to add more?
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {FEEDBACK_OPTIONS.map(opt => (
                      <button
                        key={opt.delta}
                        onClick={() => setCondFeedbackByType(prev => ({ ...prev, [typeLabel]: opt.delta }))}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 text-xs font-medium transition-all active:scale-95 ${
                          selected === opt.delta
                            ? 'border-brand-500 bg-brand-50 text-brand-700 scale-105'
                            : opt.colour
                        }`}
                      >
                        <span className="text-lg leading-none">{opt.emoji}</span>
                        <span className="text-[10px] text-center leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              onClick={handleCondFeedbackConfirm}
              disabled={!allSelected}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-sm disabled:opacity-40 hover:bg-brand-600 transition-colors mt-2"
            >
              Save & Finish
            </button>
          </div>
        </div>
        );
      })()}

      {showRecalModal && pendingRecalSession && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell size={20} className="text-brand-500" />
              <h2 className="font-bold text-gray-900 text-lg">Update lift baselines?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5 leading-snug">
              Your next session weights will be calculated from these numbers. Edit if needed, then save.
            </p>

            <div className="flex flex-col gap-4 mb-6">
              {recalLifts.map((lift, idx) => {
                const newE1RM = epley1RM(Number(lift.editWeight) || lift.bestWeight, Number(lift.editReps) || lift.bestReps);
                const oldE1RM = lift.current?.estimated1RM;
                const delta = oldE1RM ? newE1RM - oldE1RM : null;
                return (
                  <div key={lift.key} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-900">{lift.label}</p>
                      {delta !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          delta > 0 ? 'bg-green-100 text-green-700' : delta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg e1RM
                        </span>
                      )}
                    </div>

                    {lift.current && (
                      <p className="text-xs text-gray-400 mb-2">
                        Previous baseline: {lift.current.workingWeightKg} kg × {lift.current.workingReps} reps
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Weight (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="2.5"
                          value={lift.editWeight}
                          onChange={e => setRecalLifts(prev => prev.map((l, i) => i === idx ? { ...l, editWeight: e.target.value } : l))}
                          style={{ fontSize: 16 }}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Reps</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={lift.editReps}
                          onChange={e => setRecalLifts(prev => prev.map((l, i) => i === idx ? { ...l, editReps: e.target.value } : l))}
                          style={{ fontSize: 16 }}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-2">
                      Estimated 1RM: <span className="font-bold text-brand-600">{newE1RM.toFixed(1)} kg</span>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRecalModal(false);
                  setSelectedRpe(7);
                  setPendingRpeSession(pendingRecalSession);
                  setShowRpeModal(true);
                  setPendingRecalSession(null);
                }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
              >
                Skip for now
              </button>
              <button
                onClick={() => {
                  if (!onUpdateStrengthSetup || !strengthSetup) return;
                  const updatedLifts: LiftBaseline[] = strengthSetup.lifts.map(existing => {
                    const edit = recalLifts.find(r => r.key === existing.key);
                    if (!edit) return existing;
                    const w = Number(edit.editWeight) || existing.workingWeightKg;
                    const r = Number(edit.editReps) || existing.workingReps;
                    return { ...existing, workingWeightKg: w, workingReps: r, estimated1RM: epley1RM(w, r) };
                  });
                  recalLifts.forEach(edit => {
                    if (!updatedLifts.find(l => l.key === edit.key)) {
                      const w = Number(edit.editWeight) || edit.bestWeight;
                      const r = Number(edit.editReps) || edit.bestReps;
                      updatedLifts.push({ key: edit.key, exerciseName: edit.label, workingWeightKg: w, workingReps: r, estimated1RM: epley1RM(w, r) });
                    }
                  });
                  onUpdateStrengthSetup({ lifts: updatedLifts, configuredAt: Date.now() });
                  setShowRecalModal(false);
                  setSelectedRpe(7);
                  setPendingRpeSession(pendingRecalSession);
                  setShowRpeModal(true);
                  setPendingRecalSession(null);
                }}
                className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
              >
                Update baselines
              </button>
            </div>
          </div>
        </div>
      )}

      {showPBModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={22} className="text-yellow-500" />
              <h2 className="font-bold text-gray-900 text-lg">New Personal Best{newPBs.length > 1 ? 's' : ''}!</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">You set a new record this session. Save or discard?</p>
            <div className="flex flex-col gap-2 mb-5">
              {newPBs.map(pb => (
                <div key={pb.exerciseId} className="flex items-center justify-between bg-yellow-50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{pb.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pb.prevWeight !== null
                        ? `was ${pb.prevWeight}kg × ${pb.prevReps}`
                        : 'First recorded lift'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-yellow-600">{pb.newWeight}kg</p>
                    <p className="text-xs text-yellow-500">× {pb.newReps} reps</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={handleDiscardPBs}>
                Discard
              </Button>
              <Button fullWidth onClick={handleKeepPBs}>
                <Trophy size={14} />
                Keep PBs
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRpeModal && pendingRpeSession && (() => {
        const RPE_LABELS: Record<number, { label: string; color: string }> = {
          1:  { label: 'Very easy',      color: 'text-green-500' },
          2:  { label: 'Easy',           color: 'text-green-500' },
          3:  { label: 'Moderate',       color: 'text-green-600' },
          4:  { label: 'Somewhat hard',  color: 'text-lime-600'  },
          5:  { label: 'Hard',           color: 'text-yellow-600' },
          6:  { label: 'Hard',           color: 'text-yellow-600' },
          7:  { label: 'Very hard',      color: 'text-orange-500' },
          8:  { label: 'Very hard',      color: 'text-orange-600' },
          9:  { label: 'Extremely hard', color: 'text-red-500'   },
          10: { label: 'Max effort',     color: 'text-red-600'   },
        };
        const meta = RPE_LABELS[selectedRpe];
        return (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl mb-2">
              <h2 className="font-bold text-gray-900 text-lg mb-1">How hard was that?</h2>
              <p className="text-sm text-gray-500 mb-5">Rate the overall session effort (RPE 1–10). Used to track your training load accurately.</p>

              <div className="flex items-end justify-between gap-1 mb-3">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedRpe(n)}
                    className={`flex-1 rounded-lg transition-all text-xs font-bold py-2 ${
                      n === selectedRpe
                        ? 'bg-brand-500 text-white scale-110 shadow'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <p className={`text-center text-sm font-semibold mb-5 ${meta.color}`}>
                RPE {selectedRpe} — {meta.label}
              </p>

              <Button
                fullWidth
                onClick={() => {
                  blurActiveFormControl();
                  const s = { ...pendingRpeSession, sessionRpe: selectedRpe };
                  setShowRpeModal(false);
                  setPendingRpeSession(null);
                  onFinish(s);
                }}
              >
                Save session
              </Button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
