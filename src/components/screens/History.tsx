import { useState } from 'react';
import { Trash2, Clock, TrendingUp, ChevronDown, ChevronUp, Activity, Zap, BarChart2, FlaskConical, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { WorkoutSession, NavState, MeasureType, CompletedSet, TestType } from '../../types';
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

// ── Test Progression Charts ────────────────────────────────────────────────

interface TestMeta {
  label: string;
  emoji: string;
  unit: string;
  lowerIsBetter: boolean;
  color: string;
  decimals: number;
}

const TEST_META: Record<TestType, TestMeta> = {
  '10m':        { label: '10m Sprint',   emoji: '⚡', unit: 's',  lowerIsBetter: true,  color: '#f97316', decimals: 2 },
  '30m':        { label: '30m Sprint',   emoji: '💨', unit: 's',  lowerIsBetter: true,  color: '#ef4444', decimals: 2 },
  'cmj':        { label: 'CMJ',          emoji: '↑',  unit: 'cm', lowerIsBetter: false, color: '#3b82f6', decimals: 1 },
  'broad_jump': { label: 'Broad Jump',   emoji: '→',  unit: 'm',  lowerIsBetter: false, color: '#8b5cf6', decimals: 2 },
  'rsa':        { label: 'RSA Best',     emoji: '🔄', unit: 's',  lowerIsBetter: true,  color: '#f59e0b', decimals: 2 },
  'yoyo':       { label: 'Yo-Yo IR1',   emoji: '🫀', unit: '',   lowerIsBetter: false, color: '#10b981', decimals: 1 },
};

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface DataPoint {
  date: string;
  value: number;
  grade?: 1|2|3|4;
}

const GRADE_DOT: Record<1|2|3|4, string> = {
  4: '#16a34a',
  3: '#2563eb',
  2: '#ca8a04',
  1: '#dc2626',
};

function TestChart({ meta, points }: { meta: TestMeta; points: DataPoint[]; type: TestType }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG layout constants
  const W = 300, H = 110;
  const padL = 38, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (points.length === 0) return null;

  const values = points.map(p => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span   = rawMax - rawMin || 1;
  const yMin   = rawMin - span * 0.15;
  const yMax   = rawMax + span * 0.15;

  const toX = (i: number) =>
    points.length === 1
      ? padL + plotW / 2
      : padL + (i / (points.length - 1)) * plotW;

  const toY = (v: number) =>
    padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const polyPoints = points
    .map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`)
    .join(' ');

  // Delta summary
  const first = points[0];
  const last  = points[points.length - 1];
  const delta = last.value - first.value;
  const improved = meta.lowerIsBetter ? delta < 0 : delta > 0;
  const neutral  = delta === 0;
  const absDelta = Math.abs(delta).toFixed(meta.decimals);

  // y-axis labels: just min and max values
  const yLabelTop = yMax.toFixed(meta.decimals);
  const yLabelBot = yMin.toFixed(meta.decimals);

  // x-axis labels: first, middle (if ≥3), last
  const xLabels: { i: number; label: string }[] = [];
  if (points.length >= 1) xLabels.push({ i: 0, label: shortDate(points[0].date) });
  if (points.length >= 3) {
    const mid = Math.floor((points.length - 1) / 2);
    xLabels.push({ i: mid, label: shortDate(points[mid].date) });
  }
  if (points.length >= 2) xLabels.push({ i: points.length - 1, label: shortDate(points[points.length - 1].date) });

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="relative">
      {/* Delta badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-bold text-gray-700">
          Latest: {last.value.toFixed(meta.decimals)}{meta.unit}
        </span>
        {points.length >= 2 && !neutral && (
          <span className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
            improved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {improved ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {meta.lowerIsBetter ? (improved ? '−' : '+') : (improved ? '+' : '−')}{absDelta}{meta.unit}
          </span>
        )}
        {points.length >= 2 && neutral && (
          <span className="flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
            <Minus size={10} /> No change
          </span>
        )}
        {last.grade && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${GRADE_COLOURS[last.grade].bg} ${GRADE_COLOURS[last.grade].text} ${GRADE_COLOURS[last.grade].border}`}>
            {GRADE_LABELS[last.grade]}
          </span>
        )}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 pointer-events-none shadow-lg whitespace-nowrap">
          {shortDate(hovered.date)}: <span className="font-bold">{hovered.value.toFixed(meta.decimals)}{meta.unit}</span>
          {hovered.grade && <span className="ml-1.5 opacity-75">{GRADE_LABELS[hovered.grade]}</span>}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 110 }}
      >
        {/* Grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = padT + plotH * (1 - t);
          return (
            <line key={t} x1={padL} x2={W - padR} y1={y} y2={y}
              stroke="#f0f0f0" strokeWidth="1" />
          );
        })}

        {/* Line */}
        {points.length >= 2 && (
          <polyline
            points={polyPoints}
            fill="none"
            stroke={meta.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        )}

        {/* Area fill under line */}
        {points.length >= 2 && (() => {
          const bottomY = padT + plotH;
          const areaPoints = [
            `${toX(0).toFixed(1)},${bottomY}`,
            ...points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`),
            `${toX(points.length - 1).toFixed(1)},${bottomY}`,
          ].join(' ');
          return (
            <polygon
              points={areaPoints}
              fill={meta.color}
              opacity="0.07"
            />
          );
        })()}

        {/* Data points */}
        {points.map((p, i) => {
          const cx = toX(i);
          const cy = toY(p.value);
          const dotColor = p.grade ? GRADE_DOT[p.grade] : meta.color;
          const isHov = hoveredIdx === i;
          return (
            <g key={i}>
              {/* Hit area */}
              <circle
                cx={cx} cy={cy} r={14}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onTouchStart={() => setHoveredIdx(i)}
                onTouchEnd={() => setTimeout(() => setHoveredIdx(null), 1500)}
                style={{ cursor: 'pointer' }}
              />
              {/* Outer ring on hover */}
              {isHov && <circle cx={cx} cy={cy} r={7} fill={dotColor} opacity="0.2" />}
              {/* Dot */}
              <circle cx={cx} cy={cy} r={isHov ? 5 : 4}
                fill={dotColor}
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {/* Y-axis labels */}
        <text x={padL - 4} y={padT + 4}   textAnchor="end" fontSize="8" fill="#9ca3af">{yLabelTop}</text>
        <text x={padL - 4} y={padT + plotH} textAnchor="end" fontSize="8" fill="#9ca3af">{yLabelBot}</text>

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i}
            x={toX(i)}
            y={H - 4}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            fontSize="8"
            fill="#9ca3af"
          >
            {label}
          </text>
        ))}

        {/* Single-point label */}
        {points.length === 1 && (
          <text x={toX(0)} y={toY(points[0].value) - 10}
            textAnchor="middle" fontSize="9" fill={meta.color} fontWeight="bold">
            {points[0].value.toFixed(meta.decimals)}{meta.unit}
          </text>
        )}
      </svg>
    </div>
  );
}

function TestProgressionTab({ onNavigate }: { onNavigate: (nav: NavState) => void }) {
  const { testSessions } = useStore();

  const sorted = [...testSessions].sort((a, b) => a.completedAt - b.completedAt);

  // Build data points per test type
  const pointsByType: Partial<Record<TestType, DataPoint[]>> = {};
  for (const type of Object.keys(TEST_META) as TestType[]) {
    const pts: DataPoint[] = [];
    for (const session of sorted) {
      const res = session.results.find(r => r.type === type && !r.skipped);
      if (!res) continue;
      pts.push({
        date:  session.date,
        value: res.best,
        grade: session.grades[type] as 1|2|3|4 | undefined,
      });
    }
    if (pts.length > 0) pointsByType[type] = pts;
  }

  const typesWithData = (Object.keys(TEST_META) as TestType[]).filter(t => pointsByType[t]);

  if (typesWithData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <FlaskConical size={36} className="text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-500 mb-1">No test data yet</p>
        <p className="text-xs text-gray-400 mb-5 leading-relaxed">
          Complete a fitness test to start tracking your progression over time.
          Sprint times, jump height, and Yo-Yo level will all appear here.
        </p>
        <button
          onClick={() => onNavigate({ screen: 'testing-battery' })}
          className="px-5 py-2.5 bg-brand-500 text-white text-sm font-bold rounded-xl hover:bg-brand-600 transition-colors"
        >
          Take First Test
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <p className="text-xs text-gray-400 leading-relaxed">
        Every test you complete adds a data point. Tap any dot to see the exact result. Colour = grade.
      </p>

      {typesWithData.map(type => {
        const meta   = TEST_META[type];
        const points = pointsByType[type]!;
        return (
          <Card key={type} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{meta.emoji}</span>
              <h3 className="text-sm font-bold text-gray-800">{meta.label}</h3>
              <span className="ml-auto text-xs text-gray-400">{points.length} test{points.length !== 1 ? 's' : ''}</span>
            </div>
            <TestChart meta={meta} points={points} type={type} />
          </Card>
        );
      })}

      <button
        onClick={() => onNavigate({ screen: 'testing-battery' })}
        className="w-full py-3 border-2 border-brand-200 bg-brand-50 text-brand-700 text-sm font-semibold rounded-2xl hover:bg-brand-100 transition-colors"
      >
        + Add New Test Result
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

interface HistoryProps {
  sessions: WorkoutSession[];
  onNavigate: (nav: NavState) => void;
  onDeleteSession: (id: string) => void;
}

export function History({ sessions, onNavigate, onDeleteSession }: HistoryProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'tests'>('sessions');

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

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-5">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'sessions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'tests'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Test Progress
        </button>
      </div>

      {activeTab === 'tests' ? (
        <TestProgressionTab onNavigate={onNavigate} />
      ) : (
        <>
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
        </>
      )}
    </Layout>
  );
}
