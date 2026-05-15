import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight, ChevronLeft, Check, Zap, Activity,
  TrendingUp, TrendingDown, Wind, Award, X, AlertTriangle,
  Play, SkipForward, Square, Info,
} from 'lucide-react';
import { TestType, SingleTestResult, TestSession } from '../../types';
import {
  GRADE_LABELS, GRADE_COLOURS,
  calcFatigueIndex, calcTestSession,
  getProgression, TEST_LABELS, TEST_UNIT, TEST_LOWER_IS_BETTER,
  TEST_PROTOCOLS, POSITION_ENERGY_PROFILE,
} from '../../data/testingBattery';
import { Card } from '../ui/Card';

// ── Props ──────────────────────────────────────────────────────────────────

interface TestingBatteryProps {
  position: string;
  previousSession?: TestSession | null;
  onComplete: (session: TestSession) => void;
  onSkip: () => void;
}

// ── Internal draft type ────────────────────────────────────────────────────

interface TestDraft {
  attempts: number[];        // For sprint/jump/yoyo
  skipped: boolean;
  rsaAllSprints?: number[];  // RSA-specific: 6 entered times
  rsaCompleted?: boolean;    // true when RSA cycle finished, ready for time entry
}

type FlowPhase = 'select' | 'sex' | 'testing' | 'results';

// ── RSA State Machine ──────────────────────────────────────────────────────

type RsaPhase = 'idle' | 'countdown' | 'active' | 'rest' | 'done';

interface RsaState {
  phase: RsaPhase;
  rep: number;       // 1–6
  remaining: number; // seconds left in countdown or rest
}

function useRsaEngine() {
  const [rsaState, setRsaState] = useState<RsaState>({ phase: 'idle', rep: 1, remaining: 5 });
  const [sprintTimes, setSprintTimes] = useState<number[]>([]);
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const endAtRef = useRef(0);
  const sprintStartRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function getAudio(): AudioContext | null {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch (_) { return null; }
  }

  const beep = useCallback((freq: number, duration: number, vol = 0.5) => {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.05);
    } catch (_) {}
  }, []);

  // Countdown / rest interval — uses Date.now() for accuracy
  useEffect(() => {
    const { phase, rep } = rsaState;
    if (phase !== 'countdown' && phase !== 'rest') return;
    let done = false;
    let lastSecs = -1;

    const id = setInterval(() => {
      if (done) return;
      const secs = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      if (secs === lastSecs) return;
      lastSecs = secs;

      if (secs > 0) {
        setRsaState(prev => ({ ...prev, remaining: secs }));
        if (phase === 'countdown') beep(440, 0.12);
        if (phase === 'rest' && secs <= 3) beep(600, 0.08, 0.35);
      } else {
        done = true;
        if (phase === 'countdown') {
          beep(880, 0.38, 0.85); // GO!
          sprintStartRef.current = Date.now();
          setStopwatchMs(0);
          setRsaState({ phase: 'active', rep, remaining: 0 });
        } else {
          const nextRep = rep + 1;
          endAtRef.current = Date.now() + 5000;
          beep(440, 0.12);
          setRsaState({ phase: 'countdown', rep: nextRep, remaining: 5 });
        }
      }
    }, 100);

    return () => { done = true; clearInterval(id); };
  }, [rsaState.phase, rsaState.rep, beep]);

  // Stopwatch — ticks every 50ms during active sprint
  useEffect(() => {
    if (rsaState.phase !== 'active') return;
    const id = setInterval(() => {
      setStopwatchMs(Date.now() - sprintStartRef.current);
    }, 50);
    return () => clearInterval(id);
  }, [rsaState.phase, rsaState.rep]);

  const startRsa = useCallback(() => {
    getAudio(); // must init on user gesture
    endAtRef.current = Date.now() + 5000;
    setRsaState({ phase: 'countdown', rep: 1, remaining: 5 });
  }, []);

  const sprintDone = useCallback((rep: number, manualTime?: number) => {
    const elapsed = manualTime ?? (Date.now() - sprintStartRef.current) / 1000;
    setSprintTimes(prev => {
      const next = [...prev];
      next[rep - 1] = Math.round(elapsed * 100) / 100;
      return next;
    });
    if (rep >= 6) {
      beep(880, 0.5, 0.8); // final beep
      setRsaState({ phase: 'done', rep, remaining: 0 });
    } else {
      endAtRef.current = Date.now() + 15000;
      setRsaState({ phase: 'rest', rep, remaining: 15 });
    }
  }, [beep]);

  const skipRest = useCallback((rep: number) => {
    endAtRef.current = Date.now() + 5000;
    beep(440, 0.12);
    setRsaState({ phase: 'countdown', rep: rep + 1, remaining: 5 });
  }, [beep]);

  const resetRsa = useCallback(() => {
    setRsaState({ phase: 'idle', rep: 1, remaining: 5 });
    setSprintTimes([]);
    setStopwatchMs(0);
  }, []);

  return { rsaState, sprintTimes, stopwatchMs, startRsa, sprintDone, skipRest, resetRsa };
}

// ── Small UI helpers ───────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade?: 1 | 2 | 3 | 4 }) {
  if (!grade) return <span className="text-xs text-gray-400">Not tested</span>;
  const c = GRADE_COLOURS[grade];
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {GRADE_LABELS[grade]}
    </span>
  );
}

function ProtocolBox({ items }: { items: string[] }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Info size={12} className="text-blue-500" />
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Protocol</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-blue-800 leading-relaxed">
            <span className="flex-shrink-0 font-bold">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Auto-decimal time input (digit-register style) ────────────────────────
// Typing "171" auto-formats to "1.71" — last 2 digits are always centiseconds.
// Used for all inputs with unit === 's'.

function useDigitInput(externalValue: number, onCommit: (v: number) => void) {
  const toDigits = (v: number) => v > 0 ? Math.round(v * 100).toString() : '';
  const [digits, setDigits] = useState(() => toDigits(externalValue));

  useEffect(() => {
    const expected = toDigits(externalValue);
    setDigits(prev => prev === expected ? prev : expected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalValue]);

  const format = (d: string): string => {
    if (!d) return '';
    if (d.length === 1) return `0.0${d}`;
    if (d.length === 2) return `0.${d}`;
    return `${d.slice(0, d.length - 2)}.${d.slice(-2)}`;
  };

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(-5); // digits only, max 5
    setDigits(cleaned);
    onCommit(cleaned ? parseFloat(format(cleaned)) : 0);
  };

  return { display: format(digits) || '', handleChange };
}

function TimeDigitInput({
  value, onChange, autoFocus, placeholder = '0.00',
}: {
  value: number; onChange: (v: number) => void; autoFocus?: boolean; placeholder?: string;
}) {
  const { display, handleChange } = useDigitInput(value, onChange);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={e => handleChange(e.target.value)}
      className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
      style={{ fontSize: '16px' }}
    />
  );
}


