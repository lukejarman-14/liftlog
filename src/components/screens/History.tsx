import { useState } from 'react';

/** How long (ms) a touch-triggered chart tooltip stays visible before auto-hiding. */
const TOOLTIP_HIDE_DELAY_MS = 1_500;
import { Trash2, Clock, TrendingUp, ChevronDown, ChevronUp, Activity, Zap, BarChart2, FlaskConical, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { WorkoutSession, MatchEntry, NavState, MeasureType, CompletedSet, TestType } from '../../types';
import { useStore } from '../../hooks/useStore';
import { sessionAvgRpe, RIR_LABELS } from '../../lib/rpeProgression';
import { GRADE_LABELS, GRADE_COLOURS, calcVo2Max, calcYoyoDistance } from '../../data/testingBattery';


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
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function totalVolume(session: WorkoutSession) {
  return session.exercises.reduce((acc, ex) =>
    acc + ex.sets.filter(set => !set.isPriming).reduce((s, set) => s + set.reps * set.weight, 0), 0);
}

// RIR: lower = harder. 0 = max effort (red), 4 = easy (green)
function getRirColour(rir: number): string {
  if (rir === 0) return 'text-red-600 bg-red-50';
  if (rir === 1) return 'text-orange-600 bg-orange-50';
  if (rir === 2) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}


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



interface NormRow { grade: 1|2|3|4|5; male: string; female: string }

const NORM_ROWS: Record<string, NormRow[]> = {
  '10m': [
    { grade: 5, male: '< 1.60 s',      female: '< 1.70 s'      },
    { grade: 4, male: '1.60 – 1.70 s', female: '1.70 – 1.80 s' },
    { grade: 3, male: '1.71 – 1.80 s', female: '1.81 – 1.90 s' },
    { grade: 2, male: '1.81 – 1.95 s', female: '1.91 – 2.05 s' },
    { grade: 1, male: '> 1.95 s',      female: '> 2.05 s'      },
  ],
  '30m': [
    { grade: 5, male: '< 3.90 s',      female: '< 4.30 s'      },
    { grade: 4, male: '3.90 – 4.10 s', female: '4.30 – 4.50 s' },
    { grade: 3, male: '4.11 – 4.30 s', female: '4.51 – 4.70 s' },
    { grade: 2, male: '4.31 – 4.50 s', female: '4.71 – 4.90 s' },
    { grade: 1, male: '> 4.50 s',      female: '> 4.90 s'      },
  ],
  cmj: [
    { grade: 5, male: '≥ 60 cm',     female: '≥ 48 cm'     },
    { grade: 4, male: '50 – 59 cm',  female: '38 – 47 cm'  },
    { grade: 3, male: '40 – 49 cm',  female: '28 – 37 cm'  },
    { grade: 2, male: '30 – 39 cm',  female: '20 – 27 cm'  },
    { grade: 1, male: '< 30 cm',     female: '< 20 cm'     },
  ],
  broad_jump: [
    { grade: 5, male: '≥ 280 cm',     female: '≥ 240 cm'     },
    { grade: 4, male: '250 – 279 cm', female: '210 – 239 cm' },
    { grade: 3, male: '230 – 249 cm', female: '195 – 209 cm' },
    { grade: 2, male: '200 – 229 cm', female: '165 – 194 cm' },
    { grade: 1, male: '< 200 cm',     female: '< 165 cm'     },
  ],
  fi: [
    { grade: 5, male: '< 3.0 %',      female: '< 3.5 %'      },
    { grade: 4, male: '3.0 – 5.0 %',  female: '3.5 – 5.5 %'  },
    { grade: 3, male: '5.1 – 7.0 %',  female: '5.6 – 7.5 %'  },
    { grade: 2, male: '7.1 – 9.0 %',  female: '7.6 – 9.5 %'  },
    { grade: 1, male: '> 9.0 %',      female: '> 9.5 %'      },
  ],
  yoyo: [
    { grade: 5, male: '> Level 20.2', female: '> Level 17.0' },
    { grade: 4, male: '19.1 – 20.2',  female: '15.5 – 17.0'  },
    { grade: 3, male: '18.1 – 19.0',  female: '13.0 – 15.4'  },
    { grade: 2, male: '16.7 – 18.0',  female: '10.5 – 12.9'  },
    { grade: 1, male: '< Level 16.6', female: '< Level 10.4' },
  ],
};


function NormDetail({
  testKey, athleteGrade, sex, yoyoLevel, weightKg,
}: {
  testKey: string;
  athleteGrade?: 1|2|3|4|5;
  sex: 'male' | 'female';
  yoyoLevel?: number;
  weightKg?: number;
}) {
  const rows = NORM_ROWS[testKey];
  if (!rows) return null;

  // VO₂max block for Yo-Yo
  const vo2 = testKey === 'yoyo' && yoyoLevel ? calcVo2Max(yoyoLevel) : null;
  const distM = testKey === 'yoyo' && yoyoLevel ? calcYoyoDistance(yoyoLevel) : null;
  const vo2Abs = vo2 && weightKg ? Math.round(vo2 * weightKg / 1000 * 10) / 10 : null;

  return (
    <div className="mt-2 mb-1 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
      {/* VO₂max card — Yo-Yo only */}
      {vo2 !== null && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            VO₂max Estimate
          </p>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-extrabold text-brand-600 leading-none">{vo2}</p>
              <p className="text-xs text-gray-400 mt-0.5">ml · kg⁻¹ · min⁻¹</p>
            </div>
            {vo2Abs !== null && (
              <div>
                <p className="text-lg font-bold text-gray-700 leading-none">{vo2Abs} L/min</p>
                <p className="text-xs text-gray-400 mt-0.5">absolute ({weightKg} kg)</p>
              </div>
            )}
            {distM !== null && (
              <div className="ml-auto text-right">
                <p className="text-sm font-bold text-gray-600 leading-none">{distM} m</p>
                <p className="text-xs text-gray-400 mt-0.5">distance covered</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Norm table */}
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Benchmarks · Adult field-sport athletes
        </p>
        <div className="flex flex-col gap-1">
          {rows.map(row => {
            const isAthlete = row.grade === athleteGrade;
            const c = GRADE_COLOURS[row.grade];
            return (
              <div
                key={row.grade}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                  isAthlete
                    ? `${c.bg} border ${c.border} ring-1 ring-offset-0 ring-current`
                    : 'bg-white border border-transparent'
                }`}
              >
                <span className={`text-xs font-bold w-20 shrink-0 ${isAthlete ? c.text : 'text-gray-500'}`}>
                  {GRADE_LABELS[row.grade]}{isAthlete ? ' ← you' : ''}
                </span>
                <span className={`text-xs flex-1 ${isAthlete ? 'text-gray-800 font-semibold' : 'text-gray-500'} ${sex === 'male' && isAthlete ? 'underline decoration-dotted' : ''}`}>
                  ♂ {row.male}
                </span>
                <span className={`text-xs flex-1 ${isAthlete ? 'text-gray-800 font-semibold' : 'text-gray-500'} ${sex === 'female' && isAthlete ? 'underline decoration-dotted' : ''}`}>
                  ♀ {row.female}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function PerformanceOverview({ onNavigate }: { onNavigate: (nav: NavState) => void }) {
  const { baseline, userProfile } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const results = baseline?.results;
  const test    = baseline?.test;
  const sex: 'male' | 'female' = test?.sex ?? (userProfile?.gender === 'female' ? 'female' : 'male');
  const weightKg = userProfile?.weightKg;

  const formatYoyo = (lvl: number) => {
    const l = Math.floor(lvl);
    const s = Math.round((lvl - l) * 10);
    return s > 0 ? `Level ${l} · Sh ${s}` : `Level ${l}`;
  };

  const chips = [
    { label: '10m Sprint',    testKey: '10m',        value: test?.sprint10m        ? `${test.sprint10m}s`                   : null, grade: results?.sprint10mGrade  },
    { label: '30m Sprint',    testKey: '30m',        value: test?.sprint30m        ? `${test.sprint30m}s`                   : null, grade: results?.sprint30mGrade  },
    { label: 'CMJ (best)',    testKey: 'cmj',        value: test?.cmjBest          ? `${test.cmjBest}cm`                    : null, grade: results?.cmjGrade        },
    { label: 'Broad Jump',   testKey: 'broad_jump', value: test?.broadJumpBest    ? `${test.broadJumpBest}cm`              : null, grade: results?.broadJumpGrade  },
    { label: 'Fatigue Index', testKey: 'fi',         value: results?.fatigueIndex  ? `${results.fatigueIndex.toFixed(1)}%`  : null, grade: results?.fiGrade         },
    { label: 'Yo-Yo IR1',    testKey: 'yoyo',       value: test?.yoyoLevel        ? formatYoyo(test.yoyoLevel)             : null, grade: results?.yoyoGrade       },
  ] as { label: string; testKey: string; value: string | null; grade?: 1|2|3|4|5 }[];

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

      {/* Energy system bars */}
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

      {/* Metric rows — tap any row to see norm benchmarks */}
      <div className="flex flex-col gap-1">
        {chips.map(row => {
          const isOpen = expanded === row.testKey;
          const canExpand = !!row.value;
          return (
            <div key={row.testKey}>
              <button
                onClick={() => canExpand && setExpanded(isOpen ? null : row.testKey)}
                disabled={!canExpand}
                className={`w-full flex items-center justify-between gap-2 py-1.5 rounded-lg px-1 transition-colors ${
                  canExpand ? 'hover:bg-gray-50 active:bg-gray-100 cursor-pointer' : 'cursor-default'
                }`}
              >
                <span className="text-xs text-gray-600 flex-1 text-left">{row.label}</span>
                {row.value ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">{row.value}</span>
                    {row.grade && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${GRADE_COLOURS[row.grade].bg} ${GRADE_COLOURS[row.grade].text} ${GRADE_COLOURS[row.grade].border}`}>
                        {GRADE_LABELS[row.grade]}
                      </span>
                    )}
                    {isOpen
                      ? <ChevronUp size={12} className="text-gray-400 shrink-0" />
                      : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
                  </div>
                ) : (
                  <span className="text-xs font-medium text-gray-400 italic">Waiting</span>
                )}
              </button>

              {isOpen && (
                <NormDetail
                  testKey={row.testKey}
                  athleteGrade={row.grade}
                  sex={sex}
                  yoyoLevel={row.testKey === 'yoyo' ? test?.yoyoLevel : undefined}
                  weightKg={weightKg}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}


function WeekSummary({ sessions }: { sessions: WorkoutSession[] }) {
  const now  = new Date();
  const dow  = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  weekStart.setHours(0, 0, 0, 0);

  const prevStart = new Date(weekStart);
  prevStart.setDate(weekStart.getDate() - 7);

  // Parse date strings at local noon to avoid UTC midnight shifting the day for non-UTC users
  const thisWeek = sessions.filter(s => new Date(s.date + 'T12:00:00') >= weekStart);
  const lastWeek = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
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


/**
 * Converts a match entry to a load equivalent in the same arbitrary units as
 * gym volume (kg × reps). Formula: minutes × intensity × 60.
 * A 90-min intensity-5 match ≈ 27,000 AU — comparable to a demanding gym session.
 */
function matchLoadEquiv(entry: MatchEntry): number {
  const mins = entry.minutes ?? 0;
  const intensity = entry.intensity ?? 3;
  return mins * intensity * 60;
}

function LoadTab({ sessions, matchEntries }: { sessions: WorkoutSession[]; matchEntries: MatchEntry[] }) {
  const getMonday = (d: Date): Date => {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  };

  const thisMonday = getMonday(new Date());
  const weeks: { label: string; volume: number; gymVolume: number; matchVolume: number; sessions: number; matches: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const mon = new Date(thisMonday);
    mon.setDate(thisMonday.getDate() - i * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 7);
    const ws = sessions.filter(s => {
      const d = new Date(s.date + 'T12:00:00');
      return d >= mon && d < sun;
    });
    const ms = matchEntries.filter(m => {
      const d = new Date(m.date + 'T12:00:00');
      return d >= mon && d < sun;
    });
    const gymVol = ws.reduce((a, s) => a + totalVolume(s), 0);
    const matchVol = ms.reduce((a, m) => a + matchLoadEquiv(m), 0);
    weeks.push({
      label: mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      volume: gymVol + matchVol,
      gymVolume: gymVol,
      matchVolume: matchVol,
      sessions: ws.length,
      matches: ms.length,
    });
  }

  const hasData = weeks.some(w => w.volume > 0);

  // ACWR calculation — both acute and chronic use the same Monday-anchored calendar weeks
  // so the windows are aligned and the ratio is meaningful mid-week
  const acuteWeek = weeks[weeks.length - 1]?.volume ?? 0;
  const chronic28Weeks = weeks.slice(-4);
  const chronicAvg = chronic28Weeks.reduce((a, w) => a + w.volume, 0) / 4;
  const acute7 = acuteWeek; // rename alias so display labels stay the same
  const acwr = chronicAvg > 0 ? acute7 / chronicAvg : null;
  const acwrZone =
    acwr === null ? null :
    acwr < 0.8  ? { label: 'Undertraining', color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200' } :
    acwr <= 1.3 ? { label: 'Optimal ✅',    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' } :
    acwr <= 1.5 ? { label: 'Caution ⚠️',   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' } :
                  { label: 'High Risk 🔴',  color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200'   };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <BarChart2 size={36} className="text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-500 mb-1">No load data yet</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          Complete workouts to start tracking your weekly training volume. The chart will show your load trend over the past 12 weeks.
        </p>
      </div>
    );
  }

  // SVG bar chart
  const maxVol = Math.max(...weeks.map(w => w.volume), 1);
  const chartH = 120;
  const barW = 18;
  const gap = 6;
  const totalW = weeks.length * (barW + gap) - gap;
  const padT = 10, padB = 28;
  const plotH = chartH - padT - padB;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ACWR summary card */}
      {acwrZone && (
        <Card className={`p-4 border ${acwrZone.border} ${acwrZone.bg}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Acute:Chronic Workload Ratio</p>
          <div className="flex items-end gap-3">
            <div>
              <span className={`text-3xl font-black ${acwrZone.color}`}>{acwr!.toFixed(2)}</span>
              <span className={`ml-2 text-sm font-bold ${acwrZone.color}`}>{acwrZone.label}</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div>
              <span className="font-semibold text-gray-700">7-day load: </span>
              {acute7 >= 1000 ? `${(acute7 / 1000).toFixed(1)}k` : acute7} kg
            </div>
            <div>
              <span className="font-semibold text-gray-700">28-day avg: </span>
              {chronicAvg >= 1000 ? `${(chronicAvg / 1000).toFixed(1)}k` : Math.round(chronicAvg)} kg/wk
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-snug">
            0.8–1.3 = optimal training zone. Above 1.5 = elevated injury risk. Below 0.8 = undertrained.
          </p>
        </Card>
      )}

      {/* Bar chart */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Weekly Volume — 12 weeks</p>
        <svg
          viewBox={`0 0 ${totalW + 4} ${chartH}`}
          className="w-full overflow-visible"
          style={{ height: chartH }}
        >
          {/* Grid lines */}
          {[0, 0.5, 1].map(t => {
            const y = padT + plotH * (1 - t);
            return (
              <g key={t}>
                <line x1={0} x2={totalW + 4} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />
                {t > 0 && (
                  <text x={totalW + 6} y={y + 3} fontSize="7" fill="#d1d5db" textAnchor="start">
                    {t === 1
                      ? (maxVol >= 1000 ? `${(maxVol / 1000).toFixed(0)}k` : maxVol)
                      : (maxVol >= 1000 ? `${((maxVol * 0.5) / 1000).toFixed(0)}k` : Math.round(maxVol * 0.5))}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bars */}
          {weeks.map((w, i) => {
            const x = i * (barW + gap);
            const barH = w.volume > 0 ? Math.max(4, (w.volume / maxVol) * plotH) : 0;
            const y = padT + plotH - barH;
            const isLast = i === weeks.length - 1;
            return (
              <g key={i}>
                <rect
                  x={x} y={y}
                  width={barW} height={barH}
                  rx={3}
                  fill={isLast ? '#6366f1' : '#c7d2fe'}
                />
                {/* X label — first, middle, last */}
                {(i === 0 || i === 5 || i === 11) && (
                  <text
                    x={x + barW / 2}
                    y={chartH - 4}
                    fontSize="7"
                    fill="#9ca3af"
                    textAnchor={i === 0 ? 'start' : i === 11 ? 'end' : 'middle'}
                  >
                    {w.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="text-[10px] text-gray-400 mt-1">Purple = this week. Includes gym volume + match load equivalent.</p>
      </Card>

      {/* Weekly breakdown table */}
      <Card className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Week by Week</p>
        <div className="flex flex-col gap-1.5">
          {[...weeks].reverse().map((w, i) => (
            w.volume > 0 && (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">{w.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-brand-400 rounded-l-full"
                    style={{ width: `${(w.gymVolume / maxVol) * 100}%` }}
                  />
                  <div
                    className="h-full bg-orange-400"
                    style={{ width: `${(w.matchVolume / maxVol) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-14 text-right flex-shrink-0">
                  {w.volume >= 1000 ? `${(w.volume / 1000).toFixed(1)}k` : w.volume}
                </span>
                <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">
                  {w.sessions > 0 && `${w.sessions}💪`}{w.matches > 0 && ` ${w.matches}⚽`}
                </span>
              </div>
            )
          ))}
        </div>
      </Card>
    </div>
  );
}


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
  'broad_jump': { label: 'Broad Jump',   emoji: '→',  unit: 'cm', lowerIsBetter: false, color: '#8b5cf6', decimals: 1 },
  'rsa':        { label: 'RSA Best',     emoji: '🔄', unit: 's',  lowerIsBetter: true,  color: '#f59e0b', decimals: 2 },
  'yoyo':       { label: 'Yo-Yo IR1',   emoji: '🫀', unit: '',   lowerIsBetter: false, color: '#10b981', decimals: 1 },
};

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface DataPoint {
  date: string;
  value: number;
  grade?: 1|2|3|4|5;
}

const GRADE_DOT: Record<1|2|3|4|5, string> = {
  5: '#7c3aed',
  4: '#16a34a',
  3: '#2563eb',
  2: '#ca8a04',
  1: '#dc2626',
};

function TestChart({ meta, points }: { meta: TestMeta; points: DataPoint[] }) {
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

  // y-axis labels: show actual data min/max, not the padded domain boundaries
  const yLabelTop = rawMax.toFixed(meta.decimals);
  const yLabelBot = rawMin.toFixed(meta.decimals);

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
                onTouchEnd={() => setTimeout(() => setHoveredIdx(null), TOOLTIP_HIDE_DELAY_MS)}
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


/** Classify a relative VO₂max (ml·kg⁻¹·min⁻¹) for field-sport athletes. */
function gradeVo2(vo2: number, sex: 'male' | 'female'): { grade: 1|2|3|4|5; label: string } {
  const thresholds = sex === 'female'
    ? [54, 48, 42, 36] // Elite / Excellent / Good / Fair
    : [63, 57, 50, 43];
  if (vo2 >= thresholds[0]) return { grade: 5, label: 'Elite'      };
  if (vo2 >= thresholds[1]) return { grade: 4, label: 'Excellent'  };
  if (vo2 >= thresholds[2]) return { grade: 3, label: 'Good'       };
  if (vo2 >= thresholds[3]) return { grade: 2, label: 'Fair'       };
  return                           { grade: 1, label: 'Needs Work' };
}

const VO2_NORMS = {
  male:   [{ grade:5, label:'Elite',      range:'≥ 63' }, { grade:4, label:'Excellent', range:'57 – 62' }, { grade:3, label:'Good',      range:'50 – 56' }, { grade:2, label:'Fair',      range:'43 – 49' }, { grade:1, label:'Needs Work', range:'< 43'   }],
  female: [{ grade:5, label:'Elite',      range:'≥ 54' }, { grade:4, label:'Excellent', range:'48 – 53' }, { grade:3, label:'Good',      range:'42 – 47' }, { grade:2, label:'Fair',      range:'36 – 41' }, { grade:1, label:'Needs Work', range:'< 36'   }],
} as const;

interface Vo2Point { date: string; vo2: number; distM: number; yoyoLevel: number }

function Vo2MaxCard({ points, weightKg, sex }: {
  points: Vo2Point[];
  weightKg?: number;
  sex: 'male' | 'female';
}) {
  if (points.length === 0) return null;

  const latest   = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const { grade } = gradeVo2(latest.vo2, sex);
  const c        = GRADE_COLOURS[grade];
  const delta    = previous ? +(latest.vo2 - previous.vo2).toFixed(1) : null;
  const vo2Abs   = weightKg ? Math.round(latest.vo2 * weightKg / 1000 * 10) / 10 : null;

  const fmtYoyo  = (lvl: number) => { const l = Math.floor(lvl); const s = Math.round((lvl - l) * 10); return s > 0 ? `Lvl ${l}.${s}` : `Lvl ${l}`; };

  // Sparkline (only when ≥ 2 sessions)
  const SparkLine = () => {
    if (points.length < 2) return null;
    const W = 260, H = 48, padX = 6, padY = 6;
    const vals  = points.map(p => p.vo2);
    const lo    = Math.min(...vals) - 1;
    const hi    = Math.max(...vals) + 1;
    const toX   = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2);
    const toY   = (v: number) => padY + (1 - (v - lo) / (hi - lo)) * (H - padY * 2);
    const line  = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.vo2).toFixed(1)}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 48 }}>
        <polyline points={line} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.vo2)} r="3" fill="#8b5cf6" />
        ))}
      </svg>
    );
  };

  return (
    <Card className="p-4 mb-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🫀</span>
        <h3 className="text-sm font-bold text-gray-800">VO₂max Estimate</h3>
        <span className="ml-auto text-xs text-gray-400">{points.length} test{points.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Main number */}
      <div className="flex items-end gap-3 mb-3">
        <div>
          <p className="text-4xl font-extrabold text-brand-600 leading-none tabular-nums">{latest.vo2}</p>
          <p className="text-xs text-gray-400 mt-1">ml · kg⁻¹ · min⁻¹</p>
        </div>
        <div className="mb-1 flex flex-col gap-1.5">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
            {GRADE_LABELS[grade]}
          </span>
          {delta !== null && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {delta >= 0 ? '+' : ''}{delta} vs last
            </span>
          )}
        </div>
        {(vo2Abs !== null || latest.distM > 0) && (
          <div className="ml-auto text-right mb-1">
            {vo2Abs !== null && (
              <>
                <p className="text-base font-bold text-gray-700 leading-none">{vo2Abs} L/min</p>
                <p className="text-xs text-gray-400">absolute</p>
              </>
            )}
            <p className="text-xs text-gray-500 mt-1">{latest.distM} m covered</p>
            <p className="text-xs text-gray-400">{fmtYoyo(latest.yoyoLevel)}</p>
          </div>
        )}
      </div>

      {/* Sparkline */}
      {points.length >= 2 && (
        <div className="mb-3 -mx-1">
          <SparkLine />
          <div className="flex justify-between text-xs text-gray-400 px-1 mt-0.5">
            <span>{new Date(points[0].date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <span>{new Date(points[points.length - 1].date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </div>
        </div>
      )}

      {/* Norm table */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1.5">
          Benchmarks · {sex === 'male' ? 'Male' : 'Female'} field-sport athletes
        </p>
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {VO2_NORMS[sex].map(row => {
            const isAthlete = row.grade === grade;
            const rc = GRADE_COLOURS[row.grade];
            return (
              <div key={row.grade} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isAthlete ? `${rc.bg} border ${rc.border}` : ''}`}>
                <span className={`text-xs font-bold w-20 shrink-0 ${isAthlete ? rc.text : 'text-gray-500'}`}>
                  {row.label}{isAthlete ? ' ← you' : ''}
                </span>
                <span className={`text-xs ${isAthlete ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                  {row.range} ml·kg⁻¹·min⁻¹
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}


function TestProgressionTab({ onNavigate }: { onNavigate: (nav: NavState) => void }) {
  const { testSessions, userProfile, baseline } = useStore();

  const sorted = [...testSessions].sort((a, b) => a.completedAt - b.completedAt);

  const sex: 'male' | 'female' =
    baseline?.test.sex ?? (userProfile?.gender === 'female' ? 'female' : 'male');
  const weightKg = userProfile?.weightKg;

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
        grade: (() => { const g = session.grades[type]; return (typeof g === 'number' && g >= 1 && g <= 5) ? g as 1|2|3|4|5 : undefined; })(),
      });
    }
    if (pts.length > 0) pointsByType[type] = pts;
  }

  // VO₂max points — derived from every session that has a Yo-Yo result
  const vo2Points: Vo2Point[] = sorted
    .map(s => {
      const res = s.results.find(r => r.type === 'yoyo' && !r.skipped && r.best > 0);
      if (!res) return null;
      return {
        date:       s.date,
        yoyoLevel:  res.best,
        vo2:        calcVo2Max(res.best),
        distM:      calcYoyoDistance(res.best),
      };
    })
    .filter((p): p is Vo2Point => p !== null);

  const typesWithData = (Object.keys(TEST_META) as TestType[]).filter(t => pointsByType[t]);

  // RSA Fatigue Index — separate from TestType system (fatigueIndex is on the result, not a standalone test type)
  const rsaFiMeta: TestMeta = { label: 'RSA Fatigue Index', emoji: '🔄', unit: '%', lowerIsBetter: true, color: '#f59e0b', decimals: 1 };
  const rsaFiPoints: DataPoint[] = sorted.flatMap(session => {
    const res = session.results.find(r => r.type === 'rsa' && !r.skipped && r.fatigueIndex != null && r.fatigueIndex > 0);
    if (!res) return [];
    return [{ date: session.date, value: res.fatigueIndex! }];
  });

  if (typesWithData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <FlaskConical size={36} className="text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-500 mb-1">No fitness tests recorded</p>
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

      {/* VO₂max card — shown whenever Yo-Yo data exists */}
      <Vo2MaxCard points={vo2Points} weightKg={weightKg} sex={sex} />

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
            <TestChart meta={meta} points={points} />
          </Card>
        );
      })}

      {/* RSA Fatigue Index — separate card, lower FI % = better sprint recovery */}
      {rsaFiPoints.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">{rsaFiMeta.emoji}</span>
            <h3 className="text-sm font-bold text-gray-800">{rsaFiMeta.label}</h3>
            <span className="ml-1 text-xs text-gray-400">(lower = better recovery)</span>
            <span className="ml-auto text-xs text-gray-400">{rsaFiPoints.length} test{rsaFiPoints.length !== 1 ? 's' : ''}</span>
          </div>
          <TestChart meta={rsaFiMeta} points={rsaFiPoints} />
        </Card>
      )}

      <button
        onClick={() => onNavigate({ screen: 'testing-battery' })}
        className="w-full py-3 border-2 border-brand-200 bg-brand-50 text-brand-700 text-sm font-semibold rounded-2xl hover:bg-brand-100 transition-colors"
      >
        + Add New Test Result
      </button>
    </div>
  );
}


