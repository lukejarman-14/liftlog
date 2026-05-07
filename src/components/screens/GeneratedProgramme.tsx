/**
 * GeneratedProgramme v2 — displays a fully generated personalised football S&C programme.
 * Shows force-velocity profile, method tags, tempo, intensity intent, and coach explanation.
 */

import { useState, useRef } from 'react';
import {
  ChevronLeft, ChevronDown, ChevronUp, ChevronRight,
  Zap, Shield, Clock, TrendingUp, BookOpen, Play, Home, X, GripVertical, AlertTriangle,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import {
  GeneratedProgramme as GPType, ProgrammeSession, SessionBlock, ProgrammeExercise,
} from '../../types';

interface Props {
  programme: GPType;
  isActive: boolean;
  onBack: () => void;
  onRebuild: () => void;
  onApply: () => void;      // set as active + navigate to dashboard
  onDeactivate: () => void; // remove from active (setActiveProgrammeId null)
}

// ── Readiness badge ────────────────────────────────────────────────────────

function ReadinessBadge({ level, score }: { level: string; score: number }) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    elite:    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Elite Readiness' },
    high:     { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300',   label: 'High Readiness' },
    moderate: { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-300',  label: 'Moderate Readiness' },
    low:      { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     label: 'Low Readiness' },
  };
  const s = map[level] ?? map.high;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${s.bg} ${s.text} ${s.border}`}>
      <Zap size={11} />
      {s.label} · {score}/5
    </span>
  );
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
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${METHOD_COLOURS[type] ?? 'bg-gray-100 text-gray-500'}`}>
      {METHOD_LABELS[type] ?? type}
    </span>
  );
}

function IntentTag({ intent }: { intent?: string }) {
  if (!intent) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${INTENT_COLOURS[intent] ?? 'bg-gray-100 text-gray-600'}`}>
      {intent}
    </span>
  );
}

// ── Exercise row ───────────────────────────────────────────────────────────

function ExerciseRow({ exercise }: { exercise: ProgrammeExercise }) {
  const [open, setOpen] = useState(false);
  const { name, sets, reps, rest, intensity, tempo, methodType, intensityIntent, cue } = exercise;
  const isIsometric = methodType === 'isometric';
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

function BlockCard({ block }: { block: SessionBlock }) {
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
          {block.exercises.map((ex, i) => <ExerciseRow key={i} exercise={ex} />)}
        </div>
      )}
    </Card>
  );
}

// ── Session preview modal ──────────────────────────────────────────────────

export function SessionPreviewModal({ session, onClose }: {
  session: ProgrammeSession;
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
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <Zap size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">{session.readinessNote}</p>
          </div>
          {session.blocks.map((block, i) => <BlockCard key={i} block={block} />)}
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
  onPreview: (s: ProgrammeSession) => void;
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
                onClick={() => onPreview(session)}
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

// ── Main component ─────────────────────────────────────────────────────────

export function GeneratedProgramme({ programme, isActive, onBack, onRebuild, onApply, onDeactivate, onSaveReorder }: Props & { onSaveReorder?: (weekIdx: number, newSessions: ProgrammeSession[]) => void }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [previewSession, setPreviewSession] = useState<ProgrammeSession | null>(null);

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
        <ReadinessBadge level={programme.readinessLevel} score={programme.readinessScore} />
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">{programme.summary}</p>
        <div className="mt-3 p-3 bg-gray-50 rounded-xl">
          <div className="flex items-start gap-2">
            <Shield size={14} className="text-brand-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 leading-relaxed">{programme.readinessGuidance}</p>
          </div>
        </div>
      </Card>

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
            onClick={onApply}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-md active:scale-[0.98]"
          >
            <Play size={18} />
            Start Plan
          </button>
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
          onPreview={setPreviewSession}
          onReorderSessions={newSessions => onSaveReorder?.(i, newSessions)}
        />
      ))}

      <div className="h-6" />

      {/* ── Session preview modal ── */}
      {previewSession && (
        <SessionPreviewModal session={previewSession} onClose={() => setPreviewSession(null)} />
      )}
    </Layout>
  );
}
