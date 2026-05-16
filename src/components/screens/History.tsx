import { useState } from 'react';
import { Trash2, Clock, TrendingUp, ChevronDown, ChevronUp, Activity, Zap, BarChart2 } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { WorkoutSession, NavState, MeasureType, CompletedSet } from '../../types';
import { useStore } from '../../hooks/useStore';
import { sessionAvgRpe, RIR_LABELS } from '../../lib/rpeProgression';
import { GRADE_LABELS, GRADE_COLOURS } from '../../data/testingBattery';

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatSetChip(set: CompletedSet, measureType: MeasureType, unit?: string): string {
  const lbl = unit ?? (measureType === 'time' ? 's' : measureType === 'distance' ? 'm' : measureType === 'height' ? 'cm' : measureType === 'score' ? '' : 'kg');
  switch (measureType) {
    case 'reps':     return `${set.reps} reps`;
    case 'strength': return `${set.weight}kg × ${set.reps}`;
    default:         return `${set.weight}${lbl ? ' ' + lbl : ''}`;
  }
}

function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function totalVolume(session: WorkoutSession) {
  return session.exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0);
}

// RIR: lower = harder. 0 = max effort (red), 4 = easy (green)
function getRirColour(rir: number): string {
  if (rir === 0) return 'text-red-600 bg-red-50';
  if (rir === 1) return 'text-orange-600 bg-orange-50';
  if (rir === 2) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}

// ── Session card ───────────────────────────────────────────────────────────