interface HistoryProps {
  sessions: WorkoutSession[];
  matchEntries: MatchEntry[];
  onNavigate: (nav: NavState) => void;
  onDeleteSession: (id: string) => void;
  isPremium: boolean;
  onUpgrade: (featureLabel: string) => void;
}

export function History({ sessions, matchEntries, onNavigate, onDeleteSession, isPremium, onUpgrade }: HistoryProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'load' | 'tests'>('sessions');

  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  // Group by month — use stable YYYY-MM key so locale changes don't split groups
  const grouped: Record<string, WorkoutSession[]> = {};
  sorted.forEach(s => {
    const d = new Date(s.date + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  return (
    <Layout title="Performance">

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-5">
        {(['sessions', 'load', 'tests'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'sessions' ? 'Sessions' : tab === 'load' ? 'Load' : 'Tests'}
          </button>
        ))}
      </div>

      {activeTab === 'tests' ? (
        <>
          <PerformanceOverview onNavigate={onNavigate} />
          <TestProgressionTab onNavigate={onNavigate} />
        </>
      ) : activeTab === 'load' ? (
        isPremium ? (
          <LoadTab sessions={sessions} matchEntries={matchEntries} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
              <BarChart2 size={28} className="text-brand-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Training Load Analytics</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              See your weekly training load, ACWR score, and injury risk zone. Train smart, not just hard.
            </p>
            <button
              onClick={() => onUpgrade('Training Load Analytics')}
              className="px-6 py-3 rounded-2xl bg-brand-500 text-white font-bold text-sm shadow-md hover:bg-brand-600 transition-colors"
            >
              Unlock with Pro
            </button>
          </div>
        )
      ) : (
        <>
          {/* This week summary */}
          {sessions.length > 0 && <WeekSummary sessions={sessions} />}

          {/* Session log */}
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-brand-500" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session Log</h2>
          </div>

          {sorted.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Activity size={28} className="text-gray-300" />
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">No sessions yet</h3>
              <p className="text-sm text-gray-400 leading-snug">Complete your first workout and it'll appear here. Start from the Dashboard or build a programme.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(grouped).map(([monthKey, monthSessions]) => (
                <section key={monthKey}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    {new Date(monthKey + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </h3>
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
