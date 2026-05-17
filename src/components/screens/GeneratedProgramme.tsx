/**
 * GeneratedProgramme v2 — displays a fully generated personalised football S&C programme.
 * Shows force-velocity profile, method tags, tempo, intensity intent, and coach explanation.
 */

import { useState, useRef } from 'react';
import {
  ChevronLeft, ChevronDown, ChevronUp, ChevronRight,
  Clock, TrendingUp, BookOpen, Play, Home, X, GripVertical, AlertTriangle,
  Target, Check, Pencil,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import {
  GeneratedProgramme as GPType, ProgrammeSession, SessionBlock, ProgrammeExercise,
  StrengthSetup, LiftBaseline,
} from '../../types';
import {
  LIFT_META, LiftKey,
  findTrackedLiftsInProgramme,
  getLiftKey,
  prescribeWeekLoad,
  epley1RM,
} from '../../lib/progressiveOverload';

interface Props {
  programme: GPType;
  isActive: boolean;
  onBack: () => void;
  onRebuild: () => void;
  onApply: (startDate: string) => void;  // chosen start date (YYYY-MM-DD)
  onDeactivate: () => void;
  onSaveStrengthSetup: (setup: StrengthSetup) => void;
}

// ── MD day badge ───────────────────────────────────────────────────────────

function MdBadge({ mdDay }: { mdDay: string }) {
  const colours: Record<string, string> = {
    'MD+1': 'bg-blue-100 text-blue-700 border-blue-200',
    'MD-1': 'bg-purple-100 text-purple-700 border-purple-200',
    'MD-2': 'bg-orange-100 text-orange-700 border-orange-200',
    'MD-3': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'MD-4': 'bg-brand-100 text-brand-700 border-brand-200',
  };
  // Display without hyphens: MD-4 → MD4, MD+1 → MD+1
  const display = mdDay.replace('MD-', 'MD').replace('MD+', 'MD+');
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colours[mdDay] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {display}
    </span>
  );
}

// ── Method type badge ──────────────────────────────────────────────────────

const METHOD_COLOURS: Record<string, string> = {
  concentric: 'bg-blue-50 text-blue-600',
  eccentric:  'bg-orange-50 text-orange-600',
  isometric:  'bg-purple-50 text-purple-600',
  reactive:   'bg-red-50 text-red-600',
  mixed:      'bg-gray-100 text-gray-600',
};

const METHOD_LABELS: Record<string, string> = {
  concentric: 'CON', eccentric: 'ECC', isometric: 'ISO', reactive: 'REACT', mixed: 'MIXED',
};

const INTENT_COLOURS: Record<string, string> = {
  explosive:   'bg-red-100 text-red-700',
  maximal:     'bg-rose-100 text-rose-700',
  controlled:  'bg-teal-50 text-teal-700',
  moderate:    'bg-gray-100 text-gray-600',
  submaximal:  'bg-yellow-50 text-yellow-700',
  reactive:    'bg-pink-100 text-pink-700',
};

function MethodTag({ type }: { type?: string }) {
  if (!type) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${METHOD_COLOURS[type] ?? 'bg-gray-100 text-gray-500'}`}>
      {METHOD_LABELS[type] ?? type}
    </span>
  );
}

function IntentTag({ intent }: { intent?: string }) {
  if (!intent) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${INTENT_COLOURS[intent] ?? 'bg-gray-100 text-gray-600'}`}>
      {intent}
    </span>
  );
}

