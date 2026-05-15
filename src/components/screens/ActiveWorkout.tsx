import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, SkipForward, Plus, Minus, ChevronDown, ChevronUp,
  Trophy, Clock, BookOpen, Lightbulb, MapPin, ChevronRight,
  TrendingUp, TrendingDown, Pencil, Save,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { RpeSelector } from '../ui/RpeSelector';
import { useTimer } from '../../hooks/useTimer';
import { useStore } from '../../hooks/useStore';
import { WorkoutSession, SessionExercise, CompletedSet, NavState, MeasureType } from '../../types';
import { EXERCISE_DESCRIPTIONS } from '../../data/exerciseDescriptions';
import { intraSessionSuggestion, interSessionBaseline } from '../../lib/rpeProgression';

interface ActiveWorkoutProps {
  session: WorkoutSession;
  showTutorials: boolean;
  onUpdateSession: (session: WorkoutSession) => void;
  onFinish: (session: WorkoutSession) => void;
  onDiscard: () => void;
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

function playTimerDoneSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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

// ── RPE suggestion banner ──────────────────────────────────────────────────

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

// ── Tutorial panel ─────────────────────────────────────────────────────────

function TutorialPanel({ exerciseId, exerciseName: _exerciseName }: { exerciseId: string; exerciseName: string }) {
  const [open, setOpen] = useState(false);
  const desc = EXERCISE_DESCRIPTIONS[exerciseId];

  if (!desc) return null;

  return (
    <div className="border-t border-gray-100 mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
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
        <div className="px-4 pb-4 bg-gray-50/60">
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
              {desc.tips?.length && (
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
// Two-phase commit: user logs set data → confirms with RPE → set saved.
// If measureType isn't 'strength', RPE is still captured but no weight
// adjustment is suggested (performance outputs need different logic).

interface SetRowProps {
  setIndex: number;
  completed: CompletedSet | null;
  defaultWeight: number;
  defaultReps: number;
  measureType?: MeasureType;
  unit?: string;
  targetRir?: number;
  isWarmup?: boolean;
  onComplete: (set: CompletedSet) => void;
  onEdit?: (set: CompletedSet) => void;
}

function SetRow({
  setIndex, completed, defaultWeight, defaultReps,
  measureType = 'strength', unit, targetRir, isWarmup, onComplete, onEdit,
}: SetRowProps) {
  // Use string state so we can show blank instead of "0"
  const [repsStr, setRepsStr]     = useState(defaultReps  > 0 ? String(defaultReps)  : '');
  const [weightStr, setWeightStr] = useState(defaultWeight > 0 ? String(defaultWeight) : '');
  const reps   = parseInt(repsStr)   || 0;
  const weight = parseFloat(weightStr) || 0;

  // Two-phase commit state
  const [pendingSet, setPendingSet] = useState<Omit<CompletedSet, 'rir'> | null>(null);

  // Timer state for time-based exercises (background-safe: uses absolute endTime)
  const [timerSecs, setTimerSecs] = useState(defaultReps);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEndRef = useRef<number | null>(null);
  const timerSecsRef = useRef(timerSecs);
  timerSecsRef.current = timerSecs;

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
        setTimerRunning(false);
        playTimerDoneSound();
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
        onComplete({ reps: 1, weight: defaultReps, completedAt: Date.now() });
      }
    };

    const id = setInterval(tick, 250);
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [timerRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode for completed sets
  const [isEditing, setIsEditing] = useState(false);
  // RIR re-edit for completed sets
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
    const newReps   = parseInt(editRepsStr)   || completed.reps;
    const newWeight = parseFloat(editWeightStr) || completed.weight;
    onEdit({ ...completed, reps: newReps, weight: newWeight });
    setIsEditing(false);
  };

  const label = getMeasureLabel(measureType, unit);
  const step  = measureType === 'strength' ? 2.5 : measureType === 'distance' ? 0.1 : 1;

  // Phase 1: user taps checkmark → capture set, await RPE
  const handleInitialLog = () => {
    if (completed || pendingSet) return;
    if (isWarmup) {
      // Warmup: skip RPE phase entirely
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
      setPendingSet({ reps, weight: 0, completedAt: Date.now() });
    } else if (measureType === 'strength') {
      setPendingSet({ reps, weight, completedAt: Date.now() });
    } else {
      // For non-strength exercises, still capture then await RPE
      setPendingSet({ reps: 1, weight, completedAt: Date.now() });
    }
  };

  // Phase 2: user picks RIR → finalise set
  const handleRir = (rir: number) => {
    if (!pendingSet) return;
    onComplete({ ...pendingSet, rir });
    setPendingSet(null);
  };

  // Skip RPE — save without it
  const handleSkipRpe = () => {
    if (!pendingSet) return;
    onComplete(pendingSet);
    setPendingSet(null);
  };

  const isAwaitingRpe = pendingSet !== null && !completed;
  const isInteractive = !completed && !isAwaitingRpe;

  // ── Edit mode UI (replaces normal row when editing a completed set) ──────
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

  // Completed time-based set: show simple green badge
  if (completed && measureType === 'time') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
        <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
        <span className="flex-1 text-sm font-semibold text-green-600">✓ {defaultReps}s</span>
        {completed && onEdit && (
          <button
            onClick={handleStartEdit}
            className="p-1 rounded-lg text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
            title="Edit this set"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* ── Timer UI for time-based exercises ── */}
      {measureType === 'time' && !completed && (
        <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors bg-gray-50`}>
          <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">{setIndex + 1}</span>
          <div className="flex flex-col items-center gap-2 py-2 w-full">
            <div className="text-3xl font-black tabular-nums text-brand-600">
              {timerSecs}s
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="h-2 bg-brand-500 rounded-full transition-all duration-1000"
                style={{ width: `${((defaultReps - timerSecs) / defaultReps) * 100}%` }}
              />
            </div>
            <div className="flex gap-2">
              {!timerRunning && timerSecs === defaultReps && (
                <button
                  onClick={() => setTimerRunning(true)}
                  className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600"
                >
                  Start {defaultReps}s
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
                    onClick={() => setTimerSecs(defaultReps)}
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

      {/* ── Main set row (non-time types) ── */}
      {measureType !== 'time' && (<div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        completed       ? 'bg-green-50 border border-green-100' :
        isAwaitingRpe   ? 'bg-brand-50 border border-brand-200' :
                          'bg-gray-50'
      }`}>
        <span className="text-sm font-bold text-gray-400 w-6 text-center flex-shrink-0">
          {setIndex + 1}
        </span>

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
                  type="number" value={weightStr} min="0" step="0.5"
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
                  type="number" value={repsStr} min="1"
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
              <input type="number" value={repsStr} min="1" placeholder="0" disabled={!isInteractive}
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
              <input type="number" value={weightStr} min="0" step={step} placeholder="0" disabled={!isInteractive}
                onChange={e => setWeightStr(e.target.value)}
                onFocus={e => e.target.select()}
                style={{ fontSize: '16px' }}
                className="w-20 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50" />
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
          onClick={handleInitialLog}
          disabled={!!completed || isAwaitingRpe}
          className={`p-1 rounded-full transition-colors flex-shrink-0 ${
            completed ? 'text-green-500' :
            isAwaitingRpe ? 'text-brand-400' :
            'text-gray-300 hover:text-brand-500'
          }`}
        >
          <CheckCircle2 size={26} strokeWidth={completed ? 2.5 : 1.5} />
        </button>
      </div>)}

      {/* ── Phase 2: RIR selector ── */}
      {isAwaitingRpe && (
        <RpeSelector
          value={null}
          onChange={handleRir}
          onSkip={handleSkipRpe}
          targetRir={targetRir}
        />
      )}

      {/* ── RIR re-edit for already-completed sets ── */}
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

// ── Exercise section ───────────────────────────────────────────────────────

function ExerciseSection({
  sessionExercise,
  sessionId,
  showTutorials,
  restInfo,
  onCompleteSet,
  onEditSet,
}: {
  sessionExercise: SessionExercise;
  sessionId: string;
  showTutorials: boolean;
  restInfo?: RestInfo;
  onCompleteSet: (setIndex: number, set: CompletedSet) => void;
  onEditSet: (setIndex: number, set: CompletedSet) => void;
}) {
  const { getExercise, getLastSession, getPB } = useStore();
  const exercise   = getExercise(sessionExercise.exerciseId);
  const [collapsed, setCollapsed] = useState(false);
  const [showAllLast, setShowAllLast] = useState(false);

  if (!exercise) return null;

  // Isometric exercises use time input regardless of stored measureType
  const measureType: MeasureType = exercise.category === 'Isometric'
    ? 'time'
    : (exercise.measureType ?? 'strength');
  const unit        = exercise.unit;

  const lastSession = getLastSession(sessionExercise.exerciseId, sessionId);
  const pb          = getPB(sessionExercise.exerciseId, measureType);
  // Use programme-defined RIR if set, otherwise fall back to exercise suggested RIR
  const targetRir   = sessionExercise.targetRir ?? exercise.suggestedRir;
  // RIR only applies to strength and eccentric work — not plyometrics, isometrics, speed, warmup etc.
  const RIR_CATEGORIES = new Set(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body', 'Eccentric']);
  const showRir = !exercise.isWarmup && RIR_CATEGORIES.has(exercise.category);

  const completedCount = sessionExercise.sets.length;
  const totalSets      = sessionExercise.targetSets;
  const allDone        = completedCount >= totalSets;

  // ── Default weight for each set row ────────────────────────────────────
  const getSetDefaults = (i: number) => {
    // Intra-session: use previous set's values as base
    if (i > 0 && sessionExercise.sets[i - 1]) {
      return { weight: sessionExercise.sets[i - 1].weight, reps: sessionExercise.sets[i - 1].reps };
    }
    // Inter-session: use RPE-calibrated baseline when available
    if (lastSession?.sets.length) {
      const base = interSessionBaseline(lastSession.sets, targetRir ?? 2);
      if (base) return { weight: base.weight, reps: base.reps };
    }
    if (lastSession?.sets[i]) return { weight: lastSession.sets[i].weight, reps: lastSession.sets[i].reps };
    if (lastSession?.sets[0]) return { weight: lastSession.sets[0].weight, reps: lastSession.sets[0].reps };
    return { weight: sessionExercise.targetWeight, reps: sessionExercise.targetReps };
  };

  // ── Intra-session suggestion (shown after last logged set with RPE) ────
  const lastCompleted = sessionExercise.sets[sessionExercise.sets.length - 1];
  const suggestion = (
    lastCompleted?.rir !== undefined &&
    measureType === 'strength' &&
    completedCount < totalSets
  )
    ? intraSessionSuggestion(targetRir ?? 2, lastCompleted.rir, lastCompleted.weight)
    : null;

  // ── PB / last session display ──────────────────────────────────────────
  const currentBest = sessionExercise.sets.reduce<{ weight: number; reps: number } | null>(
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
  const lastBest  = lastSession?.sets.length
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
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span>{completedCount}/{totalSets} {exercise.category === 'Testing' ? 'trials' : 'sets'}</span>
              {sessionExercise.restSeconds > 0 && <span>· {sessionExercise.restSeconds}s rest</span>}
              {targetRir !== undefined && showRir && <span className="text-brand-500 font-medium">· {targetRir} RIR target</span>}
            </div>
          </div>
        </div>
        {collapsed
          ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
          : <ChevronUp   size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {!collapsed && (
        <>
          {showTutorials && (
            <TutorialPanel exerciseId={exercise.id} exerciseName={exercise.name} />
          )}

          <div className="px-4 pb-4">
            {/* Last time & PB — hidden for warm-up exercises */}
            {!exercise.isWarmup && <div className="flex gap-2 mb-3">
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

            {/* Set rows */}
            <div className="flex flex-col gap-2">
              {Array.from({ length: totalSets }).map((_, i) => {
                const defaults = getSetDefaults(i);
                return (
                  <div key={i}>
                    {/* Show suggestion banner just before the next uncompleted set */}
                    {suggestion && i === completedCount && (
                      <RpeSuggestionBanner
                        action={suggestion.action}
                        message={suggestion.message}
                      />
                    )}
                    <SetRow
                      setIndex={i}
                      completed={sessionExercise.sets[i] ?? null}
                      defaultWeight={defaults.weight}
                      defaultReps={defaults.reps}
                      measureType={measureType}
                      unit={unit}
                      targetRir={showRir ? targetRir : undefined}
                      isWarmup={!showRir}
                      onComplete={set => onCompleteSet(i, set)}
                      onEdit={set => onEditSet(i, set)}
                    />
                    {/* Rest timer appears between last completed set and next pending set */}
                    {restInfo && i === completedCount - 1 && (
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

// ── Main ───────────────────────────────────────────────────────────────────

interface NewPBEntry {
  exerciseId: string;
  name: string;
  newWeight: number;
  newReps: number;
  prevWeight: number | null;
  prevReps: number | null;
}

export function ActiveWorkout({ session, showTutorials, onUpdateSession, onFinish, onDiscard, onNavigate: _onNavigate }: ActiveWorkoutProps) {
  const timer = useTimer();
  const { getPB, getExercise } = useStore();
  const [showFinish, setShowFinish] = useState(false);
  const [showPBModal, setShowPBModal] = useState(false);
  const [pendingSession, setPendingSession] = useState<WorkoutSession | null>(null);
  const [newPBs, setNewPBs] = useState<NewPBEntry[]>([]);
  const [restingExerciseIdx, setRestingExerciseIdx] = useState<number | null>(null);

  // Capture pre-session PBs on mount (before any sets are saved)
  const prePBsRef = useRef<Record<string, { weight: number; reps: number } | null>>({});
  useEffect(() => {
    session.exercises.forEach(ex => {
      prePBsRef.current[ex.exerciseId] = getPB(ex.exerciseId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSets     = session.exercises.reduce((a, e) => a + e.targetSets, 0);
  const completedSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const progressPct   = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const elapsedMins   = Math.floor((Date.now() - session.startTime) / 60000);

  const handleSkipRest = useCallback(() => {
    timer.skip();
    setRestingExerciseIdx(null);
  }, [timer]);

  const computeNewPBs = useCallback((s: WorkoutSession): NewPBEntry[] => {
    return s.exercises.flatMap(ex => {
      const exercise = getExercise(ex.exerciseId);
      if (!exercise || exercise.isWarmup) return [];
      const pre = prePBsRef.current[ex.exerciseId];
      const currentBest = ex.sets.reduce<{ weight: number; reps: number } | null>(
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

  const handleFinishConfirm = useCallback((s: WorkoutSession) => {
    const finalSession = { ...s, endTime: Date.now() };
    const pbs = computeNewPBs(finalSession);
    setShowFinish(false);
    if (pbs.length > 0) {
      setPendingSession(finalSession);
      setNewPBs(pbs);
      setShowPBModal(true);
    } else {
      onFinish(finalSession);
    }
  }, [computeNewPBs, onFinish]);

  const handleKeepPBs = useCallback(() => {
    if (pendingSession) onFinish(pendingSession);
    setShowPBModal(false);
  }, [pendingSession, onFinish]);

  const handleDiscardPBs = useCallback(() => {
    if (!pendingSession) return;
    const pbIds = newPBs.map(p => p.exerciseId);
    const updated: WorkoutSession = {
      ...pendingSession,
      exercises: pendingSession.exercises.map(ex => {
        if (!pbIds.includes(ex.exerciseId)) return ex;
        const pre = prePBsRef.current[ex.exerciseId];
        if (!pre) return ex; // no prior PB — keep all sets
        const kept = ex.sets.filter(s => s.weight <= pre.weight);
        return { ...ex, sets: kept };
      }),
    };
    onFinish(updated);
    setShowPBModal(false);
  }, [pendingSession, newPBs, onFinish]);

  const handleEditSet = useCallback((exerciseIdx: number, setIndex: number, set: CompletedSet) => {
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
  }, [session, onUpdateSession]);

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

    const ex         = session.exercises[exerciseIdx];
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
            <React.Fragment key={ex.exerciseId}>
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
                restInfo={exerciseIdx === restingExerciseIdx ? restInfo : undefined}
                onCompleteSet={(setIndex, set) => handleCompleteSet(exerciseIdx, setIndex, set)}
                onEditSet={(setIndex, set) => handleEditSet(exerciseIdx, setIndex, set)}
              />
            </React.Fragment>
          ))}
        </div>

        <div className="mt-6">
          <Button variant="danger" fullWidth onClick={() => setShowFinish(true)} className="mb-4">
            Finish Workout
          </Button>
        </div>
      </Layout>

      {showFinish && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-2">Finish Workout?</h2>
            <p className="text-sm text-gray-500 mb-4">
              {completedSets < totalSets
                ? `You've completed ${completedSets} of ${totalSets} sets.`
                : 'Great work — all sets done!'}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setShowFinish(false)}>Continue</Button>
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

      {/* ── PB review modal ── */}
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
    </>
  );
}
