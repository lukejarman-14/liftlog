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

type RsaPhase = 'idle' | 'countdown' | 'active' | 'rest' | 'entry';

interface RsaState {
  phase: RsaPhase;
  rep: number;       // 1–6
  remaining: number; // seconds left in countdown or rest
}

function useRsaEngine() {
  const [rsaState, setRsaState] = useState<RsaState>({ phase: 'idle', rep: 1, remaining: 5 });
  const endAtRef = useRef(0);
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

  // Single interval — uses Date.now() for accuracy, handles tab switch
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
          setRsaState({ phase: 'active', rep, remaining: 0 });
        } else {
          if (rep >= 6) {
            setRsaState({ phase: 'entry', rep, remaining: 0 });
          } else {
            const nextRep = rep + 1;
            endAtRef.current = Date.now() + 5000;
            beep(440, 0.12);
            setRsaState({ phase: 'countdown', rep: nextRep, remaining: 5 });
          }
        }
      }
    }, 100);

    return () => { done = true; clearInterval(id); };
  }, [rsaState.phase, rsaState.rep, beep]);

  const startRsa = useCallback(() => {
    getAudio(); // must init on user gesture
    endAtRef.current = Date.now() + 5000;
    setRsaState({ phase: 'countdown', rep: 1, remaining: 5 });
  }, []);

  const sprintDone = useCallback((rep: number) => {
    if (rep >= 6) {
      setRsaState({ phase: 'entry', rep, remaining: 0 });
    } else {
      endAtRef.current = Date.now() + 20000;
      setRsaState({ phase: 'rest', rep, remaining: 20 });
    }
  }, []);

  const skipRest = useCallback((rep: number) => {
    endAtRef.current = Date.now() + 5000;
    beep(440, 0.12);
    setRsaState({ phase: 'countdown', rep: rep + 1, remaining: 5 });
  }, [beep]);

  const resetRsa = useCallback(() => {
    setRsaState({ phase: 'idle', rep: 1, remaining: 5 });
  }, []);

  return { rsaState, startRsa, sprintDone, skipRest, resetRsa };
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