function NormTable({ rows }: { rows: { label: string; m: string; f: string; col: string }[] }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 mt-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">Performance norms:</p>
      <div className="flex flex-col gap-1">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${row.col}`}>{row.label}</span>
            <span className="text-gray-500">♂ {row.m} · ♀ {row.f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Multi-attempt input ────────────────────────────────────────────────────

function AttemptInputs({
  attempts, onChange, unit, placeholder, maxAttempts = 3, lowerIsBetter,
}: {
  attempts: number[];
  onChange: (attempts: number[]) => void;
  unit: string;
  placeholder: string;
  maxAttempts?: number;
  lowerIsBetter: boolean;
}) {
  const isTime = unit === 's';
  const vals = Array.from({ length: maxAttempts }, (_, i) => attempts[i] ?? 0);
  const validVals = vals.filter(v => v > 0);
  const best = validVals.length
    ? (lowerIsBetter ? Math.min(...validVals) : Math.max(...validVals))
    : null;

  const commitVal = (i: number, parsed: number) => {
    const next = [...vals];
    next[i] = parsed;
    onChange(next.filter(v => v > 0));
  };

  const handleTextChange = (i: number, raw: string) => {
    commitVal(i, parseFloat(raw) || 0);
  };

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: maxAttempts }, (_, i) => {
        const val = vals[i];
        const isBest = best !== null && val === best && val > 0;
        return (
          <div key={i}>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Attempt {i + 1}{isBest && <span className="ml-1 text-yellow-600">🏆 Best</span>}
            </label>
            <div className="flex items-center gap-2">
              {isTime ? (
                <TimeDigitInput
                  value={val}
                  onChange={v => commitVal(i, v)}
                  placeholder={placeholder}
                />
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={val > 0 ? val : ''}
                  onChange={e => handleTextChange(i, e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
                  style={{ fontSize: '16px' }}
                />
              )}
              <span className="text-sm font-semibold text-gray-500 w-8">{unit}</span>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 text-center">
        Perform up to {maxAttempts} attempts — best result is used
      </p>
    </div>
  );
}

// ── Exit Modal ─────────────────────────────────────────────────────────────

function ExitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">Exit testing?</h3>
        </div>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">
          Your progress will be lost. Incomplete tests are not saved.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Keep testing
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: Selection ──────────────────────────────────────────────────────

const ALL_TESTS: TestType[] = ['10m', '30m', 'cmj', 'broad_jump', 'rsa', 'yoyo'];

const TEST_ICONS: Record<TestType, string> = {
  '10m': '⚡', '30m': '💨', cmj: '↑', broad_jump: '→', rsa: '🔄', yoyo: '🫀',
};

const TEST_DESC: Record<TestType, string> = {
  '10m': 'Acceleration (standing start)',
  '30m': 'Max velocity + glycolytic power',
  cmj: 'Explosive vertical power',
  broad_jump: 'Horizontal explosive power',
  rsa: '6 × 20m with 15s rest — fatigue index',
  yoyo: 'Aerobic capacity (IR1)',
};

function SelectionScreen({
  selected, onToggle, onSelectAll, onContinue,
}: {
  selected: TestType[];
  onToggle: (t: TestType) => void;
  onSelectAll: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col py-8 pt-12">
      <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 shadow-md">
        <Activity size={26} className="text-white" />
      </div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Fitness Testing</h1>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Sport-science validated assessment of your energy systems, sprint capacity, and explosive power.
      </p>

      {/* Full battery CTA */}
      <button
        onClick={onSelectAll}
        className={`w-full py-4 rounded-2xl border-2 font-bold text-sm mb-4 transition-all ${
          selected.length === ALL_TESTS.length
            ? 'border-brand-500 bg-brand-50 text-brand-600'
            : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'
        }`}
      >
        {selected.length === ALL_TESTS.length ? '✓ Full Battery Selected' : 'Select Full Battery (Recommended)'}
      </button>

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Or select individual tests:
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {ALL_TESTS.map(type => {
          const on = selected.includes(type);
          return (
            <button
              key={type}
              onClick={() => onToggle(type)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                on
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="text-xl w-7 text-center">{TEST_ICONS[type]}</span>
              <div className="flex-1">
                <div className={`text-sm font-semibold ${on ? 'text-brand-700' : 'text-gray-800'}`}>
                  {TEST_LABELS[type]}
                </div>
                <div className="text-xs text-gray-400">{TEST_DESC[type]}</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                on ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
              }`}>
                {on && <Check size={11} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-amber-700 mb-1.5">What you'll need</p>
        <ul className="text-xs text-amber-800 flex flex-col gap-1 leading-relaxed">
          <li>• Flat space: 30m straight (pitch, track, or park)</li>
          <li>• Cones at 0m, 10m, 20m, 30m</li>
          <li>• Stopwatch or phone timer</li>
          <li>• Wall + tape measure (or jump app) for CMJ</li>
          <li>• Allow ~20–30 minutes total</li>
        </ul>
      </div>

      <button
        onClick={onContinue}
        disabled={selected.length === 0}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base shadow-md transition-all ${
          selected.length > 0
            ? 'bg-brand-500 text-white hover:bg-brand-600'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Zap size={18} />
        {selected.length === 0 ? 'Select at least one test' : `Start ${selected.length} Test${selected.length > 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// ── SCREEN: Sex ────────────────────────────────────────────────────────────

function SexScreen({ sex, onChange }: { sex: 'male' | 'female'; onChange: (s: 'male' | 'female') => void }) {
  return (
    <div className="flex-1 flex flex-col py-12 pt-16">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Biological sex</h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Used only to compare your scores against the correct norm table.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-5">
        {(['male', 'female'] as const).map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`flex flex-col items-center py-8 rounded-2xl border-2 font-bold text-base capitalize transition-all ${
              sex === s
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
            }`}
          >
            <span className="text-3xl mb-2">{s === 'male' ? '♂' : '♀'}</span>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {sex === s && (
              <div className="mt-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                <Check size={11} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          Norm tables for sprinting and jumping differ significantly between male and female footballers
          (Haugen et al., 2012; Cometti et al., 2001).
        </p>
      </div>
    </div>
  );
}

// ── SCREEN: Sprint (10m / 30m) ─────────────────────────────────────────────

function SprintScreen({
  type, draft, onChangeDraft, onSkip,
}: {
  type: '10m' | '30m';
  draft: TestDraft;
  onChangeDraft: (d: TestDraft) => void;
  onSkip: () => void;
}) {
  const proto = type === '10m' ? TEST_PROTOCOLS.sprint10m : TEST_PROTOCOLS.sprint30m;
  const norms = type === '10m' ? [
    { label: 'Excellent', m: '< 1.65s', f: '< 1.75s', col: 'text-green-600' },
    { label: 'Good',      m: '< 1.75s', f: '< 1.85s', col: 'text-blue-600'  },
    { label: 'Average',   m: '< 1.85s', f: '< 1.95s', col: 'text-yellow-600'},
    { label: 'Below avg', m: '≥ 1.85s', f: '≥ 1.95s', col: 'text-red-500'  },
  ] : [
    { label: 'Excellent', m: '< 3.90s', f: '< 4.30s', col: 'text-green-600' },
    { label: 'Good',      m: '< 4.10s', f: '< 4.50s', col: 'text-blue-600'  },
    { label: 'Average',   m: '< 4.30s', f: '< 4.70s', col: 'text-yellow-600'},
    { label: 'Below avg', m: '≥ 4.30s', f: '≥ 4.70s', col: 'text-red-500'  },
  ];

  const updateAttempts = (attempts: number[]) => onChangeDraft({ ...draft, attempts, skipped: false });

  return (
    <div className="flex-1 flex flex-col py-8 pt-14">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={18} className="text-brand-500" />
        <h2 className="text-2xl font-bold text-gray-900">{TEST_LABELS[type]}</h2>
      </div>
      <p className="text-xs text-gray-500 mb-1">{proto.whatItMeasures}</p>
      <p className="text-xs text-gray-400 italic mb-5">{proto.reference}</p>

      {draft.skipped ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <SkipForward size={22} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Test skipped</p>
          <button
            onClick={() => onChangeDraft({ ...draft, skipped: false })}
            className="text-xs text-brand-500 font-semibold"
          >
            Undo — enter result
          </button>
        </div>
      ) : (
        <>
          <ProtocolBox items={proto.protocol} />
          <div className="mb-3">
            <AttemptInputs
              attempts={draft.attempts}
              onChange={updateAttempts}
              unit="s"
              placeholder={type === '10m' ? '1.80' : '4.20'}
              maxAttempts={3}
              lowerIsBetter
            />
          </div>
          <NormTable rows={norms} />
          <button
            onClick={onSkip}
            className="w-full mt-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5"
          >
            <SkipForward size={14} />
            Skip this test
          </button>
        </>
      )}
    </div>
  );
}

// ── SCREEN: Jump (CMJ / Broad Jump) ───────────────────────────────────────

function JumpScreen({
  type, draft, onChangeDraft, onSkip,
}: {
  type: 'cmj' | 'broad_jump';
  draft: TestDraft;
  onChangeDraft: (d: TestDraft) => void;
  onSkip: () => void;
}) {
  const proto = type === 'cmj' ? TEST_PROTOCOLS.cmj : TEST_PROTOCOLS.broad_jump;
  const norms = type === 'cmj' ? [
    { label: 'Excellent', m: '> 45cm', f: '> 35cm', col: 'text-green-600' },
    { label: 'Good',      m: '> 35cm', f: '> 27cm', col: 'text-blue-600'  },
    { label: 'Average',   m: '> 25cm', f: '> 20cm', col: 'text-yellow-600'},
    { label: 'Below avg', m: '< 25cm', f: '< 20cm', col: 'text-red-500'  },
  ] : [
    { label: 'Excellent', m: '> 250cm', f: '> 210cm', col: 'text-green-600' },
    { label: 'Good',      m: '> 220cm', f: '> 185cm', col: 'text-blue-600'  },
    { label: 'Average',   m: '> 190cm', f: '> 160cm', col: 'text-yellow-600'},
    { label: 'Below avg', m: '< 190cm', f: '< 160cm', col: 'text-red-500'  },
  ];

  return (
    <div className="flex-1 flex flex-col py-8 pt-14">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={18} className="text-brand-500" />
        <h2 className="text-2xl font-bold text-gray-900">{TEST_LABELS[type]}</h2>
      </div>
      <p className="text-xs text-gray-500 mb-1">{proto.whatItMeasures}</p>
      <p className="text-xs text-gray-400 italic mb-5">{proto.reference}</p>

      {draft.skipped ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <SkipForward size={22} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Test skipped</p>
          <button
            onClick={() => onChangeDraft({ ...draft, skipped: false })}
            className="text-xs text-brand-500 font-semibold"
          >
            Undo — enter result
          </button>
        </div>
      ) : (
        <>
          <ProtocolBox items={proto.protocol} />
          <div className="mb-3">
            <AttemptInputs
              attempts={draft.attempts}
              onChange={a => onChangeDraft({ ...draft, attempts: a, skipped: false })}
              unit="cm"
              placeholder={type === 'cmj' ? '35' : '220'}
              maxAttempts={3}
              lowerIsBetter={false}
            />
          </div>
          <NormTable rows={norms} />
          <button
            onClick={onSkip}
            className="w-full mt-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5"
          >
            <SkipForward size={14} />
            Skip this test
          </button>
        </>
      )}
    </div>
  );
}

// ── SCREEN: RSA ────────────────────────────────────────────────────────────

const RSA_REPS = 6;

function RsaScreen({
  rsaState, sprintTimes, stopwatchMs, startRsa, sprintDone, skipRest, resetRsa, draft, onChangeDraft, onSkip,
}: {
  rsaState: RsaState;
  sprintTimes: number[];
  stopwatchMs: number;
  startRsa: () => void;
  sprintDone: (rep: number, manualTime?: number) => void;
  skipRest: (rep: number) => void;
  resetRsa: () => void;
  draft: TestDraft;
  onChangeDraft: (d: TestDraft) => void;
  onSkip: () => void;
}) {
  const { phase, rep, remaining } = rsaState;
  const [usingGates, setUsingGates] = useState(false);
  const [gateTime, setGateTime] = useState(0);

  // Auto-sync sprint times → draft when all done
  useEffect(() => {
    if (phase !== 'done') return;
    const valid = sprintTimes.filter(t => t > 0);
    if (valid.length === 0) return;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    onChangeDraft({
      ...draft,
      rsaAllSprints: sprintTimes,
      rsaCompleted: true,
      attempts: [mean],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (draft.skipped) {
    return (
      <div className="flex-1 flex flex-col py-8 pt-14">
        <div className="flex items-center gap-2 mb-5">
          <Wind size={18} className="text-brand-500" />
          <h2 className="text-2xl font-bold text-gray-900">Repeated Sprint Ability</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <SkipForward size={22} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Test skipped</p>
          <button
            onClick={() => { onChangeDraft({ ...draft, skipped: false }); resetRsa(); }}
            className="text-xs text-brand-500 font-semibold"
          >
            Undo — run RSA test
          </button>
        </div>
      </div>
    );
  }

  // Sprint dots progress
  const Dots = () => (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: RSA_REPS }, (_, i) => {
        const repNum = i + 1;
        const done = phase === 'done' || repNum < rep || (repNum === rep && phase === 'rest');
        const current = repNum === rep && (phase === 'countdown' || phase === 'active');
        return (
          <div
            key={i}
            className={`flex-1 h-2.5 rounded-full transition-all duration-300 ${
              done ? 'bg-brand-500' : current ? 'bg-brand-300 animate-pulse' : 'bg-gray-200'
            }`}
          />
        );
      })}
    </div>
  );

  // Format stopwatch as S.ss
  const swSecs = Math.floor(stopwatchMs / 1000);
  const swCents = Math.floor((stopwatchMs % 1000) / 10);
  const stopwatchDisplay = `${swSecs}.${String(swCents).padStart(2, '0')}`;

  return (
    <div className="flex-1 flex flex-col py-8 pt-14">
      <div className="flex items-center gap-2 mb-1">
        <Wind size={18} className="text-brand-500" />
        <h2 className="text-2xl font-bold text-gray-900">Repeated Sprint Ability</h2>
      </div>
      <p className="text-xs text-gray-500 mb-1">6 × 20m · 15s passive rest · Fatigue Index</p>
      <p className="text-xs text-gray-400 italic mb-3">Girard, Mendez-Villanueva & Bishop (2011) Sports Med</p>

      {/* Partner disclaimer */}
      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
        <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-red-700 leading-relaxed">
          Partner required — your partner holds the phone and taps "Sprint Done" the instant you cross the 20m line for accurate timing.
        </p>
      </div>

      <Dots />

      {/* IDLE */}
      {phase === 'idle' && (
        <div>
          <ProtocolBox items={TEST_PROTOCOLS.rsa.protocol} />

          {/* Timing gates toggle */}
          <button
            onClick={() => setUsingGates(g => !g)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 mb-4 transition-all ${
              usingGates
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            <div className="text-left">
              <p className="text-sm font-bold">Use Timing Gates</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {usingGates
                  ? 'Stopwatch hidden — enter gate times manually'
                  : 'Tap to switch from stopwatch to manual entry'}
              </p>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 relative ${
              usingGates ? 'bg-brand-500' : 'bg-gray-300'
            }`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                usingGates ? 'left-5' : 'left-0.5'
              }`} />
            </div>
          </button>

          <button
            onClick={startRsa}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 shadow-sm mb-3"
          >
            <Play size={18} />
            Start RSA Test
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5"
          >
            <SkipForward size={14} /> Skip this test
          </button>
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === 'countdown' && (
        <div className="flex flex-col items-center py-4">
          <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full mb-6">
            Sprint {rep} of {RSA_REPS}
          </div>
          <div className="relative w-44 h-44 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#f97316" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - remaining / 5)}`}
                className="transition-all duration-900"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-extrabold text-brand-500 leading-none">{remaining}</span>
              <span className="text-xs text-gray-400 mt-1">get ready</span>
            </div>
          </div>
          <p className="text-base font-semibold text-gray-700">
            {remaining > 0 ? 'Get to the start line...' : 'GO!'}
          </p>
        </div>
      )}

      {/* ACTIVE */}
      {phase === 'active' && (
        <div className="flex flex-col items-center py-4">
          <div className="text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full mb-5">
            Sprint {rep} of {RSA_REPS} — RUN!
          </div>

          {usingGates ? (
            /* Gates mode — manual time entry */
            <>
              <div className="w-44 h-44 rounded-full bg-gray-100 border-4 border-brand-200 flex flex-col items-center justify-center mb-6">
                <span className="text-3xl font-extrabold text-brand-500">🏁</span>
                <span className="text-xs text-gray-500 mt-2 font-semibold">Enter gate time</span>
              </div>
              <div className="w-full mb-5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block text-center">
                  Sprint {rep} time (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <TimeDigitInput
                    value={gateTime}
                    onChange={setGateTime}
                    placeholder="3.20"
                  />
                  <span className="text-sm font-semibold text-gray-500 w-4">s</span>
                </div>
              </div>
              <button
                onClick={() => { sprintDone(rep, gateTime > 0 ? gateTime : undefined); setGateTime(0); }}
                disabled={gateTime <= 0}
                className={`w-full py-5 rounded-2xl font-bold text-lg shadow-sm active:scale-95 transition-all ${
                  gateTime > 0
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check size={16} className="inline mr-2" />
                Record Sprint {rep}
              </button>
            </>
          ) : (
            /* Stopwatch mode */
            <>
              <div className="w-44 h-44 rounded-full bg-brand-500 flex flex-col items-center justify-center mb-6 shadow-xl">
                <span className="text-5xl font-extrabold text-white leading-none tabular-nums tracking-tight">
                  {stopwatchDisplay}
                </span>
                <span className="text-xs text-brand-100 mt-1 font-semibold tracking-wider">seconds</span>
              </div>
              <p className="text-sm text-gray-500 mb-6 text-center font-medium">
                Partner: tap the moment they cross 20m
              </p>
              <button
                onClick={() => sprintDone(rep)}
                className="w-full py-5 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 shadow-sm active:scale-95 transition-all"
              >
                <Square size={16} className="inline mr-2" />
                Sprint Done — Record Time
              </button>
            </>
          )}
        </div>
      )}

      {/* REST */}
      {phase === 'rest' && (
        <div className="flex flex-col items-center py-4">
          <div className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full mb-4">
            Sprint {rep} done — Rest
          </div>
          <p className="text-xs text-gray-400 mb-4">Sprint {rep + 1} of {RSA_REPS} next</p>
          <div className="relative w-40 h-40 mb-5">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#22c55e" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - remaining / 15)}`}
                className="transition-all duration-900"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold text-green-500 leading-none">{remaining}</span>
              <span className="text-xs text-gray-400 mt-1">seconds</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">Stand still — passive rest only. Walk back to start line.</p>
          {/* Show times recorded so far */}
          {sprintTimes.filter(t => t > 0).length > 0 && (
            <div className="flex gap-1.5 flex-wrap justify-center mb-3">
              {sprintTimes.slice(0, rep).map((t, i) => (
                <span key={i} className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg">
                  #{i+1} {t.toFixed(2)}s
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => skipRest(rep)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
          >
            <SkipForward size={14} />
            Skip rest
          </button>
        </div>
      )}

      {/* DONE — all 6 sprint times recorded automatically */}
      {phase === 'done' && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">All 6 sprints complete</p>
              <p className="text-xs text-green-700">Times recorded automatically — tap Continue to see your Fatigue Index</p>
            </div>
          </div>

          {/* Sprint times grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {Array.from({ length: RSA_REPS }, (_, i) => {
              const t = sprintTimes[i] ?? 0;
              const valid = sprintTimes.filter(x => x > 0);
              const best = valid.length ? Math.min(...valid) : 0;
              const isBest = t > 0 && t === best;
              return (
                <div key={i} className={`text-center p-3 rounded-xl border ${
                  isBest ? 'border-brand-200 bg-brand-50' : 'border-gray-100 bg-gray-50'
                }`}>
                  <p className="text-xs text-gray-400 mb-0.5">Sprint {i + 1}</p>
                  <p className={`text-base font-extrabold ${isBest ? 'text-brand-600' : 'text-gray-800'}`}>
                    {t > 0 ? `${t.toFixed(2)}s` : '—'}
                  </p>
                  {isBest && <p className="text-xs text-brand-500 font-semibold">Best</p>}
                </div>
              );
            })}
          </div>

          {/* Live FI preview */}
          {(() => {
            const valid = sprintTimes.filter(t => t > 0);
            const fi = valid.length >= 2 ? calcFatigueIndex(valid) : null;
            return fi !== null ? (
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 mb-3">
                <p className="text-xs text-brand-700 font-semibold">
                  Fatigue Index: <span className="text-brand-600 text-sm font-extrabold">{fi.toFixed(1)}%</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Full breakdown in results</p>
              </div>
            ) : null;
          })()}

          <button
            onClick={resetRsa}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 text-center mt-1"
          >
            ↺ Restart RSA test
          </button>
        </div>
      )}
    </div>
  );
}

// ── Yo-Yo IR1 level data ───────────────────────────────────────────────────

interface YoyoLevelDef {
  level: number;    // official level number (5–23)
  speed: number;    // km/h
  shuttles: number; // 2×20m shuttle pairs at this level
}

const YOYO_LEVELS: YoyoLevelDef[] = [
  { level: 5,  speed: 10.0, shuttles: 2 },
  { level: 6,  speed: 11.0, shuttles: 4 },
  { level: 7,  speed: 11.5, shuttles: 4 },
  { level: 8,  speed: 12.0, shuttles: 4 },
  { level: 9,  speed: 12.5, shuttles: 4 },
  { level: 10, speed: 13.0, shuttles: 4 },
  { level: 11, speed: 13.5, shuttles: 4 },
  { level: 12, speed: 14.0, shuttles: 4 },
  { level: 13, speed: 14.5, shuttles: 4 },
  { level: 14, speed: 15.0, shuttles: 4 },
  { level: 15, speed: 15.5, shuttles: 4 },
  { level: 16, speed: 16.0, shuttles: 4 },
  { level: 17, speed: 16.5, shuttles: 4 },
  { level: 18, speed: 17.0, shuttles: 4 },
  { level: 19, speed: 17.5, shuttles: 4 },
  { level: 20, speed: 18.0, shuttles: 4 },
  { level: 21, speed: 18.5, shuttles: 4 },
  { level: 22, speed: 19.0, shuttles: 4 },
  { level: 23, speed: 19.5, shuttles: 4 },
];

const YOYO_RECOVERY_SECS = 10;
const YOYO_COUNTDOWN_SECS = 5;

/** Seconds to run 20m at this level's speed */
function getYoyoLegSecs(def: YoyoLevelDef): number {
  return 20 / (def.speed / 3.6);
}

type YoyoPhase = 'idle' | 'countdown' | 'out' | 'back' | 'recovery' | 'done';

interface YoyoEngineState {
  phase: YoyoPhase;
  levelIdx: number;  // index into YOYO_LEVELS
  shuttle: number;   // 1-based shuttle within current level
  remaining: number; // seconds for display / progress bar
  phaseSecs: number; // total phase duration (for progress bar)
}

// ── Yo-Yo IR1 engine ───────────────────────────────────────────────────────

function useYoyoEngine() {
  const [st, setSt] = useState<YoyoEngineState>({
    phase: 'idle', levelIdx: 0, shuttle: 1, remaining: 0, phaseSecs: 1,
  });
  const completedScoreRef = useRef<number>(0);
  const endAtRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function getAudio(): AudioContext | null {
    try {
      const Ctx = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch { return null; }
  }

  const beep = useCallback((freq: number, dur: number, vol = 0.65) => {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur + 0.05);
    } catch {}
  }, []);

  // Plays a sequence of tones back-to-back using precise AudioContext timing
  const toneSeq = useCallback((notes: Array<{ freq: number; dur: number; vol?: number }>) => {
    const ctx = getAudio();
    if (!ctx) return;
    let t = ctx.currentTime;
    for (const note of notes) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(note.vol ?? 0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);
        osc.start(t);
        osc.stop(t + note.dur + 0.05);
        t += note.dur + 0.08;
      } catch {}
    }
  }, []);

  // Store advance logic in a ref to avoid stale closures inside setInterval
  const advanceRef = useRef<(phase: YoyoPhase, levelIdx: number, shuttle: number) => void>(() => {});
  advanceRef.current = (phase: YoyoPhase, levelIdx: number, shuttle: number) => {
    const level = YOYO_LEVELS[levelIdx];

    // ── countdown → start running ──────────────────────────────────────────
    if (phase === 'countdown') {
      toneSeq([{ freq: 880, dur: 0.15 }, { freq: 1100, dur: 0.28, vol: 0.8 }]);
      if ('vibrate' in navigator) navigator.vibrate(150);
      const legSecs = getYoyoLegSecs(YOYO_LEVELS[0]);
      endAtRef.current = Date.now() + legSecs * 1000;
      setSt({ phase: 'out', levelIdx: 0, shuttle: 1, remaining: Math.ceil(legSecs), phaseSecs: legSecs });
      return;
    }

    // ── out → turn beep → run back ─────────────────────────────────────────
    if (phase === 'out') {
      beep(1320, 0.18, 0.75);
      if ('vibrate' in navigator) navigator.vibrate(80);
      const legSecs = getYoyoLegSecs(level);
      endAtRef.current = Date.now() + legSecs * 1000;
      setSt(prev => ({ ...prev, phase: 'back', remaining: Math.ceil(legSecs), phaseSecs: legSecs }));
      return;
    }

    // ── back → shuttle complete → recovery ────────────────────────────────
    if (phase === 'back') {
      completedScoreRef.current = level.level + shuttle / 10;
      const isLastShuttle = shuttle >= level.shuttles;
      const isLastLevel = levelIdx >= YOYO_LEVELS.length - 1;

      if (isLastLevel && isLastShuttle) {
        toneSeq([{ freq: 880, dur: 0.12 }, { freq: 1100, dur: 0.12 }, { freq: 1320, dur: 0.45, vol: 0.85 }]);
        setSt(prev => ({ ...prev, phase: 'done' }));
        return;
      }

      if (isLastShuttle) {
        // Level-up signal: three ascending beeps
        toneSeq([{ freq: 660, dur: 0.1 }, { freq: 880, dur: 0.1 }, { freq: 1100, dur: 0.28, vol: 0.8 }]);
        if ('vibrate' in navigator) navigator.vibrate([80, 50, 80, 50, 180]);
      } else {
        // Normal end-of-shuttle: double same-pitch beep
        toneSeq([{ freq: 660, dur: 0.12 }, { freq: 660, dur: 0.22 }]);
        if ('vibrate' in navigator) navigator.vibrate([80, 60, 120]);
      }

      endAtRef.current = Date.now() + YOYO_RECOVERY_SECS * 1000;
      setSt(prev => ({
        ...prev, phase: 'recovery',
        remaining: YOYO_RECOVERY_SECS, phaseSecs: YOYO_RECOVERY_SECS,
      }));
      return;
    }

    // ── recovery → go beep → next shuttle ────────────────────────────────
    if (phase === 'recovery') {
      const isLastShuttle = shuttle >= level.shuttles;
      const nextLevelIdx = isLastShuttle ? levelIdx + 1 : levelIdx;
      const nextShuttle  = isLastShuttle ? 1 : shuttle + 1;
      const nextLevel    = YOYO_LEVELS[nextLevelIdx];

      toneSeq([{ freq: 880, dur: 0.15 }, { freq: 1100, dur: 0.28, vol: 0.8 }]);
      if ('vibrate' in navigator) navigator.vibrate(150);
      const legSecs = getYoyoLegSecs(nextLevel);
      endAtRef.current = Date.now() + legSecs * 1000;
      setSt({ phase: 'out', levelIdx: nextLevelIdx, shuttle: nextShuttle, remaining: Math.ceil(legSecs), phaseSecs: legSecs });
      return;
    }
  };

  // Main timer — ticks every 100ms, advances phase when time expires
  useEffect(() => {
    const { phase, levelIdx, shuttle } = st;
    if (phase === 'idle' || phase === 'done') return;

    let active = true;
    let lastSecs = -1;

    const id = setInterval(() => {
      if (!active) return;
      const secs = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));

      if (secs !== lastSecs) {
        lastSecs = secs;
        setSt(prev => ({ ...prev, remaining: secs }));
        // Per-second audio cues
        if (phase === 'countdown' && secs > 0) beep(440, 0.1, 0.35);
        if (phase === 'recovery' && secs <= 3 && secs > 0) {
          beep(600, 0.12, 0.45);
          if ('vibrate' in navigator) navigator.vibrate(60);
        }
      }

      if (secs <= 0) {
        active = false;
        clearInterval(id);
        advanceRef.current(phase, levelIdx, shuttle);
      }
    }, 100);

    return () => { active = false; clearInterval(id); };
  }, [st.phase, st.levelIdx, st.shuttle, beep]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Screen wake lock — keeps display on during the test
  useEffect(() => {
    if (st.phase === 'idle' || st.phase === 'done') return;
    type WL = { release: () => Promise<void> };
    let wl: WL | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<WL> } };
    nav.wakeLock?.request('screen').then(w => { wl = w; }).catch(() => {});
    return () => { wl?.release().catch(() => {}); };
  }, [st.phase]);

  const start = useCallback(() => {
    getAudio(); // AudioContext must be created inside a user gesture
    completedScoreRef.current = 0;
    endAtRef.current = Date.now() + YOYO_COUNTDOWN_SECS * 1000;
    beep(440, 0.1, 0.35);
    setSt({ phase: 'countdown', levelIdx: 0, shuttle: 1, remaining: YOYO_COUNTDOWN_SECS, phaseSecs: YOYO_COUNTDOWN_SECS });
  }, [beep]);

  const fail = useCallback(() => {
    setSt(prev => ({ ...prev, phase: 'done' }));
  }, []);

  const reset = useCallback(() => {
    completedScoreRef.current = 0;
    setSt({ phase: 'idle', levelIdx: 0, shuttle: 1, remaining: 0, phaseSecs: 1 });
  }, []);

  return {
    st,
    completedScoreRef,
    currentLevel: YOYO_LEVELS[st.levelIdx],
    start, fail, reset,
  };
}

