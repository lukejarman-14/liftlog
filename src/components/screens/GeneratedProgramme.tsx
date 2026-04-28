/**
 * GeneratedProgramme — displays a fully generated personalised football S&C programme.
 * Week selector (horizontal scroll) → session cards (expandable blocks).
 */

import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Zap, Shield, Clock, Calendar, TrendingUp } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { GeneratedProgramme as GPType, ProgrammeSession, SessionBlock } from '../../types';

interface Props {
  programme: GPType;
  onBack: () => void;
  onRebuild: () => void;
}

// ── Readiness badge ────────────────────────────────────────────────────────

function ReadinessBadge({ level, score }: { level: 'high' | 'moderate' | 'low'; score: number }) {
  const map = {
    high: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'High Readiness' },
    moderate: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: 'Moderate Readiness' },
    low: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Low Readiness' },
  };
  const s = map[level];
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
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colours[mdDay] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {mdDay}
    </span>
  );
}

// ── Phase colour ───────────────────────────────────────────────────────────

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

// ── Exercise row ───────────────────────────────────────────────────────────

function ExerciseRow({
  name, sets, reps, rest, intensity, cue,
}: {
  name: string; sets: string; reps: string; rest: string; intensity?: string; cue: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full text-left py-3 px-3 flex items-start justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{name}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            <Pill label={`${sets} sets`} colour="bg-brand-100 text-brand-700" />
            <Pill label={reps} colour="bg-gray-100 text-gray-600" />
            {rest && <Pill label={`rest ${rest}`} colour="bg-blue-50 text-blue-600" />}
            {intensity && <Pill label={intensity} colour="bg-orange-100 text-orange-600" />}
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
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, colour }: { label: string; colour: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colour}`}>{label}</span>
  );
}

// ── Block card ─────────────────────────────────────────────────────────────

function BlockCard({ block }: { block: SessionBlock }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="overflow-hidden mb-3">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-bold text-gray-800">{block.title}</span>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs">{block.exercises.length} exercises</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && (
        <div>
          {block.exercises.map((ex, i) => (
            <ExerciseRow key={i} {...ex} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Session card ───────────────────────────────────────────────────────────

function SessionCard({ session }: { session: ProgrammeSession }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="mb-4 overflow-hidden">
      {/* Header */}
      <button
        className="w-full text-left p-4 flex items-start justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <MdBadge mdDay={session.mdDay} />
            <span className="text-sm font-semibold text-gray-700">{session.dayOfWeek}</span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              {session.durationMin} min
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-snug mt-1">{session.objective}</p>
        </div>
        <div className="ml-3 text-gray-400 flex-shrink-0 mt-1">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {/* Readiness note */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <Zap size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">{session.readinessNote}</p>
          </div>

          {/* Blocks */}
          {session.blocks.map((block, i) => (
            <BlockCard key={i} block={block} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function GeneratedProgramme({ programme, onBack, onRebuild }: Props) {
  const [selectedWeek, setSelectedWeek] = useState(0);
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
        <button
          onClick={onRebuild}
          className="text-xs font-semibold text-brand-600 px-2 py-1 rounded-lg bg-brand-50"
        >
          Rebuild
        </button>
      }
    >
      {/* ── Programme header ── */}
      <Card className="p-5 mb-5">
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

      {/* ── Phase timeline ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phases</span>
        </div>
        <PhaseBar weeks={programme.weeks.map(w => w.phase)} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
      </div>

      {/* ── Week selector ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Week</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {programme.weeks.map((w, i) => (
            <button
              key={i}
              onClick={() => setSelectedWeek(i)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border-2 transition-all min-w-[56px] ${
                i === selectedWeek
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className={`text-xs font-bold ${i === selectedWeek ? 'text-brand-600' : 'text-gray-700'}`}>
                Wk {w.weekNumber}
              </span>
              <span className={`text-[10px] font-medium mt-0.5 ${phaseTextColour(w.phase)}`}>
                {w.phase.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Current week detail ── */}
      {week && (
        <div>
          {/* Week header */}
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${phaseColour(week.phase)}`}>
                {week.phase}
              </span>
              <span className="text-sm font-bold text-gray-700">Week {week.weekNumber}</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{week.phaseGoal}</p>
          </Card>

          {/* Sessions */}
          {week.sessions.map((session, i) => (
            <SessionCard key={i} session={session} />
          ))}
        </div>
      )}

      <div className="h-6" />
    </Layout>
  );
}

// ── Phase bar ──────────────────────────────────────────────────────────────

function PhaseBar({
  weeks,
  selectedWeek,
  onSelect,
}: {
  weeks: string[];
  selectedWeek: number;
  onSelect: (i: number) => void;
}) {
  // Group consecutive same-phase weeks
  const segments: { phase: string; start: number; end: number }[] = [];
  weeks.forEach((p, i) => {
    const last = segments[segments.length - 1];
    if (last && last.phase === p) {
      last.end = i;
    } else {
      segments.push({ phase: p, start: i, end: i });
    }
  });

  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-200 h-8">
      {segments.map((seg, si) => {
        const width = ((seg.end - seg.start + 1) / weeks.length) * 100;
        const active = selectedWeek >= seg.start && selectedWeek <= seg.end;
        return (
          <button
            key={si}
            onClick={() => onSelect(seg.start)}
            style={{ width: `${width}%` }}
            className={`flex items-center justify-center text-[10px] font-bold text-white transition-opacity ${phaseColour(seg.phase)} ${active ? 'opacity-100' : 'opacity-50'}`}
          >
            {seg.phase.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}