function NumInput({
  label, value, onChange, unit, placeholder, autoFocus,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  unit?: string; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0.00'}
          autoFocus={autoFocus}
          className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
        />
        {unit && <span className="text-sm font-semibold text-gray-500 w-8">{unit}</span>}
      </div>
    </div>
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
  const vals = Array.from({ length: maxAttempts }, (_, i) => attempts[i] ?? 0);
  const validVals = vals.filter(v => v > 0);
  const best = validVals.length
    ? (lowerIsBetter ? Math.min(...validVals) : Math.max(...validVals))
    : null;

  const handleChange = (i: number, raw: string) => {
    const parsed = parseFloat(raw) || 0;
    const next = [...vals];
    next[i] = parsed;
    onChange(next.filter(v => v > 0));
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
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={val > 0 ? val : ''}
                onChange={e => handleChange(i, e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
              />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
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
  rsa: '6 × 20m with 20s rest — fatigue index',
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
  rsaState, startRsa, sprintDone, skipRest, resetRsa, draft, onChangeDraft, onSkip,
}: {
  rsaState: RsaState;
  startRsa: () => void;
  sprintDone: (rep: number) => void;
  skipRest: (rep: number) => void;
  resetRsa: () => void;
  draft: TestDraft;
  onChangeDraft: (d: TestDraft) => void;
  onSkip: () => void;
}) {
  const [enteredTimes, setEnteredTimes] = useState<string[]>(
    Array(RSA_REPS).fill(''),
  );

  const { phase, rep, remaining } = rsaState;

  // Sync entered times → draft
  useEffect(() => {
    if (phase !== 'entry' && !draft.rsaCompleted) return;
    const parsed = enteredTimes.map(t => parseFloat(t) || 0);
    const valid = parsed.filter(t => t > 0);
    if (valid.length === 0) return;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    onChangeDraft({
      ...draft,
      rsaAllSprints: parsed,
      rsaCompleted: true,
      attempts: [mean],  // use mean as "best" for progression
    });
    // Suppress — intentionally only sync on enteredTimes change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredTimes]);

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
        const done = phase === 'entry' || repNum < rep || (repNum === rep && phase === 'rest');
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

  return (
    <div className="flex-1 flex flex-col py-8 pt-14">
      <div className="flex items-center gap-2 mb-1">
        <Wind size={18} className="text-brand-500" />
        <h2 className="text-2xl font-bold text-gray-900">Repeated Sprint Ability</h2>
      </div>
      <p className="text-xs text-gray-500 mb-1">6 × 20m · 20s passive rest · Fatigue Index</p>
      <p className="text-xs text-gray-400 italic mb-5">Girard, Mendez-Villanueva & Bishop (2011) Sports Med</p>

      <Dots />

      {/* IDLE */}
      {phase === 'idle' && (
        <div>
          <ProtocolBox items={TEST_PROTOCOLS.rsa.protocol} />
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
            <p className="text-xs text-amber-800 font-semibold mb-1">Before you start</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Have your stopwatch ready. You will complete 6 sprints. Enter times after all reps are done.
            </p>
          </div>
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
          <div className="text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full mb-8">
            Sprint {rep} of {RSA_REPS} — RUN!
          </div>
          <div className="w-28 h-28 rounded-full bg-brand-500 flex items-center justify-center mb-8 shadow-lg">
            <Zap size={48} className="text-white" />
          </div>
          <p className="text-sm text-gray-500 mb-8 text-center">
            Sprint 20m at full effort — tap when you cross the finish line
          </p>
          <button
            onClick={() => sprintDone(rep)}
            className="w-full py-5 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 shadow-sm active:scale-95 transition-all"
          >
            <Square size={16} className="inline mr-2" />
            Sprint Done →
          </button>
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
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - remaining / 20)}`}
                className="transition-all duration-900"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold text-green-500 leading-none">{remaining}</span>
              <span className="text-xs text-gray-400 mt-1">seconds</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-5">Stand still — passive rest only. Note your time now.</p>
          <button
            onClick={() => skipRest(rep)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
          >
            <SkipForward size={14} />
            Skip rest
          </button>
        </div>
      )}

      {/* ENTRY — input all 6 times */}
      {phase === 'entry' && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">All 6 sprints complete</p>
              <p className="text-xs text-green-700">Now enter your times from your stopwatch</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {Array.from({ length: RSA_REPS }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-14">Sprint {i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={enteredTimes[i]}
                  onChange={e => {
                    const next = [...enteredTimes];
                    next[i] = e.target.value;
                    setEnteredTimes(next);
                  }}
                  placeholder="3.10"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-base font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
                />
                <span className="text-xs font-semibold text-gray-400 w-4">s</span>
              </div>
            ))}
          </div>

          {/* Live FI preview */}
          {(() => {
            const valid = enteredTimes.map(t => parseFloat(t) || 0).filter(t => t > 0);
            const fi = valid.length >= 2 ? calcFatigueIndex(valid) : null;
            return fi !== null ? (
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 mb-3">
                <p className="text-xs text-brand-700 font-semibold">
                  Fatigue Index preview: <span className="text-brand-600 text-sm font-extrabold">{fi.toFixed(1)}%</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Full results after saving</p>
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

// ── SCREEN: Yo-Yo ──────────────────────────────────────────────────────────

function YoyoScreen({
  draft, onChangeDraft, onSkip,
}: {
  draft: TestDraft;
  onChangeDraft: (d: TestDraft) => void;
  onSkip: () => void;
}) {
  const [levelStr, setLevelStr] = useState(draft.attempts[0] ? String(draft.attempts[0]) : '');
  const [videoStarted, setVideoStarted] = useState(false);

  const handleLevelChange = (v: string) => {
    setLevelStr(v);
    const parsed = parseFloat(v);
    if (parsed > 0) {
      onChangeDraft({ ...draft, attempts: [parsed], skipped: false });
    } else {
      onChangeDraft({ ...draft, attempts: [], skipped: false });
    }
  };

  return (
    <div className="flex-1 flex flex-col py-8 pt-14">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={18} className="text-brand-500" />
        <h2 className="text-2xl font-bold text-gray-900">Yo-Yo IR1 Test</h2>
      </div>
      <p className="text-xs text-gray-500 mb-1">Best aerobic predictor for football</p>
      <p className="text-xs text-gray-400 italic mb-1">Bangsbo, Iaia & Krustrup (2008) Sports Med</p>
      <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium mb-5 w-max">
        Optional — skip if not done
      </span>

      {draft.skipped ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <SkipForward size={28} className="text-gray-300" />
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
          {/* YouTube embed */}
          {!videoStarted ? (
            <div
              className="w-full rounded-2xl bg-gray-900 flex flex-col items-center justify-center mb-4 overflow-hidden"
              style={{ aspectRatio: '16/9' }}
            >
              <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mb-3 cursor-pointer"
                onClick={() => setVideoStarted(true)}>
                <Play size={24} className="text-white ml-1" />
              </div>
              <p className="text-xs text-gray-400">Tap to play Yo-Yo IR1 test audio</p>
            </div>
          ) : (
            <div className="w-full rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
              <iframe
                src="https://www.youtube.com/embed/LiVb-BRVkTA?autoplay=1"
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; encrypted-media"
                title="Yo-Yo IR1 Test"
              />
            </div>
          )}
          <a
            href="https://www.youtube.com/results?search_query=yo+yo+intermittent+recovery+test+level+1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 text-center block mb-4"
          >
            Find on YouTube if video doesn't load ↗
          </a>

          <ProtocolBox items={TEST_PROTOCOLS.yoyo.protocol} />

          <div className="mb-4">
            <NumInput
              label="Level reached (e.g. 17.5 = Level 17, Shuttle 5)"
              value={levelStr}
              onChange={handleLevelChange}
              placeholder="17.5"
            />
          </div>

          <NormTable rows={[
            { label: 'Excellent', m: '≥ Level 20', f: '≥ Level 17', col: 'text-green-600' },
            { label: 'Good',      m: '≥ Level 17', f: '≥ Level 14', col: 'text-blue-600'  },
            { label: 'Average',   m: '≥ Level 14', f: '≥ Level 11', col: 'text-yellow-600'},
            { label: 'Below avg', m: '< Level 14', f: '< Level 11', col: 'text-red-500'  },
          ]} />

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

  const { rsaState, startRsa, sprintDone, skipRest, resetRsa } = useRsaEngine();

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
      // Need RSA cycling to be complete AND at least 2 times entered
      const sprints = draft.rsaAllSprints ?? [];
      return rsaState.phase === 'entry' && sprints.filter(t => t > 0).length >= 2;
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
  const isRsaActive = currentTest === 'rsa' && rsaState.phase !== 'idle' && rsaState.phase !== 'entry';

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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
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
