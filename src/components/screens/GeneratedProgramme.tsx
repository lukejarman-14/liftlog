/**
 * GeneratedProgramme v2 — displays a fully generated personalised football S&C programme.
 * Shows force-velocity profile, method tags, tempo, intensity intent, and coach explanation.
 */

import { useState } from 'react';
import {
  ChevronLeft, ChevronDown, ChevronUp,
  Zap, Shield, Clock, Calendar, TrendingUp, BookOpen, Play,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import {
  GeneratedProgramme as GPType, ProgrammeSession, SessionBlock, ProgrammeExercise,
  WorkoutExercise, Exercise,
} from '../../types';

// ── Exercise name → library ID mapping ────────────────────────────────────

const NAME_TO_ID: Record<string, string> = {
  'back squat': 'squat',
  'front squat': 'front-squat',
  'romanian deadlift': 'rdl',
  'rdl': 'rdl',
  'trap bar deadlift': 'deadlift',
  'hex bar deadlift': 'deadlift',
  'deadlift': 'deadlift',
  'power clean': 'power-clean',
  'hang power clean': 'hang-power-clean',
  'hang clean': 'hang-clean',
  'hang snatch': 'hang-snatch',
  'bench press': 'bench-press',
  'db bench press': 'db-bench',
  'pull-up': 'pull-up',
  'weighted pull-up': 'pull-up',
  'push press': 'ohp',
  'overhead press': 'ohp',
  'dumbbell shoulder press': 'db-ohp',
  'db shoulder press': 'db-ohp',
  'dumbbell row': 'db-row',
  'db row': 'db-row',
  'goblet squat': 'squat',
  'bulgarian split squat': 'lunge',
  'split squat': 'lunge',
  'reverse lunge': 'lunge',
  'lunge': 'lunge',
  'hip thrust': 'hip-thrust',
  'glute bridge': 'hip-thrust',
  'calf raise': 'calf-raise',
  'plank': 'plank',
  'kettlebell swing': 'kettlebell-swing',
  'jump squat': 'squat',
  'box jump': 'squat',
  'broad jump': 'squat',
  'nordic hamstring curl': 'leg-curl',
  'leg curl': 'leg-curl',
};

function parseRest(rest: string): number {
  if (!rest) return 90;
  const m = rest.match(/(\d+):(\d+)/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const s = rest.match(/(\d+)\s*s/);
  if (s) return parseInt(s[1], 10);
  const min = rest.match(/(\d+)\s*min/);
  if (min) return parseInt(min[1], 10) * 60;
  const plain = rest.match(/^(\d+)$/);
  if (plain) return parseInt(plain[1], 10);
  return 90;
}

function parseReps(reps: string): number {
  const n = parseInt(reps, 10);
  return isNaN(n) ? 8 : Math.min(n, 20);
}

function parseSets(sets: string): number {
  const n = parseInt(sets, 10);
  return isNaN(n) ? 3 : Math.min(n, 6);
}

/** Convert programme session exercises to WorkoutExercise[] using library ID lookup */
function sessionToWorkoutExercises(session: ProgrammeSession, exercises: Exercise[]): WorkoutExercise[] {
  const all: ProgrammeExercise[] = session.blocks
    .filter(b => !b.title.includes('Warm-Up') && !b.title.includes('warm-up'))
    .flatMap(b => b.exercises);

  const result: WorkoutExercise[] = [];
  const used = new Set<string>();

  for (const pe of all) {
    const key = pe.name.toLowerCase().split('(')[0].trim();
    let id: string | undefined;

    // Direct lookup
    id = NAME_TO_ID[key];

    // Partial match fallback
    if (!id) {
      for (const [pattern, mappedId] of Object.entries(NAME_TO_ID)) {
        if (key.includes(pattern) || pattern.includes(key.split(' ')[0])) {
          id = mappedId;
          break;
        }
      }
    }

    // Library scan fallback
    if (!id) {
      const found = exercises.find(e =>
        e.name.toLowerCase().includes(key.split(' ')[0]) ||
        key.includes(e.name.toLowerCase().split(' ')[0]),
      );
      id = found?.id;
    }

    if (id && !used.has(id) && exercises.find(e => e.id === id)) {
      used.add(id);
      result.push({
        exerciseId: id,
        targetSets: parseSets(pe.sets),
        targetReps: parseReps(pe.reps),
        targetWeight: 0,
        restSeconds: parseRest(pe.rest),
      });
    }
  }

  return result.slice(0, 8); // cap at 8 exercises
}

interface Props {
  programme: GPType;
  exercises: Exercise[];
  onBack: () => void;
  onRebuild: () => void;
  onStartSession: (name: string, exercises: WorkoutExercise[]) => void;
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
      {s.label} · {score}/10
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
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button className="w-full text-left py-3 px-3 flex items-start justify-between" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{name}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
            <Pill label={`${sets} × ${reps}`} colour="bg-brand-100 text-brand-700" />
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
  const [open, setOpen] = useState(true);
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

// ── Session card ───────────────────────────────────────────────────────────

function SessionCard({
  session, exercises, onStart,
}: {
  session: ProgrammeSession;
  exercises: Exercise[];
  onStart: (name: string, exs: WorkoutExercise[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mdDisplay = session.mdDay.replace('MD-', 'MD').replace('MD+', 'MD+');

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const workoutExs = sessionToWorkoutExercises(session, exercises);
    onStart(`${mdDisplay} · ${session.dayOfWeek}`, workoutExs);
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <MdBadge mdDay={session.mdDay} />
            <span className="text-sm font-semibold text-gray-700">{session.dayOfWeek}</span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} /> {session.durationMin} min
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug mt-1">{session.objective}</p>
          {session.fvProfile && (
            <p className="text-xs text-indigo-600 font-medium mt-1.5">⚡ {session.fvProfile}</p>
          )}
        </div>
        <div className="ml-3 text-gray-400 flex-shrink-0 mt-1">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Start button — always visible */}
      <div className="px-4 pb-3 -mt-1">
        <button
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors active:scale-[0.98]"
        >
          <Play size={15} />
          Start Session
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {/* Readiness note */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <Zap size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">{session.readinessNote}</p>
          </div>
          {session.blocks.map((block, i) => <BlockCard key={i} block={block} />)}
        </div>
      )}
    </Card>
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
function phaseTextColour(phase: string) {
  switch (phase) {
    case 'Foundation': return 'text-blue-700';
    case 'Build': return 'text-purple-700';
    case 'Strength & Power': return 'text-orange-700';
    case 'Peak': return 'text-red-700';
    default: return 'text-gray-700';
  }
}

// ── Phase bar ──────────────────────────────────────────────────────────────

function PhaseBar({ weeks, selectedWeek, onSelect }: { weeks: string[]; selectedWeek: number; onSelect: (i: number) => void }) {
  const segments: { phase: string; start: number; end: number }[] = [];
  weeks.forEach((p, i) => {
    const last = segments[segments.length - 1];
    if (last && last.phase === p) last.end = i;
    else segments.push({ phase: p, start: i, end: i });
  });
  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-200 h-8">
      {segments.map((seg, si) => {
        const width = ((seg.end - seg.start + 1) / weeks.length) * 100;
        const active = selectedWeek >= seg.start && selectedWeek <= seg.end;
        return (
          <button key={si} onClick={() => onSelect(seg.start)}
            style={{ width: `${width}%` }}
            className={`flex items-center justify-center text-[10px] font-bold text-white transition-opacity ${phaseColour(seg.phase)} ${active ? 'opacity-100' : 'opacity-50'}`}>
            {seg.phase.split(' ')[0]}
          </button>
        );
      })}
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

export function GeneratedProgramme({ programme, exercises, onBack, onRebuild, onStartSession }: Props) {
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const week = programme.weeks[selectedWeek];

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

      {/* ── Phase bar ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phases</span>
        </div>
        <PhaseBar
          weeks={programme.weeks.map(w => w.phase)}
          selectedWeek={selectedWeek}
          onSelect={setSelectedWeek}
        />
      </div>

      {/* ── Week selector ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Week</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {programme.weeks.map((w, i) => (
            <button key={i} onClick={() => setSelectedWeek(i)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border-2 transition-all min-w-[56px] ${
                i === selectedWeek ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <span className={`text-xs font-bold ${i === selectedWeek ? 'text-brand-600' : 'text-gray-700'}`}>Wk {w.weekNumber}</span>
              <span className={`text-[10px] font-medium mt-0.5 ${phaseTextColour(w.phase)}`}>{w.phase.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Week detail ── */}
      {week && (
        <div>
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${phaseColour(week.phase)}`}>
                {week.phase}
              </span>
              <span className="text-sm font-bold text-gray-700">Week {week.weekNumber}</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{week.phaseGoal}</p>
          </Card>

          <MethodLegend />

          {week.sessions.map((session, i) => (
            <SessionCard key={i} session={session} exercises={exercises} onStart={onStartSession} />
          ))}
        </div>
      )}

      <div className="h-6" />
    </Layout>
  );
}