// ── SCREEN: Yo-Yo ──────────────────────────────────────────────────────────

function YoyoScreen({
  draft, onChangeDraft, onSkip,
}: {
  draft: TestDraft;
  onChangeDraft: (d: TestDraft) => void;
  onSkip: () => void;
}) {
  const { st, completedScoreRef, currentLevel, start, fail, reset } = useYoyoEngine();

  // Auto-save score when test finishes
  useEffect(() => {
    if (st.phase !== 'done') return;
    const score = completedScoreRef.current;
    if (score > 0) onChangeDraft({ ...draft, attempts: [score], skipped: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase]);

  // Shuttle progress dots for the active view
  const ShuttleDots = ({ barColour }: { barColour: string }) => (
    <div className="flex gap-1.5 mb-1">
      {Array.from({ length: currentLevel.shuttles }, (_, i) => {
        const n = i + 1;
        const done    = st.phase === 'recovery' ? n <= st.shuttle : n < st.shuttle;
        const current = !done && n === st.shuttle;
        return (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full transition-all duration-300 ${
              done    ? barColour :
              current ? barColour + ' opacity-60 animate-pulse' :
              'bg-gray-200'
            }`}
          />
        );
      })}
    </div>
  );

  // ── Skipped state ──────────────────────────────────────────────────────────
  if (draft.skipped) {
    return (
      <div className="flex-1 flex flex-col py-8 pt-14">
        <div className="flex items-center gap-2 mb-5">
          <Activity size={18} className="text-brand-500" />
          <h2 className="text-2xl font-bold text-gray-900">Yo-Yo IR1 Test</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <SkipForward size={28} className="text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">Test skipped</p>
          <button
            onClick={() => onChangeDraft({ ...draft, skipped: false })}
            className="text-xs text-brand-500 font-semibold"
          >
            Undo — run test
          </button>
        </div>
      </div>
    );
  }

  // ── Pre-test / idle ────────────────────────────────────────────────────────
  if (st.phase === 'idle') {
    return (
      <div className="flex-1 flex flex-col py-8 pt-14">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} className="text-brand-500" />
          <h2 className="text-2xl font-bold text-gray-900">Yo-Yo IR1 Test</h2>
        </div>
        <p className="text-xs text-gray-500 mb-1">Best aerobic predictor for football</p>
        <p className="text-xs text-gray-400 italic mb-5">Bangsbo, Iaia & Krustrup (2008) Sports Med</p>

        <ProtocolBox items={TEST_PROTOCOLS.yoyo.protocol} />

        <NormTable rows={[
          { label: 'Excellent', m: '≥ Level 20', f: '≥ Level 17', col: 'text-green-600' },
          { label: 'Good',      m: '≥ Level 17', f: '≥ Level 14', col: 'text-blue-600'  },
          { label: 'Average',   m: '≥ Level 14', f: '≥ Level 11', col: 'text-yellow-600'},
          { label: 'Below avg', m: '< Level 14', f: '< Level 11', col: 'text-red-500'   },
        ]} />

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5 flex gap-2 items-start">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">Keep your screen on during the test — the app plays all beeps for you.</p>
        </div>

        <button
          onClick={start}
          className="w-full py-4 bg-brand-500 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform mb-3"
        >
          <Play size={20} fill="white" />
          Start Test
        </button>

        <button
          onClick={onSkip}
          className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5"
        >
          <SkipForward size={14} />
          Skip this test
        </button>
      </div>
    );
  }

  // ── Test complete ──────────────────────────────────────────────────────────
  if (st.phase === 'done') {
    const score = completedScoreRef.current;
    const lvlNum = Math.floor(score);
    const shuttle = Math.round((score - lvlNum) * 10);
    return (
      <div className="flex-1 flex flex-col py-8 pt-14">
        <div className="flex items-center gap-2 mb-6">
          <Activity size={18} className="text-brand-500" />
          <h2 className="text-2xl font-bold text-gray-900">Yo-Yo IR1 Test</h2>
        </div>

        {score > 0 ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 mb-4 text-center">
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Result</div>
            <div className="text-4xl font-extrabold text-green-700 mb-1">{score.toFixed(1)}</div>
            <div className="text-sm text-green-600">
              Level {lvlNum} · Shuttle {shuttle}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4 text-center">
            <div className="text-sm text-gray-500">No score recorded</div>
          </div>
        )}

        <button
          onClick={reset}
          className="w-full py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 mb-2"
        >
          ↺ Try again
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5"
        >
          <SkipForward size={14} />
          Skip test
        </button>
      </div>
    );
  }

  // ── Active test (countdown / out / back / recovery) ───────────────────────
  const isCountdown = st.phase === 'countdown';
  const isRecovery  = st.phase === 'recovery';
  const isRunning   = st.phase === 'out' || st.phase === 'back';

  const phaseLabel = {
    countdown: String(st.remaining || ''),
    out:       'RUN →',
    back:      '← BACK',
    recovery:  `${st.remaining}s`,
  }[st.phase] ?? '';

  const phaseSub = {
    countdown: 'GET READY',
    out:       'Sprint to the far cone',
    back:      'Sprint back to start',
    recovery:  'RECOVER — walk 5m and back',
  }[st.phase] ?? '';

  const colours = isCountdown
    ? { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-400' }
    : isRecovery
    ? { text: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  bar: 'bg-green-500'  }
    : st.phase === 'out'
    ? { text: 'text-brand-600',  bg: 'bg-brand-50',  border: 'border-brand-200',  bar: 'bg-brand-500'  }
    : { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', bar: 'bg-purple-500' };

  // Progress bar: for recovery = filling (elapsed/total); for run = depleting (remaining/total)
  const barPct = isRecovery
    ? Math.round(((st.phaseSecs - st.remaining) / st.phaseSecs) * 100)
    : Math.round((st.remaining / Math.max(st.phaseSecs, 0.001)) * 100);

  const currentScore = completedScoreRef.current;

  return (
    <div className="flex-1 flex flex-col py-8 pt-14">
      {/* Level & speed header */}
      {!isCountdown && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Level</div>
            <div className="text-2xl font-extrabold text-gray-900">{currentLevel.level}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Speed</div>
            <div className="text-lg font-bold text-gray-700">{currentLevel.speed} km/h</div>
          </div>
        </div>
      )}

      {/* Shuttle dots */}
      {isRunning && <ShuttleDots barColour={colours.bar} />}
      {isRunning && (
        <div className="text-xs text-gray-400 mb-4 text-center">
          Shuttle {st.shuttle} of {currentLevel.shuttles}
        </div>
      )}

      {/* Main phase card */}
      <div className={`rounded-2xl border-2 px-6 py-8 mb-4 flex flex-col items-center ${colours.bg} ${colours.border}`}>
        <div className={`text-5xl font-extrabold mb-2 ${colours.text} ${isCountdown ? 'text-7xl' : ''}`}>
          {phaseLabel}
        </div>
        <div className={`text-sm font-semibold ${colours.text} opacity-80`}>{phaseSub}</div>

        {/* Progress bar */}
        {!isCountdown && (
          <div className="w-full mt-5 h-2.5 rounded-full bg-white bg-opacity-60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${colours.bar}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Score if quit now */}
      {currentScore > 0 && (
        <div className="text-center mb-4">
          <span className="text-xs text-gray-400">Score if you stop now: </span>
          <span className="text-xs font-bold text-gray-600">Level {currentScore.toFixed(1)}</span>
        </div>
      )}

      {/* FAIL button */}
      {!isCountdown && (
        <button
          onClick={fail}
          className="w-full py-4 bg-red-500 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow active:scale-95 transition-transform"
        >
          <Square size={16} fill="white" />
          STOP — I can't keep up
        </button>
      )}
    </div>
  );
}

// ── SCREEN: Results ────────────────────────────────────────────────────────

function ResultsScreen({
  session, previousSession, position, sex, onSave,
}: {
  session: TestSession;
  previousSession?: TestSession | null;
  position: string;
  sex: 'male' | 'female';
  onSave: () => void;
}) {
  const posProfile = POSITION_ENERGY_PROFILE[position] ?? POSITION_ENERGY_PROFILE['CM'];

  const getPrev = (type: TestType) =>
    previousSession?.results.find(r => r.type === type && !r.skipped);

  return (
    <div className="flex-1 flex flex-col py-8">
      <div className="flex items-center gap-2 mb-1">
        <Award size={20} className="text-brand-500" />
        <h2 className="text-2xl font-bold text-gray-900">Your Results</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Benchmarked against football norms for {sex === 'male' ? 'male' : 'female'} players
      </p>

      {/* Energy system scores */}
      {(session.aerobicScore !== undefined || session.anaerobicScore !== undefined) && (
        <Card className="p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Energy System Scores</p>
          {session.anaerobicScore !== undefined && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                <span className="font-semibold">⚡ Anaerobic power</span>
                <span className="font-bold text-orange-500">{session.anaerobicScore}/100</span>
              </div>
              <div className="h-3 rounded-full bg-orange-100 overflow-hidden">
                <div className="h-full rounded-full bg-orange-400 transition-all duration-700"
                  style={{ width: `${session.anaerobicScore}%` }} />
              </div>
            </div>
          )}
          {session.aerobicScore !== undefined && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                <span className="font-semibold">🫀 Aerobic capacity</span>
                <span className="font-bold text-blue-600">{session.aerobicScore}/100</span>
              </div>
              <div className="h-3 rounded-full bg-blue-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all duration-700"
                  style={{ width: `${session.aerobicScore}%` }} />
              </div>
            </div>
          )}
          {/* Position demand */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              {position} demands — Stølen et al. (2005)
            </p>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blue-600 font-medium">Aerobic {posProfile.aerobic}%</span>
              <span className="text-orange-500 font-medium">Anaerobic {posProfile.anaerobic}%</span>
            </div>
            <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
              <div className="h-full rounded-full bg-blue-300" style={{ width: `${posProfile.aerobic}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{posProfile.keyDemand}</p>
          </div>
        </Card>
      )}

      {/* Test breakdown with progression */}
      <Card className="p-5 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Test Breakdown</p>
        <div className="flex flex-col gap-4">
          {session.results
            .filter(r => !r.skipped)
            .map(r => {
              const prev = getPrev(r.type);
              const grade = session.grades[r.type] as 1|2|3|4|undefined;
              const fiGrade = r.type === 'rsa' ? session.grades['rsa_fi'] as 1|2|3|4|undefined : undefined;
              const lowerBetter = TEST_LOWER_IS_BETTER[r.type];
              const unit = TEST_UNIT[r.type];

              // Display value
              const displayVal = r.type === 'rsa' && r.rsaMeanTime
                ? `${r.rsaMeanTime.toFixed(2)}s avg`
                : r.type === 'yoyo'
                ? `Level ${r.best}`
                : `${r.best}${unit}`;

              // Progression
              const progValue = r.type === 'rsa' ? r.rsaMeanTime : r.best;
              const prevValue = r.type === 'rsa' ? prev?.rsaMeanTime : prev?.best;
              const prog = (progValue && prevValue)
                ? getProgression(progValue, prevValue, lowerBetter)
                : null;

              return (
                <div key={r.type}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-700">{TEST_LABELS[r.type]}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{displayVal}</span>
                      <GradeBadge grade={grade} />
                    </div>
                  </div>

                  {/* RSA sub-details */}
                  {r.type === 'rsa' && r.fatigueIndex !== undefined && (
                    <div className="flex items-center justify-between gap-2 mt-1 pl-2">
                      <span className="text-xs text-gray-500">Fatigue Index</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">{r.fatigueIndex.toFixed(1)}%</span>
                        <GradeBadge grade={fiGrade} />
                      </div>
                    </div>
                  )}

                  {/* Progression vs previous */}
                  {prog && (
                    <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${
                      prog.improved ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {prog.improved
                        ? <TrendingUp size={12} />
                        : <TrendingDown size={12} />}
                      {prog.improved ? '+' : ''}
                      {lowerBetter
                        ? `${prog.delta.toFixed(2)}s`
                        : `+${Math.abs(prog.delta).toFixed(1)}${unit}`}
                      {' '}({prog.pct.toFixed(1)}%{prog.improved ? ' improvement' : ' decline'})
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </Card>

      {/* RSA sprint breakdown */}
      {session.results.find(r => r.type === 'rsa' && !r.skipped)?.rsaAllSprints && (
        <Card className="p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">RSA Sprint Times</p>
          <div className="grid grid-cols-3 gap-2">
            {session.results
              .find(r => r.type === 'rsa')!
              .rsaAllSprints!.map((t, i) => {
                const best = Math.min(...session.results.find(r => r.type === 'rsa')!.rsaAllSprints!.filter(x => x > 0));
                return (
                  <div key={i} className={`text-center p-2 rounded-xl border ${
                    t === best && t > 0 ? 'border-brand-200 bg-brand-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                    <p className="text-xs text-gray-400">#{i + 1}</p>
                    <p className={`text-sm font-bold ${t === best && t > 0 ? 'text-brand-600' : 'text-gray-800'}`}>
                      {t > 0 ? `${t.toFixed(2)}s` : '—'}
                    </p>
                    {t === best && t > 0 && <p className="text-xs text-brand-500">Best</p>}
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Science context */}
      <Card className="p-4 mb-5 bg-gray-50 border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-1.5">Why this matters for your game</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Football is ~88–90% aerobic in total energy supply (Stølen et al., 2005), yet every sprint, jump and duel is almost entirely anaerobic. Your Fatigue Index captures how well your aerobic base supports recovery <em>between</em> explosive efforts — because phosphocreatine resynthesis is an aerobic process (Girard et al., 2011). A strong aerobic engine keeps you explosive for the full 90 minutes.
        </p>
      </Card>

      <button
        onClick={onSave}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 shadow-lg mb-8"
      >
        <Check size={18} />
        Save Results & Continue
      </button>
    </div>
  );
}

// ── Main orchestrator ──────────────────────────────────────────────────────

const EMPTY_DRAFT: TestDraft = { attempts: [], skipped: false };

export function TestingBattery({ position, previousSession, onComplete, onSkip }: TestingBatteryProps) {
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('select');
  const [selectedTests, setSelectedTests] = useState<TestType[]>([]);
  const [currentTestIdx, setCurrentTestIdx] = useState(0);
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [testData, setTestData] = useState<Partial<Record<TestType, TestDraft>>>({});
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [computedSession, setComputedSession] = useState<TestSession | null>(null);

  const { rsaState, sprintTimes, stopwatchMs, startRsa, sprintDone, skipRest, resetRsa } = useRsaEngine();

  const currentTest = selectedTests[currentTestIdx] as TestType | undefined;

  // ── Draft helpers ──────────────────────────────────────────────────

  const getDraft = (type: TestType): TestDraft => testData[type] ?? EMPTY_DRAFT;

  const setDraft = useCallback((type: TestType, draft: TestDraft) => {
    setTestData(prev => ({ ...prev, [type]: draft }));
  }, []);

  const skipCurrentTest = useCallback(() => {
    if (!currentTest) return;
    setDraft(currentTest, { attempts: [], skipped: true });
  }, [currentTest, setDraft]);

  // ── Validation ─────────────────────────────────────────────────────

  const canContinue = (): boolean => {
    if (flowPhase === 'sex') return true; // sex always has a value
    if (flowPhase !== 'testing' || !currentTest) return false;
    const draft = getDraft(currentTest);
    if (draft.skipped) return true;
    if (currentTest === 'rsa') {
      return rsaState.phase === 'done';
    }
    return draft.attempts.filter(a => a > 0).length > 0;
  };

  // ── Build final TestSession ────────────────────────────────────────

  const buildSession = (): TestSession => {
    const results: SingleTestResult[] = selectedTests.map(type => {
      const draft = getDraft(type);
      if (draft.skipped) {
        return { type, attempts: [], best: 0, skipped: true };
      }

      if (type === 'rsa') {
        const rawSprints = draft.rsaAllSprints ?? [];
        const valid = rawSprints.filter(t => t > 0);
        const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
        const best = valid.length ? Math.min(...valid) : 0;
        const fi = valid.length >= 2 ? calcFatigueIndex(valid) ?? undefined : undefined;
        return {
          type,
          attempts: valid,
          best,
          skipped: false,
          rsaAllSprints: rawSprints,
          rsaMeanTime: mean || undefined,
          rsaBestTime: best || undefined,
          fatigueIndex: fi,
        };
      }

      const attempts = draft.attempts.filter(a => a > 0);
      const lowerBetter = TEST_LOWER_IS_BETTER[type];
      const best = attempts.length
        ? (lowerBetter ? Math.min(...attempts) : Math.max(...attempts))
        : 0;

      return { type, attempts, best, skipped: false };
    });

    const { grades, aerobicScore, anaerobicScore } = calcTestSession(results, sex);

    return {
      id: `test-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      completedAt: Date.now(),
      sex,
      selectedTests,
      results,
      grades,
      aerobicScore,
      anaerobicScore,
    };
  };

  // ── Navigation ─────────────────────────────────────────────────────

  const handleContinue = () => {
    if (flowPhase === 'select') {
      setFlowPhase('sex');
      return;
    }
    if (flowPhase === 'sex') {
      setCurrentTestIdx(0);
      setFlowPhase('testing');
      return;
    }
    if (flowPhase === 'testing') {
      if (currentTestIdx < selectedTests.length - 1) {
        setCurrentTestIdx(i => i + 1);
      } else {
        const session = buildSession();
        setComputedSession(session);
        setFlowPhase('results');
      }
    }
  };

  const handleBack = () => {
    if (flowPhase === 'sex') { setFlowPhase('select'); return; }
    if (flowPhase === 'testing') {
      // Block back during active RSA cycle
      const inRsaCycle = currentTest === 'rsa' &&
        (rsaState.phase === 'countdown' || rsaState.phase === 'active' || rsaState.phase === 'rest');
      if (inRsaCycle) { setExitModalOpen(true); return; }
      if (currentTestIdx > 0) {
        setCurrentTestIdx(i => i - 1);
      } else {
        setFlowPhase('sex');
      }
    }
  };

  const handleExitConfirm = () => {
    resetRsa();
    onSkip();
  };

  // Toggle test selection
  const toggleTest = (type: TestType) => {
    setSelectedTests(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const selectAll = () => {
    setSelectedTests(prev => prev.length === ALL_TESTS.length ? [] : [...ALL_TESTS]);
  };

  // RSA in active cycle (countdown/active/rest) — hide standard Continue, show exit-only bar
  const isRsaActive = currentTest === 'rsa' && rsaState.phase !== 'idle' && rsaState.phase !== 'done';

  // Progress bar %
  const totalSteps = selectedTests.length + 1; // +1 for sex screen
  const completedSteps = flowPhase === 'sex' ? 0
    : flowPhase === 'testing' ? currentTestIdx + 1
    : totalSteps;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const showBottomNav = flowPhase === 'sex' || (flowPhase === 'testing' && !isRsaActive);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      {flowPhase !== 'select' && flowPhase !== 'results' && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
          <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Top bar — close button */}
      {flowPhase !== 'results' && (
        <div className="fixed top-2 right-4 z-40">
          <button
            onClick={() => {
              if (flowPhase === 'select') { onSkip(); return; }
              setExitModalOpen(true);
            }}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <X size={15} className="text-gray-500" />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-5 pb-24 overflow-y-auto">

        {/* SELECT */}
        {flowPhase === 'select' && (
          <SelectionScreen
            selected={selectedTests}
            onToggle={toggleTest}
            onSelectAll={selectAll}
            onContinue={() => setFlowPhase('sex')}
          />
        )}

        {/* SEX */}
        {flowPhase === 'sex' && (
          <SexScreen sex={sex} onChange={setSex} />
        )}

        {/* TESTING — per test */}
        {flowPhase === 'testing' && currentTest && (
          <>
            {/* Test counter */}
            <div className="pt-14 pb-2">
              <p className="text-xs font-semibold text-gray-400">
                Test {currentTestIdx + 1} of {selectedTests.length}
              </p>
            </div>

            {(currentTest === '10m' || currentTest === '30m') && (
              <SprintScreen
                type={currentTest}
                draft={getDraft(currentTest)}
                onChangeDraft={d => setDraft(currentTest, d)}
                onSkip={skipCurrentTest}
              />
            )}
            {(currentTest === 'cmj' || currentTest === 'broad_jump') && (
              <JumpScreen
                type={currentTest}
                draft={getDraft(currentTest)}
                onChangeDraft={d => setDraft(currentTest, d)}
                onSkip={skipCurrentTest}
              />
            )}
            {currentTest === 'rsa' && (
              <RsaScreen
                rsaState={rsaState}
                sprintTimes={sprintTimes}
                stopwatchMs={stopwatchMs}
                startRsa={startRsa}
                sprintDone={sprintDone}
                skipRest={skipRest}
                resetRsa={resetRsa}
                draft={getDraft('rsa')}
                onChangeDraft={d => setDraft('rsa', d)}
                onSkip={skipCurrentTest}
              />
            )}
            {currentTest === 'yoyo' && (
              <YoyoScreen
                draft={getDraft('yoyo')}
                onChangeDraft={d => setDraft('yoyo', d)}
                onSkip={skipCurrentTest}
              />
            )}
          </>
        )}

        {/* RESULTS */}
        {flowPhase === 'results' && computedSession && (
          <ResultsScreen
            session={computedSession}
            previousSession={previousSession}
            position={position}
            sex={sex}
            onSave={() => onComplete(computedSession)}
          />
        )}
      </div>

      {/* Bottom nav */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 safe-area-pb flex gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!canContinue()}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
              canContinue()
                ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {flowPhase === 'testing' && currentTestIdx === selectedTests.length - 1
              ? 'See Results'
              : 'Continue'}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* RSA in-cycle nav (back = exit modal only) */}
      {flowPhase === 'testing' && isRsaActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 safe-area-pb">
          <button
            onClick={() => setExitModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
            Exit RSA
          </button>
        </div>
      )}

      {/* Exit modal */}
      {exitModalOpen && (
        <ExitModal
          onConfirm={handleExitConfirm}
          onCancel={() => setExitModalOpen(false)}
        />
      )}
    </div>
  );
}