function SessionCard({ session, onDelete, onNavigate }: {
  session: WorkoutSession;
  onDelete: () => void;
  onNavigate: (nav: NavState) => void;
}) {
  const { getExercise } = useStore();
  const [expanded, setExpanded] = useState(false);
  const duration = session.endTime ? formatDuration(session.endTime - session.startTime) : null;
  const vol = totalVolume(session);

  const allSets = session.exercises.flatMap(e => e.sets);
  const avgRpe  = sessionAvgRpe(allSets);

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">{session.name}</div>
            <div className="text-xs text-gray-400">{formatDate(session.date)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete session"
            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors ml-2"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {duration && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={11} />{duration}
            </span>
          )}
          {vol > 0 && (
            <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
              <TrendingUp size={11} />
              {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol}kg
            </span>
          )}
          <span className="text-xs text-gray-400">{session.exercises.length} exercises</span>
          <span className="text-xs text-gray-400">{allSets.length} sets</span>
          {avgRpe !== null && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${getRirColour(Math.round(avgRpe))}`}>
              {avgRpe} RIR avg
            </span>
          )}
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide' : 'Show'} details
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3">
          <div className="flex flex-col gap-3">
            {session.exercises.map(ex => {
              const exercise = getExercise(ex.exerciseId);
              if (!exercise) return null;
              return (
                <div key={ex.exerciseId}>
                  <button
                    onClick={() => onNavigate({ screen: 'exercise-detail', exerciseId: ex.exerciseId })}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 mb-1"
                  >
                    {exercise.name}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.sets.map((set, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {formatSetChip(set, exercise.measureType ?? 'strength', exercise.unit)}
                        {set.rir !== undefined && <span className="text-gray-400 ml-1">@ {set.rir} RIR</span>}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Performance overview card ──────────────────────────────────────────────

function PerformanceOverview({ onNavigate }: { onNavigate: (nav: NavState) => void }) {
  const { baseline } = useStore();

  const results = baseline?.results;
  const test = baseline?.test;

  const chips = [
    { label: '10m Sprint',    value: test?.sprint10m          ? `${test.sprint10m}s`                   : null, grade: results?.sprint10mGrade },
    { label: '30m Sprint',    value: test?.sprint30m          ? `${test.sprint30m}s`                   : null, grade: results?.sprint30mGrade },
    { label: 'CMJ (best)',    value: test?.cmjBest            ? `${test.cmjBest}cm`                    : null, grade: results?.cmjGrade },
    { label: 'Fatigue Index', value: results?.fatigueIndex    ? `${results.fatigueIndex.toFixed(1)}%`  : null, grade: results?.fiGrade },
    { label: 'Yo-Yo IR1',    value: test?.yoyoLevel          ? `Level ${test.yoyoLevel}`              : null, grade: results?.yoyoGrade },
  ] as { label: string; value: string | null; grade?: 1|2|3|4 }[];

  return (
    <Card className="p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-brand-500" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fitness Profile</h3>
        </div>
        <button
          onClick={() => onNavigate({ screen: 'testing-battery' })}
          className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full hover:bg-brand-100"
        >
          {baseline ? 'Re-test' : 'Take Test'}
        </button>
      </div>

      {baseline ? (
        <p className="text-xs text-gray-400 mb-3">
          Last tested {new Date(baseline.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-3">No tests completed yet — tap Take Test to begin.</p>
      )}

      {/* Energy bars — only when scores exist */}
      {(results?.aerobicScore !== undefined || results?.anaerobicScore !== undefined) && (
        <div className="mb-3">
          {results?.aerobicScore !== undefined && (
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 font-medium">🫀 Aerobic</span>
                <span className="font-bold text-blue-600">{results.aerobicScore}/100</span>
              </div>
              <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-400" style={{ width: `${results.aerobicScore}%` }} />
              </div>
            </div>
          )}
          {results?.anaerobicScore !== undefined && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 font-medium">⚡ Anaerobic</span>
                <span className="font-bold text-orange-500">{results.anaerobicScore}/100</span>
              </div>
              <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                <div className="h-full rounded-full bg-orange-400" style={{ width: `${results.anaerobicScore}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metric rows — always shown, Waiting when not yet tested */}
      <div className="flex flex-col gap-2">
        {chips.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 flex-1">{row.label}</span>
            {row.value ? (
              <>
                <span className="text-xs font-bold text-gray-800">{row.value}</span>
                {row.grade && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${GRADE_COLOURS[row.grade].bg} ${GRADE_COLOURS[row.grade].text} ${GRADE_COLOURS[row.grade].border}`}>
                    {GRADE_LABELS[row.grade]}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs font-medium text-gray-400 italic">Waiting</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Week summary ───────────────────────────────────────────────────────────

function WeekSummary({ sessions }: { sessions: WorkoutSession[] }) {
  const now  = new Date();
  const dow  = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  weekStart.setHours(0, 0, 0, 0);

  const prevStart = new Date(weekStart);
  prevStart.setDate(weekStart.getDate() - 7);

  const thisWeek = sessions.filter(s => new Date(s.date) >= weekStart);
  const lastWeek = sessions.filter(s => {
    const d = new Date(s.date);
    return d >= prevStart && d < weekStart;
  });

  const allSets = thisWeek.flatMap(s => s.exercises.flatMap(e => e.sets));
  const avgRpe  = sessionAvgRpe(allSets);

  const thisVol = thisWeek.reduce((a, s) => a + totalVolume(s), 0);
  const lastVol = lastWeek.reduce((a, s) => a + totalVolume(s), 0);
  const volDelta = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;

  const thisSets = allSets.length;
  const lastSets = lastWeek.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0);

  return (
    <Card className="p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} className="text-brand-500" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">This Week</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-brand-500">{thisWeek.length}</div>
          <div className="text-xs text-gray-400">sessions</div>
          {lastWeek.length > 0 && (
            <div className={`text-xs font-medium mt-0.5 ${
              thisWeek.length >= lastWeek.length ? 'text-green-500' : 'text-red-400'
            }`}>
              {thisWeek.length >= lastWeek.length ? '▲' : '▼'} vs {lastWeek.length}
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="text-2xl font-extrabold text-brand-500">{thisSets}</div>
          <div className="text-xs text-gray-400">sets</div>
          {lastSets > 0 && (
            <div className={`text-xs font-medium mt-0.5 ${
              thisSets >= lastSets ? 'text-green-500' : 'text-red-400'
            }`}>
              {thisSets >= lastSets ? '▲' : '▼'} vs {lastSets}
            </div>
          )}
        </div>

        <div className="text-center">
          {avgRpe !== null ? (
            <>
              <div className={`text-2xl font-extrabold ${
                avgRpe >= 3 ? 'text-green-500' : avgRpe >= 2 ? 'text-yellow-500' : avgRpe >= 1 ? 'text-orange-500' : 'text-red-500'
              }`}>{avgRpe}</div>
              <div className="text-xs text-gray-400">avg RIR</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{RIR_LABELS[Math.round(avgRpe)]}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-extrabold text-gray-300">—</div>
              <div className="text-xs text-gray-400">avg RIR</div>
            </>
          )}
        </div>
      </div>

      {volDelta !== null && (
        <div className={`mt-3 pt-3 border-t border-gray-100 text-xs text-center font-medium ${
          volDelta >= 0 ? 'text-green-600' : 'text-red-500'
        }`}>
          Volume: {volDelta >= 0 ? '+' : ''}{volDelta}% vs last week ({thisVol >= 1000 ? `${(thisVol / 1000).toFixed(1)}k` : thisVol}kg vs {lastVol >= 1000 ? `${(lastVol / 1000).toFixed(1)}k` : lastVol}kg)
        </div>
      )}
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

interface HistoryProps {
  sessions: WorkoutSession[];
  onNavigate: (nav: NavState) => void;
  onDeleteSession: (id: string) => void;
}

export function History({ sessions, onNavigate, onDeleteSession }: HistoryProps) {
  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  // Group by month
  const grouped: Record<string, WorkoutSession[]> = {};
  sorted.forEach(s => {
    const key = new Date(s.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  return (
    <Layout title="Performance">

      {/* Performance fitness overview */}
      <PerformanceOverview onNavigate={onNavigate} />

      {/* This week summary */}
      {sessions.length > 0 && <WeekSummary sessions={sessions} />}

      {/* Session log */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-brand-500" />
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session Log</h2>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-8 text-center">
          <Activity size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No workouts logged yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([month, monthSessions]) => (
            <section key={month}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{month}</h3>
              <div className="flex flex-col gap-3">
                {monthSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onDelete={() => onDeleteSession(session.id)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Layout>
  );
}