// ── Exercise row ───────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  weekNumber,
  totalWeeks,
  strengthSetup,
}: {
  exercise: ProgrammeExercise;
  weekNumber: number;
  totalWeeks: number;
  strengthSetup?: StrengthSetup;
}) {
  const [open, setOpen] = useState(false);
  const { name, sets, reps, rest, intensity, tempo, methodType, intensityIntent, cue } = exercise;
  const isIsometric = methodType === 'isometric';

  // Progressive overload target weight
  const liftKey = getLiftKey(name);
  const liftBaseline = liftKey ? strengthSetup?.lifts.find(l => l.key === liftKey) : null;
  const prescription = liftBaseline
    ? prescribeWeekLoad(liftBaseline.estimated1RM, intensity, weekNumber, totalWeeks)
    : null;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button className="w-full text-left py-3 px-3 flex items-start justify-between" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{name}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
            <Pill
              label={`${sets} × ${reps}`}
              colour={isIsometric ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'}
            />
            {isIsometric && <Pill label="⏸ hold" colour="bg-purple-50 text-purple-600" />}
            {rest && <Pill label={`${rest} rest`} colour="bg-gray-100 text-gray-600" />}
            {intensity && <Pill label={intensity} colour="bg-orange-100 text-orange-600" />}
            {prescription && (
              <Pill label={`🎯 ${prescription.label}`} colour="bg-green-100 text-green-700" />
            )}
            {tempo && <Pill label={`⏱ ${tempo}`} colour="bg-indigo-50 text-indigo-600" />}
          </div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            <MethodTag type={methodType} />
            <IntentTag intent={intensityIntent} />
          </div>
        </div>
        <div className="ml-2 mt-1 text-gray-400 flex-shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 -mt-1">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Coaching Cue</p>
            <p className="text-sm text-gray-700 leading-relaxed">{cue}</p>
            {tempo && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Tempo · {tempo}</p>
                <p className="text-xs text-gray-600">{tempoExplain(tempo)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function tempoExplain(tempo: string): string {
  const parts = tempo.split('-');
  if (parts.length !== 4) return `Tempo notation: ${tempo}`;
  const [ecc, pause, con, rest] = parts;
  const eccStr = ecc === 'x' || ecc === '0' ? 'Explosive down' : `${ecc}s lowering (eccentric)`;
  const pauseStr = pause === '0' ? '' : `, ${pause}s pause at bottom`;
  const conStr = con === 'x' ? 'Explosive concentric (as fast as possible)' : con === '0' ? '' : `${con}s concentric`;
  const restStr = rest === '0' ? '' : `, ${rest}s pause at top`;
  return [eccStr, pauseStr, conStr, restStr].filter(Boolean).join('');
}

function Pill({ label, colour }: { label: string; colour: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colour}`}>{label}</span>;
}

// ── Block card ─────────────────────────────────────────────────────────────

function BlockCard({
  block, weekNumber, totalWeeks, strengthSetup,
}: {
  block: SessionBlock;
  weekNumber: number;
  totalWeeks: number;
  strengthSetup?: StrengthSetup;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden mb-3">
      <button
        className="w-full text-left px-4 py-3 flex items-start justify-between bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-800">{block.title}</span>
          {block.methodFocus && (
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{block.methodFocus}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-400 ml-2 flex-shrink-0">
          <span className="text-xs">{block.exercises.length}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && (
        <div>
          {block.exercises.map((ex, i) => (
            <ExerciseRow
              key={i}
              exercise={ex}
              weekNumber={weekNumber}
              totalWeeks={totalWeeks}
              strengthSetup={strengthSetup}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Session preview modal ──────────────────────────────────────────────────

export function SessionPreviewModal({
  session, weekNumber, totalWeeks, strengthSetup, onClose,
}: {
  session: ProgrammeSession;
  weekNumber: number;
  totalWeeks: number;
  strengthSetup?: StrengthSetup;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end pb-20">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[88vh] flex flex-col z-10">
        {/* sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <MdBadge mdDay={session.mdDay} />
            <span className="text-sm font-bold text-gray-900">{session.dayOfWeek}</span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} /> {session.durationMin} min
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        {/* scrollable body */}
        <div className="overflow-y-auto p-4 pb-8">
          <p className="text-sm font-semibold text-gray-800 mb-2 leading-snug">{session.objective}</p>
          {session.fvProfile && (
            <p className="text-xs text-indigo-600 font-medium mb-3">⚡ {session.fvProfile}</p>
          )}
          {session.blocks.map((block, i) => (
            <BlockCard
              key={i}
              block={block}
              weekNumber={weekNumber}
              totalWeeks={totalWeeks}
              strengthSetup={strengthSetup}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Phase helpers ──────────────────────────────────────────────────────────

function phaseColour(phase: string) {
  switch (phase) {
    case 'Foundation': return 'bg-blue-500';
    case 'Build': return 'bg-purple-500';
    case 'Strength & Power': return 'bg-orange-500';
    case 'Peak': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}
// ── Week accordion ─────────────────────────────────────────────────────────

function WeekAccordion({
  week,
  defaultOpen,
  onPreview,
  onReorderSessions,
}: {
  week: import('../../types').ProgrammeWeek;
  defaultOpen: boolean;
  onPreview: (s: ProgrammeSession, weekNumber: number) => void;
  onReorderSessions: (newSessions: ProgrammeSession[]) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [sessions, setSessions] = useState<ProgrammeSession[]>(week.sessions);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pendingOrder, setPendingOrder] = useState<ProgrammeSession[] | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const handleDragStart = (i: number, el: HTMLDivElement) => {
    setDragIdx(i);
    dragNode.current = el;
    el.style.opacity = '0.4';
  };

  const handleDragEnd = (el: HTMLDivElement) => {
    el.style.opacity = '1';
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...sessions];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, moved);
    setPendingOrder(next);
    setShowWarn(true);
  };

  const confirmReorder = () => {
    if (!pendingOrder) return;
    setSessions(pendingOrder);
    onReorderSessions(pendingOrder);
    setPendingOrder(null);
    setShowWarn(false);
  };

  const cancelReorder = () => {
    setPendingOrder(null);
    setShowWarn(false);
  };

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
          open ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0 ${phaseColour(week.phase)}`}>
            {week.phase.split(' ')[0]}
          </span>
          <span className="text-sm font-bold text-gray-800">Week {week.weekNumber}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">· {sessions.length} sessions</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-1">
          <p className="text-xs text-gray-400 pl-2 pb-0.5">Hold and drag ☰ to reorder sessions</p>
          {sessions.map((session, i) => (
            <div
              key={`${session.mdDay}-${i}`}
              draggable
              onDragStart={e => handleDragStart(i, e.currentTarget as HTMLDivElement)}
              onDragEnd={e => handleDragEnd(e.currentTarget as HTMLDivElement)}
              onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
              onDrop={() => handleDrop(i)}
              className={`flex items-center gap-2 bg-white border rounded-xl transition-all ${
                overIdx === i && dragIdx !== i
                  ? 'border-brand-400 bg-brand-50 scale-[1.01]'
                  : 'border-gray-100'
              }`}
            >
              {/* Drag handle */}
              <div className="pl-2 py-3 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex-shrink-0">
                <GripVertical size={16} />
              </div>
              {/* Session info — tappable */}
              <button
                onClick={() => onPreview(session, week.weekNumber)}
                className="flex-1 text-left flex items-center gap-3 py-3 pr-3 min-w-0"
              >
                <MdBadge mdDay={session.mdDay} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-gray-500">{session.dayOfWeek}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Clock size={10} />{session.durationMin}m
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate leading-snug">{session.objective}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reorder warning modal */}
      {showWarn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base mb-1">Reorder sessions?</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This may affect your progress as the plan has been built around certain game days. Training load and recovery windows are designed for the original order.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={cancelReorder}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmReorder}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">
                Reorder Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Method legend ──────────────────────────────────────────────────────────

function MethodLegend() {
  return (
    <Card className="p-4 mb-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Method legend</p>
      <div className="flex flex-wrap gap-2">
        <MethodTag type="concentric" />
        <MethodTag type="eccentric" />
        <MethodTag type="isometric" />
        <MethodTag type="reactive" />
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <IntentTag intent="explosive" />
        <IntentTag intent="maximal" />
        <IntentTag intent="controlled" />
        <IntentTag intent="submaximal" />
      </div>
      <p className="text-xs text-gray-400 mt-2">⏱ Tempo = eccentric-pause-concentric-pause (seconds). "x" = as fast as possible.</p>
    </Card>
  );
}

// ── Strength Setup Modal ───────────────────────────────────────────────────

function StrengthSetupModal({
  programme,
  onSave,
  onClose,
}: {
  programme: GPType;
  onSave: (setup: StrengthSetup) => void;
  onClose: () => void;
}) {
  const trackedKeys = findTrackedLiftsInProgramme(programme);

  type Draft = { weightStr: string; repsStr: string };
  const initDrafts = () => {
    const d: Record<string, Draft> = {};
    trackedKeys.forEach(k => { d[k] = { weightStr: '', repsStr: '' }; });
    // Pre-fill from existing setup if editing
    if (programme.strengthSetup) {
      for (const l of programme.strengthSetup.lifts) {
        if (d[l.key]) {
          d[l.key] = { weightStr: String(l.workingWeightKg), repsStr: String(l.workingReps) };
        }
      }
    }
    return d;
  };

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initDrafts);
  const [saved, setSaved] = useState(false);

  const setField = (key: string, field: 'weightStr' | 'repsStr', val: string) =>
    setDrafts(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  // At least one lift must be filled to save
  const canSave = trackedKeys.some(k => {
    const d = drafts[k];
    return d && parseFloat(d.weightStr) > 0 && parseInt(d.repsStr) > 0;
  });

  const handleSave = () => {
    const lifts: LiftBaseline[] = [];
    for (const key of trackedKeys) {
      const d = drafts[key];
      const w = parseFloat(d.weightStr);
      const r = parseInt(d.repsStr);
      if (w > 0 && r > 0) {
        lifts.push({
          key,
          exerciseName: LIFT_META[key as LiftKey].askName,
          workingWeightKg: w,
          workingReps: r,
          estimated1RM: Math.round(epley1RM(w, r) * 10) / 10,
        });
      }
    }
    setSaved(true);
    setTimeout(() => { onSave({ lifts, configuredAt: Date.now() }); onClose(); }, 600);
  };

  const inputCls = 'flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-center font-semibold';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-6">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Target size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">Set Strength Targets</h3>
              <p className="text-xs text-gray-500">Enter your best working set for each lift</p>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl px-3 py-2 mt-3">
            <p className="text-xs text-green-700 leading-relaxed">
              <span className="font-bold">How it works:</span> Enter any set you've done recently — e.g. 100 kg × 5. We estimate your 1RM and calculate the exact weight for every session, week by week, with built-in progressive overload.
            </p>
          </div>
        </div>

        {/* Lift inputs */}
        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {trackedKeys.map(key => {
            const meta = LIFT_META[key as LiftKey];
            const d = drafts[key];
            const w = parseFloat(d.weightStr);
            const r = parseInt(d.repsStr);
            const oneRM = w > 0 && r > 0 ? Math.round(epley1RM(w, r)) : null;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">{meta.label}</label>
                  {oneRM && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      ~{oneRM} kg 1RM
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">{meta.hint}</p>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <input
                      value={d.weightStr}
                      onChange={e => setField(key, 'weightStr', e.target.value)}
                      type="number" min="0" max="500" placeholder="kg"
                      style={{ fontSize: '16px' }}
                      className={inputCls}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">kg</span>
                  </div>
                  <span className="text-gray-300 font-bold">×</span>
                  <div className="w-20 relative">
                    <input
                      value={d.repsStr}
                      onChange={e => setField(key, 'repsStr', e.target.value)}
                      type="number" min="1" max="30" placeholder="reps"
                      style={{ fontSize: '16px' }}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {saved && (
            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-sm">
              <Check size={16} /> Targets saved!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-3 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saved}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              canSave && !saved
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save Targets
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function GeneratedProgramme({
  programme, isActive, onBack, onRebuild, onApply, onDeactivate,
  onSaveStrengthSetup, onSaveReorder,
}: Props & {
  onSaveReorder?: (weekIdx: number, newSessions: ProgrammeSession[]) => void;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showStrengthSetup, setShowStrengthSetup] = useState(false);
  const [previewSession, setPreviewSession] = useState<{ session: ProgrammeSession; weekNumber: number } | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth());
  const [chosenStartDate, setChosenStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = localDateStr(new Date());

  const getTomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d); };
  const getFollowingMonday = () => {
    const d = new Date();
    const dow = d.getDay(); // 0=Sun
    const daysUntilMon = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow;
    d.setDate(d.getDate() + daysUntilMon);
    return localDateStr(d);
  };

  const confirmStart = (date: string) => { setShowStartModal(false); setShowCustomPicker(false); onApply(date); };

  const trackedLifts = findTrackedLiftsInProgramme(programme);
  const hasTrackedLifts = trackedLifts.length > 0;

  // Default-open the current week
  const currentWeekIdx = (() => {
    const start = (() => {
      const d = new Date(programme.createdAt);
      const dow = d.getDay();
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const now = new Date();
    const nowMon = (() => { const d = new Date(now); const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); d.setHours(0,0,0,0); return d; })();
    const diff = Math.floor((nowMon.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(0, Math.min(diff, programme.durationWeeks - 1));
  })();

  return (
    <Layout
      title="My Programme"
      leftAction={
        <button onClick={onBack} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft size={24} />
        </button>
      }
      rightAction={
        <button onClick={onRebuild}
          className="text-xs font-semibold text-brand-600 px-2 py-1 rounded-lg bg-brand-50">
          Rebuild
        </button>
      }
    >
      {/* ── Programme header ── */}
      <Card className="p-5 mb-4">
        <h1 className="text-lg font-bold text-gray-900 leading-tight mb-2">{programme.title}</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{programme.summary}</p>
      </Card>

      {/* ── Progressive Overload Banner ── */}
      {hasTrackedLifts && (
        <button
          onClick={() => setShowStrengthSetup(true)}
          className={`w-full mb-4 rounded-2xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98] ${
            programme.strengthSetup
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            programme.strengthSetup ? 'bg-green-100' : 'bg-white/20'
          }`}>
            {programme.strengthSetup
              ? <Check size={20} className="text-green-600" />
              : <Target size={20} className="text-white" />
            }
          </div>
          <div className="flex-1 min-w-0">
            {programme.strengthSetup ? (
              <>
                <p className="text-sm font-bold text-green-800">Weight Targets Active</p>
                <p className="text-xs text-green-600">
                  {programme.strengthSetup.lifts.length} lift{programme.strengthSetup.lifts.length !== 1 ? 's' : ''} configured — open sessions to see your week-by-week targets
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">Set Your Strength Targets</p>
                <p className="text-xs text-white/80">Enter your working weights — we'll calculate exact kg for every session</p>
              </>
            )}
          </div>
          <div className={programme.strengthSetup ? 'text-green-400' : 'text-white/60'}>
            {programme.strengthSetup ? <Pencil size={16} /> : <ChevronRight size={18} />}
          </div>
        </button>
      )}

      {/* ── Plan action buttons ── */}
      {isActive ? (
        <div className="flex gap-3 mb-5">
          <button
            onClick={() => setShowEndModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-base hover:bg-gray-50 transition-colors active:scale-[0.98]"
          >
            End Plan
          </button>
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-md active:scale-[0.98]"
          >
            <Home size={18} />
            Home Screen
          </button>
        </div>
      ) : (
        <div className="flex gap-3 mb-5">
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-base hover:bg-gray-50 transition-colors active:scale-[0.98]"
          >
            <Home size={18} />
            Home Screen
          </button>
          <button
            onClick={() => { setChosenStartDate(todayStr); setShowStartModal(true); }}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-md active:scale-[0.98]"
          >
            <Play size={18} />
            Start Plan
          </button>
        </div>
      )}

      {/* ── Start date picker modal ── */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4 pb-10">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-gray-900">When do you want to start?</h3>
              <button onClick={() => setShowStartModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-5">Week 1 anchors to the Monday of your chosen week.</p>

            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Start today', sub: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), date: todayStr },
                { label: 'Start tomorrow', sub: (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }); })(), date: getTomorrow() },
                { label: 'Following Monday', sub: (() => { const d = new Date(); const dow = d.getDay(); d.setDate(d.getDate() + (dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow)); return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }); })(), date: getFollowingMonday() },
              ].map(({ label, sub, date }) => (
                <button
                  key={date}
                  onClick={() => confirmStart(date)}
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-colors text-left active:scale-[0.98]"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>
              ))}

              <button
                onClick={() => { setPickerYear(new Date().getFullYear()); setPickerMonth(new Date().getMonth()); setShowCustomPicker(true); }}
                className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-colors text-left active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">Custom date</p>
                  <p className="text-xs text-gray-400">Pick any date from the calendar</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom date calendar popup ── */}
      {showCustomPicker && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}
                className="p-2 rounded-xl hover:bg-gray-100"
              ><ChevronLeft size={18} /></button>
              <p className="text-sm font-bold text-gray-900">
                {new Date(pickerYear, pickerMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}
                className="p-2 rounded-xl hover:bg-gray-100"
              ><ChevronRight size={18} /></button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            {(() => {
              const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
              const firstDow = (new Date(pickerYear, pickerMonth, 1).getDay() + 6) % 7; // 0=Mon
              const today = new Date(); today.setHours(0,0,0,0);
              const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
              while (cells.length % 7 !== 0) cells.push(null);
              return (
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const d = new Date(pickerYear, pickerMonth, day);
                    const dateStr = localDateStr(d);
                    const isPast = d < today;
                    const isSelected = dateStr === chosenStartDate;
                    const isTodayCell = dateStr === todayStr;
                    return (
                      <button
                        key={i}
                        disabled={isPast}
                        onClick={() => setChosenStartDate(dateStr)}
                        className={`aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-brand-500 text-white font-bold' :
                          isTodayCell ? 'ring-2 ring-brand-400 text-brand-600 font-bold' :
                          isPast ? 'text-gray-200 cursor-not-allowed' :
                          'text-gray-800 hover:bg-brand-50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCustomPicker(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
              >Back</button>
              <button
                onClick={() => confirmStart(chosenStartDate)}
                disabled={!chosenStartDate || chosenStartDate < todayStr}
                className="flex-1 py-3 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 disabled:opacity-40"
              >Start Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── End Plan modal ── */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4 pb-20">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mb-2">
            <h3 className="text-base font-bold text-gray-900 mb-1">End Current Plan?</h3>
            <p className="text-sm text-gray-500 mb-5">This will remove it from your calendar. What would you like to do next?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { onDeactivate(); setShowEndModal(false); onRebuild(); }}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 transition-colors"
              >
                Build New Programme
              </button>
              <button
                onClick={() => { onDeactivate(); setShowEndModal(false); onBack(); }}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Exit
              </button>
              <button
                onClick={() => setShowEndModal(false)}
                className="w-full py-2 text-gray-400 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coach explanation (collapsible) ── */}
      <Card className="mb-5 overflow-hidden">
        <button
          className="w-full text-left p-4 flex items-center justify-between"
          onClick={() => setShowExplanation(e => !e)}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-500" />
            <span className="text-sm font-bold text-gray-800">Coach's Explanation</span>
          </div>
          {showExplanation ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {programme.coachExplanation.split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed mt-3">{para}</p>
            ))}
          </div>
        )}
      </Card>

      {/* ── All weeks accordion ── */}
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Programme — {programme.durationWeeks} weeks
        </span>
      </div>

      <MethodLegend />

      {programme.weeks.map((week, i) => (
        <WeekAccordion
          key={i}
          week={week}
          defaultOpen={i === currentWeekIdx}
          onPreview={(session, weekNumber) => setPreviewSession({ session, weekNumber })}
          onReorderSessions={newSessions => onSaveReorder?.(i, newSessions)}
        />
      ))}

      <div className="h-6" />

      {/* ── Session preview modal ── */}
      {previewSession && (
        <SessionPreviewModal
          session={previewSession.session}
          weekNumber={previewSession.weekNumber}
          totalWeeks={programme.durationWeeks}
          strengthSetup={programme.strengthSetup}
          onClose={() => setPreviewSession(null)}
        />
      )}

      {/* ── Strength setup modal ── */}
      {showStrengthSetup && (
        <StrengthSetupModal
          programme={programme}
          onSave={onSaveStrengthSetup}
          onClose={() => setShowStrengthSetup(false)}
        />
      )}
    </Layout>
  );
}
