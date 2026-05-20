/**
 * ProgrammeBuilder v2 — 5-step wizard collecting inputs for the AI programme generator.
 * Pre-fills position, experience, gym access from UserProfile. FV always balanced.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { trackEvent } from '../../lib/analytics';
import { ChevronLeft, ChevronRight, Zap, Target, Activity, Brain, Check, User, Calendar, Dumbbell } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  ProgrammeInputs, PrimaryGoal, MatchDayPref, GameDayPref, Weakness, InjuryArea,
  PlayStyle, UserProfile, StrengthSetup, LiftBaseline,
} from '../../types';
import { LIFT_META, LiftKey, LIFT_KEYS, epley1RM } from '../../lib/progressiveOverload';

interface Props {
  userProfile: UserProfile;
  onGenerate: (inputs: ProgrammeInputs) => void;
  onBack: () => void;
  existingStrengthSetup?: StrengthSetup;
}

const STEPS = ['Goals', 'Position', 'Injuries', 'Schedule', 'Lifts', 'Duration'];

type Opt<T extends string> = { value: T; label: string; description?: string };

// ── Option data ────────────────────────────────────────────────────────────

const GYM_SESSIONS_OPTS: Opt<string>[] = [
  { value: '1', label: '1 gym session' },
  { value: '2', label: '2 gym sessions', description: 'Recommended minimum' },
  { value: '3', label: '3 gym sessions', description: 'Optimal for most players' },
];

type CondType = 'zone2' | 'hiit' | 'rsa';

const CONDITIONING_TYPE_OPTS: { value: CondType; label: string; description: string; loadNote: string }[] = [
  { value: 'hiit', label: '🔥 High Intensity Aerobic', description: 'VO₂max intervals — 80–95% max HR', loadNote: 'Moderate load — schedule away from gym' },
  { value: 'rsa', label: '⚡ Anaerobic / RSA', description: 'Repeated Sprint Ability — max effort, full recovery', loadNote: 'High load — needs freshest legs' },
  { value: 'zone2', label: '🫀 Zone 2', description: 'Aerobic base — 60–70% max HR, active recovery', loadNote: 'Low load — can follow harder sessions' },
];

const IN_SEASON_GYM_OPTS: Opt<string>[] = [
  { value: '1', label: '1 gym session', description: 'Congested fixture period' },
  { value: '2', label: '2 gym sessions', description: 'Optimal in-season load' },
];

const MATCHES_PER_WEEK_OPTS: Opt<string>[] = [
  { value: '1', label: '1 match', description: 'Standard week' },
  { value: '2', label: '2 matches', description: 'Midweek + weekend' },
  { value: '3', label: '3 matches', description: 'Congested fixture period' },
];


const POSITION_OPTS: Opt<string>[] = [
  { value: 'GK', label: '🧤 Goalkeeper' },
  { value: 'CB', label: '🛡️ Centre Back' },
  { value: 'FB', label: '↔️ Full Back' },
  { value: 'CM', label: '⚙️ Midfielder' },
  { value: 'W', label: '⚡ Winger' },
  { value: 'ST', label: '🎯 Striker' },
];

const PLAY_STYLE_OPTS: Opt<PlayStyle>[] = [
  { value: 'box-to-box', label: '🔄 Box-to-Box', description: 'High work rate, covers all thirds' },
  { value: 'direct', label: '⬆️ Direct', description: 'Quick vertical transitions' },
  { value: 'technical', label: '🎨 Technical', description: 'Ball retention, tight spaces' },
  { value: 'physical', label: '💪 Physical', description: 'Dominant in duels and aerial' },
  { value: 'press-heavy', label: '🔥 Press-Heavy', description: 'High-press, high-intensity demands' },
  { value: 'counter-attack', label: '🚀 Counter-Attack', description: 'Explosive transition speed' },
];


const GOAL_OPTS: Opt<PrimaryGoal>[] = [
  { value: 'speed', label: '⚡ Speed', description: 'Max velocity & acceleration' },
  { value: 'strength', label: '💪 Strength', description: 'Force production & power base' },
  { value: 'power', label: '🚀 Power', description: 'Explosive athleticism' },
  { value: 'endurance', label: '🫀 Endurance', description: 'Repeated-effort capacity' },
  { value: 'injury_prevention', label: '🛡️ Injury Prevention', description: 'Resilience & prehab focus' },
];

const SECONDARY_GOAL_OPTS: { value: string; label: string }[] = [
  { value: 'speed', label: 'Speed' }, { value: 'strength', label: 'Strength' },
  { value: 'power', label: 'Power' }, { value: 'endurance', label: 'Endurance' },
  { value: 'agility', label: 'Agility' }, { value: 'mobility', label: 'Mobility' },
];

const WEAKNESS_OPTS: Opt<Weakness>[] = [
  { value: 'speed', label: '⚡ Speed', description: 'First step or max velocity' },
  { value: 'strength', label: '💪 Strength', description: 'Lacking force base' },
  { value: 'endurance', label: '🫀 Endurance', description: 'Fade late in games' },
  { value: 'power', label: '🚀 Power', description: 'Explosive actions are weak' },
  { value: 'agility', label: '🔄 Agility', description: 'Change of direction' },
  { value: 'injury_prone', label: '🩹 Injury-prone', description: 'Recurring injuries' },
];

const INJURY_OPTS: { value: InjuryArea; label: string; emoji: string }[] = [
  { value: 'hamstring', label: 'Hamstring', emoji: '🦵' },
  { value: 'ankle', label: 'Ankle', emoji: '🦶' },
  { value: 'knee', label: 'Knee', emoji: '🦵' },
  { value: 'groin', label: 'Groin', emoji: '🩹' },
  { value: 'calf', label: 'Calf', emoji: '🦵' },
  { value: 'back', label: 'Lower Back', emoji: '🔙' },
  { value: 'shoulder', label: 'Shoulder', emoji: '💪' },
];

// ── Day schedule helpers ───────────────────────────────────────────────────

export type DaySlot = 'rest' | 'gym' | 'zone2' | 'hiit' | 'rsa' | 'training' | 'match' | 'gym+zone2' | 'gym+hiit' | 'gym+rsa' | 'gym+training' | 'gym-micro';

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

type WeekSchedule = Record<typeof DAY_KEYS[number], DaySlot>;

const EMPTY_SCHEDULE: WeekSchedule = {
  monday: 'rest', tuesday: 'rest', wednesday: 'rest', thursday: 'rest',
  friday: 'rest', saturday: 'rest', sunday: 'rest',
};

// Load weight per session type (arbitrary units, higher = more recovery needed after)
const LOAD: Record<DaySlot, number> = {
  gym: 3, zone2: 1, hiit: 2, rsa: 3, training: 2, match: 3, rest: 0,
  'gym+zone2': 4, 'gym+hiit': 4, 'gym+rsa': 5, 'gym+training': 4,
  'gym-micro': 1,
};

// ── Match-count gym volume cap ─────────────────────────────────────────────
// Prevents excess neuromuscular fatigue carryover into congested fixture weeks.
function clampGymCount(requested: number, matchCount: number): number {
  if (matchCount >= 3) return Math.min(requested, 1);
  if (matchCount === 2) return Math.min(requested, 2);
  return Math.min(requested, 3);
}

function cumulativeFatigue(schedule: WeekSchedule, dayIndex: number): number {
  // Rolling 3-day load sum before this day (decays by 1 per day)
  let fatigue = 0;
  for (let i = Math.max(0, dayIndex - 3); i < dayIndex; i++) {
    const decay = dayIndex - i;          // 1 = yesterday, 2 = 2 days ago, 3 = 3 days ago
    fatigue += LOAD[schedule[DAY_KEYS[i]]] / decay;
  }
  return fatigue;
}

function assignSessions(
  availableIndices: number[],
  gymCount: number,
  condTypes: CondType[],
  trainingCount: number,
  offSeason: boolean,
  matchIndices: Set<number>,
  matchCount: number,
): WeekSchedule {
  const schedule: WeekSchedule = { ...EMPTY_SCHEDULE };
  matchIndices.forEach(i => { schedule[DAY_KEYS[i]] = 'match'; });

  const pool = availableIndices.filter(i => !matchIndices.has(i));

  if (offSeason) {
    // Beardsley methodology: each session type gets its own day.
    // Optimal layout (3 gym + 3 conditioning):
    //   Mon: Gym Heavy | Tue: Hi-Aerobic | Wed: Gym Moderate | Thu: Zone 2 | Fri: Gym Heavy | Sat: RSA
    // Rules: gym sessions 48h apart; RSA 48h from heavy gym; Zone 2 restorative anywhere;
    //        Hi-Aerobic placed AFTER gym (not before) to avoid interference with force production.

    const used = new Set<number>();

    // Preferred day indices (0=Mon … 6=Sun) for each session type
    const GYM_PREFS: Record<number, number[]> = {
      2: [1, 5, 0, 2, 4, 6, 3],       // Tue, Sat preferred
      3: [0, 2, 4, 1, 3, 5, 6],       // Mon, Wed, Fri preferred
      4: [0, 2, 4, 6, 1, 3, 5],       // Mon, Wed, Fri, Sun preferred
    };
    const COND_PREFS: Record<CondType, number[]> = {
      hiit:  [1, 3, 5, 0, 2, 4, 6],   // Tue preferred (day after Mon gym)
      zone2: [3, 1, 5, 0, 2, 4, 6],   // Thu preferred (restorative, keeps Fri fresh)
      rsa:   [5, 3, 6, 1, 0, 2, 4],   // Sat preferred (full Sunday rest follows)
    };

    const pickOffSeason = (prefs: number[]): number | null => {
      for (const d of prefs) {
        if (pool.includes(d) && !used.has(d)) return d;
      }
      return null;
    };

    // Place gym sessions first
    const gymPrefs = GYM_PREFS[gymCount] ?? GYM_PREFS[3];
    let gymPlaced = 0;
    for (const d of gymPrefs) {
      if (gymPlaced >= gymCount) break;
      if (pool.includes(d) && !used.has(d)) {
        schedule[DAY_KEYS[d]] = 'gym';
        used.add(d);
        gymPlaced++;
      }
    }

    // Place conditioning: hiit → zone2 → rsa (matches optimal day order Tue→Thu→Sat)
    const condPlacementOrder: CondType[] = ['hiit', 'zone2', 'rsa'];
    for (const ct of condPlacementOrder) {
      if (!condTypes.includes(ct)) continue;
      const d = pickOffSeason(COND_PREFS[ct]);
      if (d !== null) {
        schedule[DAY_KEYS[d]] = ct;
        used.add(d);
      }
    }
  } else {
    // In-season: gym sessions placed relative to match day(s) based on matchCount.
    //
    // matchCount === 1: up to 3 gym sessions
    //   Heavy load @ MD-4 (full recovery window)
    //   Power focus @ MD-2 (fresh enough for quality, clears before match)
    //   Activation primer @ MD-1 (low volume, high intent only)
    //
    // matchCount === 2: up to 2 gym sessions — no heavy load
    //   Micro-power bridge @ MD-2 of 2nd match (between the two matches)
    //   Activation primer @ MD-1 of 1st match (≤ 15 min)
    //
    // matchCount === 3: max 1 session — zero external loading
    //   Single tendon-care micro-dose (gym-micro slot) placed furthest from all matches

    const used = new Set<number>();
    matchIndices.forEach(i => used.add(i));

    const effectiveGymCount = clampGymCount(gymCount, matchCount);

    const sortedMatches = Array.from(matchIndices).sort((a, b) => a - b);
    const primaryMatchIdx = sortedMatches[0] ?? -1;
    const secondMatchIdx  = sortedMatches[1] ?? -1;

    // Day index relative to a base match day, wrapping within the 7-day week
    const relTo = (base: number, off: number): number =>
      base >= 0 ? ((base + off + 7) % 7) : -1;

    // Pick the first available day from a prioritised list of absolute day indices.
    // Falls back to the day furthest from any tracked match when all candidates are blocked.
    const pickDay = (candidates: number[]): number | null => {
      for (const d of candidates) {
        if (d >= 0 && pool.includes(d) && !used.has(d)) return d;
      }
      const remaining = pool.filter(i => !used.has(i));
      if (remaining.length === 0) return null;
      if (sortedMatches.length > 0) {
        remaining.sort((a, b) => {
          const da = Math.min(...sortedMatches.map(m => Math.abs(a - m)));
          const db = Math.min(...sortedMatches.map(m => Math.abs(b - m)));
          return db - da;
        });
      }
      return remaining[0];
    };

    // Always leave at least 1 rest day
    const maxTraining = Math.max(pool.length - 1, 0);
    let placed = 0;

    if (matchCount <= 1) {
      // 1-match week: MD-4 heavy → MD-2 power → MD-1 primer
      const gymSlotTargets: number[][] = [
        [relTo(primaryMatchIdx, -4), relTo(primaryMatchIdx, -5), relTo(primaryMatchIdx, -3)],
        [relTo(primaryMatchIdx, -2), relTo(primaryMatchIdx, -3)],
        [relTo(primaryMatchIdx, -1), relTo(primaryMatchIdx, -2)],
      ];
      for (let g = 0; g < effectiveGymCount && placed < maxTraining; g++) {
        const d = pickDay(gymSlotTargets[g] ?? gymSlotTargets[0]);
        if (d !== null) { schedule[DAY_KEYS[d]] = 'gym'; used.add(d); placed++; }
      }
    } else if (matchCount === 2) {
      // 2-match week: bridge micro-power → primer
      const gymSlotTargets: number[][] = [
        // Session 1: bridge — MD-2 of second match, between the two fixtures
        [
          relTo(secondMatchIdx,  -2),
          relTo(secondMatchIdx,  -3),
          relTo(primaryMatchIdx, -2),
        ],
        // Session 2: primer — MD-1 of primary match or second match
        [
          relTo(primaryMatchIdx, -1),
          relTo(secondMatchIdx,  -1),
          relTo(primaryMatchIdx, -2),
        ],
      ];
      for (let g = 0; g < effectiveGymCount && placed < maxTraining; g++) {
        const d = pickDay(gymSlotTargets[g] ?? gymSlotTargets[0]);
        if (d !== null) { schedule[DAY_KEYS[d]] = 'gym'; used.add(d); placed++; }
      }
    } else {
      // 3-match week: single tendon-care micro-dose — furthest from all matches.
      // gym-micro slot signals zero external loading — no standalone gym block in programme.
      if (effectiveGymCount > 0 && placed < maxTraining) {
        const d = pickDay([]); // candidates empty → fallback picks furthest-from-match day
        if (d !== null) { schedule[DAY_KEYS[d]] = 'gym-micro'; used.add(d); placed++; }
      }
    }

    // Conditioning placement (relative to primary match day — unchanged from 1-match logic)
    const condDayPrefs: Record<CondType, number[]> = {
      zone2: [relTo(primaryMatchIdx,  1), relTo(primaryMatchIdx,  2), relTo(primaryMatchIdx, -6)],
      hiit:  [relTo(primaryMatchIdx, -2), relTo(primaryMatchIdx, -3), relTo(primaryMatchIdx, -4)],
      rsa:   [relTo(primaryMatchIdx, -4), relTo(primaryMatchIdx, -5), relTo(primaryMatchIdx, -3)],
    };
    const condPlacementOrder: CondType[] = ['zone2', 'rsa', 'hiit'];
    for (const ct of condPlacementOrder) {
      if (!condTypes.includes(ct) || placed >= maxTraining) continue;
      const d = pickDay(condDayPrefs[ct]);
      if (d !== null) { schedule[DAY_KEYS[d]] = ct; used.add(d); placed++; }
    }

    // Fallback for gymCount === 0 (shouldn't occur with current UI, kept for safety)
    if (gymCount === 0 && trainingCount > 0) {
      const remaining = pool.filter(i => !used.has(i));
      remaining.sort((a, b) => {
        const da = matchIndices.size > 0 ? Math.min(...Array.from(matchIndices).map(m => Math.abs(a - m))) : 0;
        const db = matchIndices.size > 0 ? Math.min(...Array.from(matchIndices).map(m => Math.abs(b - m))) : 0;
        return db - da;
      });
      for (let t = 0; t < trainingCount && remaining.length > 0; t++) {
        schedule[DAY_KEYS[remaining.shift()!]] = 'training';
      }
    }
  }

  return schedule;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AvailabilityPicker({
  availableDays, onToggle, matchIndices, totalNeeded,
}: {
  availableDays: Set<number>;
  onToggle: (i: number) => void;
  matchIndices: Set<number>;
  totalNeeded: number;
}) {
  const totalSelected = availableDays.size + matchIndices.size;
  // Min days = ceil(totalNeeded/2) since max 2 sessions per day; max = 6 to keep 1 rest
  const minDays = Math.min(Math.ceil(totalNeeded / 2), 6);
  const needsDoubles = totalNeeded > 7;
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-1">Which days are you available to train?</p>
      <p className="text-xs text-gray-400 mb-3">
        Select at least {minDays} day{minDays !== 1 ? 's' : ''}.
        {needsDoubles && ` With ${totalNeeded} sessions some days will have 2 sessions (AM + PM).`}
        {!needsDoubles && ' Sessions will be assigned automatically around fatigue.'}
        {matchIndices.size > 0 && ' Match days are pre-selected.'}
      </p>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {DAY_KEYS.map((key, i) => {
          const isMatch = matchIndices.has(i);
          const isAvail = availableDays.has(i) || isMatch;
          return (
            <button
              key={key}
              onClick={() => onToggle(i)}
              disabled={isMatch}
              className={`flex flex-col items-center py-2.5 rounded-xl border-2 transition-all active:scale-95 ${
                isMatch
                  ? 'bg-orange-500 border-orange-500 text-white cursor-default'
                  : isAvail
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              <span className="text-[11px] font-bold">{DAY_SHORT[i]}</span>
              {isMatch && <span className="text-[9px] mt-0.5 opacity-80">Match</span>}
            </button>
          );
        })}
      </div>
      {totalSelected > 0 && totalSelected < totalNeeded && (
        <p className="text-xs text-orange-600 font-medium">
          {totalSelected}/{totalNeeded} days selected — add {totalNeeded - totalSelected} more
        </p>
      )}
    </div>
  );
}

function ScheduleResult({
  schedule,
  matchDayKey,
  secondMatchDayKey,
}: {
  schedule: WeekSchedule;
  matchDayKey?: string;
  secondMatchDayKey?: string;
}) {
  const slotBg: Record<DaySlot, string> = {
    gym:           'bg-brand-500 text-white',
    zone2:         'bg-emerald-500 text-white',
    hiit:          'bg-orange-500 text-white',
    rsa:           'bg-red-500 text-white',
    training:      'bg-brand-500 text-white',
    match:         'bg-orange-600 text-white',
    rest:          'bg-gray-100 text-gray-400',
    'gym+zone2':   'bg-purple-500 text-white',
    'gym+hiit':    'bg-purple-600 text-white',
    'gym+rsa':     'bg-purple-700 text-white',
    'gym+training':'bg-purple-600 text-white',
    'gym-micro':   'bg-teal-600 text-white',
  };
  const slotLabel: Record<DaySlot, string> = {
    gym: 'Gym', zone2: 'Zone 2', hiit: 'HIIT', rsa: 'RSA',
    training: 'Training', match: 'Match', rest: 'Rest',
    'gym+zone2': 'Gym + Zone 2', 'gym+hiit': 'Gym + HIIT',
    'gym+rsa': 'Gym + RSA', 'gym+training': 'Gym + Training',
    'gym-micro': 'Tendon Care',
  };
  const slotDetail: Record<DaySlot, string> = {
    gym: 'Strength session',
    zone2: 'Aerobic base — 60–70% max HR',
    hiit: 'VO₂max intervals — 80–95% max HR',
    rsa: 'Repeated sprints — max effort, full recovery',
    training: 'Training session',
    match: 'Match day', rest: 'Recovery',
    'gym+zone2': 'AM gym · PM Zone 2',
    'gym+hiit': 'AM gym · PM HIIT intervals',
    'gym+rsa': 'AM gym · PM repeated sprints',
    'gym+training': 'AM gym · PM training',
    'gym-micro': 'Tendon Care & Isometric Micro-dose (10m)',
  };

  const fatiguePct = (i: number) => Math.min(cumulativeFatigue(schedule, i) / 4, 1);
  const fatigueColour = (pct: number) =>
    pct > 0.75 ? 'bg-red-400' : pct > 0.5 ? 'bg-orange-400' : pct > 0.25 ? 'bg-yellow-400' : 'bg-green-400';

  // Intensity modifier based on fatigue context
  const intensityNote = (slot: DaySlot, fatPct: number): string | null => {
    if (slot === 'rest' || slot === 'match') return null;
    if (fatPct > 0.75) {
      if (slot === 'gym' || slot === 'gym+zone2' || slot === 'gym+hiit' || slot === 'gym+rsa' || slot === 'gym+training')
        return 'Moderate load — submaximal weights, technique focus';
      if (slot === 'rsa' || slot === 'hiit') return '⚠ High fatigue — consider postponing or swap to Zone 2';
      if (slot === 'zone2') return 'Active recovery pace — keep HR below 70%';
      if (slot === 'training') return 'Reduced intensity — activation & technical work';
    } else if (fatPct > 0.5) {
      if (slot === 'gym' || slot === 'gym+zone2' || slot === 'gym+hiit') return 'Moderate–high — avoid max effort lifts';
      if (slot === 'rsa') return 'Ensure full recovery between reps — reduce volume if needed';
      if (slot === 'hiit') return 'Moderate–high aerobic effort';
    }
    return null;
  };

  const restCount = Object.values(schedule).filter(v => v === 'rest').length;

  const matchSet = new Set<number>();
  if (matchDayKey) matchSet.add(DAY_KEYS.indexOf(matchDayKey as typeof DAY_KEYS[number]));
  if (secondMatchDayKey) matchSet.add(DAY_KEYS.indexOf(secondMatchDayKey as typeof DAY_KEYS[number]));
  const heavyBeforeMatch = DAY_KEYS.some((k, i) =>
    matchSet.has(i + 1) && (schedule[k] === 'gym' || schedule[k] === 'training')
    // gym-micro at MD-1 is intentional (activation primer) — not a concern
  );

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Your weekly schedule</p>
      <div className="flex flex-col gap-2 mb-3">
        {DAY_KEYS.map((key, i) => {
          const slot = schedule[key];
          const fatPct = fatiguePct(i);
          const note = intensityNote(slot, fatPct);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 w-7 flex-shrink-0">{DAY_SHORT[i]}</span>
              <div className={`flex-1 px-3 py-2 rounded-xl ${slotBg[slot]}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{slotLabel[slot]}</span>
                  {slot !== 'rest' && !note && (
                    <span className="text-[10px] opacity-70">✓ full intensity</span>
                  )}
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">
                  {note ?? slotDetail[slot]}
                </div>
              </div>
              <div className="w-16 flex-shrink-0">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${fatigueColour(fatPct)}`} style={{ width: `${fatPct * 100}%` }} />
                </div>
                <p className="text-[9px] text-gray-400 text-right mt-0.5">
                  {fatPct === 0 ? 'fresh' : fatPct < 0.4 ? 'low' : fatPct < 0.65 ? 'mod' : 'high'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {restCount === 0 && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 mb-2">
          <p className="text-xs text-red-700 font-semibold">⚠ No rest days — remove an availability day to allow recovery.</p>
        </div>
      )}
      {heavyBeforeMatch && (
        <div className="p-2.5 rounded-xl bg-yellow-50 border border-yellow-200 mb-2">
          <p className="text-xs text-yellow-700 font-semibold">⚠ Heavy session the day before a match — intensity will be auto-reduced.</p>
        </div>
      )}
    </div>
  );
}

function ChipSelector<T extends string>({
  options, selected, onToggle, multi,
}: {
  options: { value: T; label: string; description?: string }[];
  selected: T | T[]; onToggle: (v: T) => void; multi?: boolean;
}) {
  const isSelected = (v: T) => multi ? (selected as T[]).includes(v) : selected === v;
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onToggle(opt.value)}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
            isSelected(opt.value)
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}>
          <div className="font-semibold text-sm">{opt.label}</div>
          {opt.description && <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>}
        </button>
      ))}
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────

export function ProgrammeBuilder({ userProfile, onGenerate, onBack, existingStrengthSetup }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  // Step 0 — Schedule
  const [offSeason, setOffSeason] = useState<boolean | null>(null);
  const [sessionsPerWeek] = useState<number>(3);
  const [gymSessionsPerWeek, setGymSessionsPerWeek] = useState<number>(2);
  const [conditioningTypes, setConditioningTypes] = useState<Set<CondType>>(new Set(['hiit', 'rsa', 'zone2']));
  // In-season specific
  const [inSeasonGymCount, setInSeasonGymCount] = useState<number>(2); // max 2 in-season
  const [inSeasonCondTypes, setInSeasonCondTypes] = useState<Set<CondType>>(new Set(['zone2']));
  const [matchesPerWeek, setMatchesPerWeek] = useState<number>(1);

  // Analytics: track forward navigation from the Schedule step (step 3) to the next step
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (prevStepRef.current === 3 && step === 4) {
      trackEvent('match_days_configured', { match_count: offSeason ? 0 : matchesPerWeek });
    }
    prevStepRef.current = step;
  }, [step, offSeason, matchesPerWeek]);
  // primaryMatchDayIndex: 0=Mon…6=Sun, default Saturday=5
  const [primaryMatchDayIndex, setPrimaryMatchDayIndex] = useState<number>(5);
  const [hasSecondMatchDay, setHasSecondMatchDay] = useState(false);
  const [secondMatchDay, setSecondMatchDay] = useState<GameDayPref>('wednesday');
  // Availability: which days can the athlete train?
  const [availableDays, setAvailableDays] = useState<Set<number>>(new Set());

  // Derive MatchDayPref for the generator (which only knows saturday/sunday/midweek)
  const matchDay: MatchDayPref = primaryMatchDayIndex === 5 ? 'saturday' : primaryMatchDayIndex === 6 ? 'sunday' : 'midweek';
  const matchDayKey = DAY_KEYS[primaryMatchDayIndex] ?? 'saturday';
  const secondMatchDayKey = hasSecondMatchDay ? secondMatchDay : undefined;

  const matchIndicesSet = useCallback(() => {
    const s = new Set<number>();
    if (offSeason === false) {
      s.add(primaryMatchDayIndex);
      if (secondMatchDayKey) {
        const sk = DAY_KEYS.indexOf(secondMatchDayKey as typeof DAY_KEYS[number]);
        if (sk >= 0) s.add(sk);
      }
    }
    return s;
  }, [offSeason, primaryMatchDayIndex, secondMatchDayKey]);

  const setPrimaryMatchDay = (i: number) => {
    setPrimaryMatchDayIndex(i);
    setHasSecondMatchDay(false);
    setAvailableDays(new Set());
  };

  const toggleAvailableDay = (i: number) => {
    const matchIdx = matchIndicesSet();
    // For in-season, match days are always available (locked)
    if (matchIdx.has(i)) return;
    setAvailableDays(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Compute derived schedule from availability
  const weekSchedule = useCallback((): WeekSchedule => {
    if (offSeason === null) return { ...EMPTY_SCHEDULE };
    const matchIdx = matchIndicesSet();
    // For in-season, match day indices are always in the available pool
    const pool = Array.from(new Set([...Array.from(availableDays), ...Array.from(matchIdx)])).sort((a,b) => a-b);
    return assignSessions(
      pool,
      offSeason ? gymSessionsPerWeek : inSeasonGymCount,
      offSeason ? Array.from(conditioningTypes) : Array.from(inSeasonCondTypes),
      0,
      offSeason ?? false,
      matchIdx,
      offSeason ? 0 : matchesPerWeek,
    );
  }, [offSeason, availableDays, gymSessionsPerWeek, conditioningTypes, inSeasonGymCount, inSeasonCondTypes, matchIndicesSet, matchesPerWeek])();

  const condCount = conditioningTypes.size;
  const inSeasonCondCount = inSeasonCondTypes.size;
  const effectiveInSeasonGym = clampGymCount(inSeasonGymCount, matchesPerWeek);
  // totalNeeded = training sessions only (match days are separate, not counted as "sessions")
  const totalNeeded = offSeason === true
    ? gymSessionsPerWeek + condCount
    : offSeason === false
    ? effectiveInSeasonGym + inSeasonCondCount
    : 0;
  const matchIdx = matchIndicesSet();
  const nonMatchAvailable = Array.from(availableDays).filter(i => !matchIdx.has(i)).length;
  const totalAvailable = nonMatchAvailable + matchIdx.size;
  const scheduleRestCount = Object.values(weekSchedule).filter(v => v === 'rest').length;

  const minDaysNeeded = Math.ceil(totalNeeded / 2);
  const scheduleValid =
    offSeason !== null &&
    totalAvailable >= minDaysNeeded &&
    scheduleRestCount >= 1;
  // Step 1 — Position & play style (nothing pre-selected)
  const [primaryPos, setPrimaryPos] = useState<string>('');
  const [secondaryPos, setSecondaryPos] = useState<string>('');
  const [playStyle, setPlayStyle] = useState<PlayStyle | ''>('');
  // Step 2 — Goals (nothing pre-selected)
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | ''>('');
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [biggestWeakness, setBiggestWeakness] = useState<Weakness | ''>('');
  // Step 3 — Injuries & preferences
  const [injuryHistory, setInjuryHistory] = useState<InjuryArea[]>([]);
  const [preferBackSquat, setPreferBackSquat] = useState(false);
  // Step 4 — Lift baselines (optional, pre-filled if existing)
  const [upperPullChoice, setUpperPullChoice] = useState<'pull-up' | 'row'>('pull-up');
  type LiftInput = { weightKg: string; reps: string };
  const [liftInputs, setLiftInputs] = useState<Partial<Record<LiftKey, LiftInput>>>(() => {
    if (!existingStrengthSetup?.lifts.length) return {};
    return Object.fromEntries(
      existingStrengthSetup.lifts.map(l => [l.key, { weightKg: String(l.workingWeightKg), reps: String(l.workingReps) }])
    );
  });
  const setLiftField = (key: LiftKey, field: 'weightKg' | 'reps', val: string) =>
    setLiftInputs(prev => ({ ...prev, [key]: { ...(prev[key] ?? { weightKg: '', reps: '' }), [field]: val } }));
  // Step 5 — Duration
  const suggestedWeeks = ({ '<1': 6, '1-3': 8, '3-5': 10, '5+': 12 } as Record<string, number>)[userProfile.experienceYears] ?? 8;
  const [programDuration, setProgramDuration] = useState(suggestedWeeks);
  const [customDurStr, setCustomDurStr] = useState('');
  const DURATION_PRESETS = [4, 6, 8, 12, 16];

  // Per-step validation
  const step0Valid = offSeason !== null && scheduleValid;
  const step1Valid = primaryPos !== '' && (primaryPos === 'GK' || playStyle !== '');
  const step2Valid = primaryGoal !== '' && biggestWeakness !== '';
  const canNext = step === 0 ? step2Valid : step === 1 ? step1Valid : step === 3 ? step0Valid : true;
  // step 4 (lifts) is optional — always valid

  const toggleSecondary = (v: string) => {
    if (primaryGoal && v === primaryGoal) return;
    setSecondaryGoals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v].slice(0, 3));
  };
  const toggleInjury = (v: InjuryArea) => {
    setInjuryHistory(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const genCallbackRef = useRef<(() => void) | null>(null);

  const GENERATING_STEPS = [
    'Analysing position & play style…',
    'Calculating force-velocity profile…',
    'Periodising training phases…',
    'Selecting compound movements…',
    'Building isometric & eccentric blocks…',
    'Scheduling match-day structure…',
    'Applying injury & prehab protocols…',
    'Optimising conditioning rotation…',
    'Finalising weekly layout…',
    'Programme ready ✓',
  ];

  useEffect(() => {
    if (!isGenerating) return;
    setGenProgress(0);
    const total = 10000;
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      const t = Math.min(elapsed / total, 1);
      // Ease-out: fast to 85% then slow crawl to 100%, giving a "nearly there" feel
      const eased = t < 0.8
        ? 0.85 * (1 - Math.pow(1 - t / 0.8, 2))  // ease-out quad to 85% over first 80% of time
        : 0.85 + ((t - 0.8) / 0.2) * 0.15;        // linear crawl 85%→100% over last 20%
      setGenProgress(eased);
      if (elapsed >= total) {
        clearInterval(timer);
        setIsGenerating(false);
        genCallbackRef.current?.();
      }
    }, interval);
    return () => clearInterval(timer);
  }, [isGenerating]);

  const handleGenerate = () => {
    const isOff = offSeason === true;
    const totalSessions = isOff
      ? gymSessionsPerWeek + condCount
      : clampGymCount(inSeasonGymCount, matchesPerWeek) + inSeasonCondCount + matchesPerWeek;
    const computedLifts: LiftBaseline[] = LIFT_KEYS.flatMap(key => {
      const inp = liftInputs[key];
      if (!inp) return [];
      const w = parseFloat(inp.weightKg);
      const r = parseInt(inp.reps, 10);
      if (!w || !r || w <= 0 || r <= 0) return [];
      return [{ key, exerciseName: LIFT_META[key].askName, workingWeightKg: w, workingReps: r, estimated1RM: Math.round(epley1RM(w, r) * 10) / 10 }];
    });
    const inputs: ProgrammeInputs = {
      position: primaryPos as ProgrammeInputs['position'],
      secondaryPosition: secondaryPos ? secondaryPos as ProgrammeInputs['secondaryPosition'] : undefined,
      playStyle: playStyle as PlayStyle,
      experienceYears: userProfile.experienceYears,
      sessionsPerWeek: totalSessions,
      gymSessionsPerWeek: isOff ? gymSessionsPerWeek : clampGymCount(inSeasonGymCount, matchesPerWeek),
      conditioningSessionsPerWeek: isOff ? condCount : inSeasonCondCount,
      conditioningTypes: isOff ? Array.from(conditioningTypes) : Array.from(inSeasonCondTypes),
      matchesPerWeek: !isOff ? (matchesPerWeek as 1 | 2 | 3) : undefined,
      primaryGoal: primaryGoal as PrimaryGoal,
      secondaryGoals,
      matchDay,
      secondMatchDay: hasSecondMatchDay && !isOff ? secondMatchDay : undefined,
      offSeason: isOff,
      biggestWeakness: biggestWeakness as Weakness,
      injuryHistory,
      gymAccess: userProfile.gymAccess,
      customDurationWeeks: programDuration,
      preferBackSquat: userProfile.gymAccess !== 'none' ? preferBackSquat : undefined,
      upperPullChoice: userProfile.gymAccess !== 'none' ? upperPullChoice : undefined,
      lifts: computedLifts.length > 0 ? computedLifts : undefined,
    };
    genCallbackRef.current = () => onGenerate(inputs);
    setIsGenerating(true);
  };

  const totalSteps = STEPS.length;
  const stepIcons = [Target, User, Brain, Activity, Dumbbell, Calendar];
  const StepIcon = stepIcons[step] ?? Check;

  const expWeeks: Record<string, string> = { '<1': '6', '1-3': '8', '3-5': '10', '5+': '12' };

  if (isGenerating) {
    const stepIndex = Math.min(Math.floor(genProgress * GENERATING_STEPS.length), GENERATING_STEPS.length - 1);
    const currentMsg = GENERATING_STEPS[stepIndex];
    const pct = Math.round(genProgress * 100);
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 px-8">
        {/* Pulsing icon */}
        <div className="mb-8 relative">
          <div className="w-20 h-20 rounded-full bg-brand-500/20 flex items-center justify-center animate-pulse">
            <Zap size={36} className="text-brand-400" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-brand-500/40 animate-ping" />
        </div>

        <h2 className="text-gray-900 text-2xl font-bold mb-2 text-center">Building Your Programme</h2>
        <p className="text-brand-600 text-sm mb-10 text-center">Personalised for your position, goals & injury profile</p>

        {/* Progress bar */}
        <div className="w-full max-w-xs mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-500">Analysing inputs</span>
            <span className="text-xs text-brand-600 font-semibold">{pct}%</span>
          </div>
        </div>

        {/* Step message */}
        <p className="text-gray-600 text-sm text-center min-h-[1.25rem]">{currentMsg}</p>
      </div>
    );
  }

  return (
    <Layout
      title="Build My Programme"
      leftAction={
        <button onClick={step === 0 ? onBack : () => setStep(s => s - 1)} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft size={24} />
        </button>
      }
    >
      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand-500' : 'bg-gray-200'}`} />
            <span className={`text-center text-[10px] leading-tight ${i === step ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step header */}
      <div className="flex items-center gap-2 mb-5 text-brand-600">
        <StepIcon size={22} />
        <h2 className="text-lg font-bold text-gray-900">
          {step === 0 && 'Goals & Weakness'}
          {step === 1 && 'Position & Play Style'}
          {step === 2 && 'Injury History'}
          {step === 3 && 'Training Schedule'}
          {step === 4 && 'Lift Baselines'}
          {step === 5 && 'Programme Duration'}
        </h2>
      </div>

      {/* ── Step 3: Schedule ── */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Season selector */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Where are you in your season?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setOffSeason(false); setHasSecondMatchDay(false); trackEvent('season_selected', { season_type: 'in-season' }); }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  offSeason === false
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">⚽</div>
                <div className={`text-sm font-bold ${offSeason === false ? 'text-brand-700' : 'text-gray-700'}`}>In-Season</div>
                <div className="text-xs text-gray-500 mt-0.5">Training built around match days</div>
              </button>
              <button
                onClick={() => { setOffSeason(true); setHasSecondMatchDay(false); trackEvent('season_selected', { season_type: 'off-season' }); }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  offSeason === true
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🏝️</div>
                <div className={`text-sm font-bold ${offSeason === true ? 'text-brand-700' : 'text-gray-700'}`}>Off-Season</div>
                <div className="text-xs text-gray-500 mt-0.5">Focus purely on building fitness</div>
              </button>
            </div>
          </div>

          {/* Off-season: separate gym + conditioning counts */}
          {offSeason === true && (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Gym sessions per week</p>
                <ChipSelector
                  options={GYM_SESSIONS_OPTS}
                  selected={String(gymSessionsPerWeek)}
                  onToggle={v => setGymSessionsPerWeek(Number(v))}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Conditioning sessions</p>
                <p className="text-xs text-gray-500 mb-2">Toggle the types you want each week — 1 session per type</p>
                <div className="flex flex-col gap-2">
                  {CONDITIONING_TYPE_OPTS.map(opt => {
                    const active = conditioningTypes.has(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setConditioningTypes(prev => {
                          const next = new Set(prev);
                          next.has(opt.value) ? next.delete(opt.value) : next.add(opt.value);
                          return next;
                        })}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                          active
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{opt.label}</span>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                          }`}>
                            {active && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                        {active && <div className="text-[11px] text-brand-600 mt-1 font-medium">{opt.loadNote}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-600">Total: <strong className="text-gray-800">{gymSessionsPerWeek + condCount} sessions/week</strong> · {gymSessionsPerWeek} gym + {condCount} conditioning{condCount > 0 && ` (${Array.from(conditioningTypes).join(', ').toUpperCase()})`}</p>
              </div>
              <AvailabilityPicker
                availableDays={availableDays}
                onToggle={toggleAvailableDay}
                matchIndices={new Set()}
                totalNeeded={gymSessionsPerWeek + condCount}
              />
              {totalAvailable >= Math.ceil((gymSessionsPerWeek + condCount) / 2) && (
                <ScheduleResult schedule={weekSchedule} />
              )}
            </>
          )}

          {/* In-season: gym count + conditioning types + match info */}
          {offSeason === false && (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Gym sessions per week</p>
                <ChipSelector
                  options={IN_SEASON_GYM_OPTS}
                  selected={String(inSeasonGymCount)}
                  onToggle={v => setInSeasonGymCount(Number(v))}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Conditioning sessions</p>
                <p className="text-xs text-gray-500 mb-2">Scheduled around your match day — 1 session per type</p>
                <div className="flex flex-col gap-2">
                  {CONDITIONING_TYPE_OPTS.map(opt => {
                    const active = inSeasonCondTypes.has(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setInSeasonCondTypes(prev => {
                          const next = new Set(prev);
                          next.has(opt.value) ? next.delete(opt.value) : next.add(opt.value);
                          return next;
                        })}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                          active
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{opt.label}</span>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                          }`}>
                            {active && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                        {active && <div className="text-[11px] text-brand-600 mt-1 font-medium">{opt.loadNote}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-600">Total: <strong className="text-gray-800">{effectiveInSeasonGym + inSeasonCondCount} training sessions/week</strong> + {matchesPerWeek} match{matchesPerWeek !== 1 ? 'es' : ''} · {effectiveInSeasonGym} gym + {inSeasonCondCount} conditioning</p>
                {effectiveInSeasonGym < inSeasonGymCount && (
                  <p className="text-xs text-amber-600 font-medium mt-1">
                    ⚠ Gym sessions capped at {effectiveInSeasonGym} — {matchesPerWeek}-match weeks require reduced strength volume to prevent fatigue carryover.
                    {matchesPerWeek >= 3 && ' Tendon care micro-dose only.'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Matches per week</p>
                <ChipSelector
                  options={MATCHES_PER_WEEK_OPTS}
                  selected={String(matchesPerWeek)}
                  onToggle={v => setMatchesPerWeek(Number(v))}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Primary match day</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_SHORT.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setPrimaryMatchDay(i)}
                      className={`flex flex-col items-center py-2.5 rounded-xl border-2 transition-all active:scale-95 ${
                        primaryMatchDayIndex === i
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-[11px] font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {matchesPerWeek >= 2 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Second match day</p>
                  <div className="grid grid-cols-7 gap-1">
                    {(['mon','tue','wed','thu','fri','sat','sun'] as const).map((short, i) => {
                      const full = (['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const)[i];
                      const isSelected = secondMatchDay === full;
                      const isDisabled = i === primaryMatchDayIndex;
                      return (
                        <button
                          key={full}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => { setSecondMatchDay(full); setHasSecondMatchDay(true); }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-brand-500 text-white shadow-sm'
                              : isDisabled
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
                          }`}
                        >
                          {short.charAt(0).toUpperCase() + short.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <AvailabilityPicker
                availableDays={availableDays}
                onToggle={toggleAvailableDay}
                matchIndices={matchIndicesSet()}
                totalNeeded={effectiveInSeasonGym + inSeasonCondCount}
              />
              {totalAvailable >= Math.ceil((effectiveInSeasonGym + inSeasonCondCount) / 2) && (
                <ScheduleResult
                  schedule={weekSchedule}
                  matchDayKey={matchDayKey}
                  secondMatchDayKey={secondMatchDayKey}
                />
              )}
            </>
          )}

          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-xs text-blue-700 font-medium">Using your profile</p>
            <p className="text-xs text-blue-600 mt-1">
              Experience: <strong>{userProfile.experienceYears} yrs</strong> · Gym: <strong>{userProfile.gymAccess}</strong> · Duration: <strong>{expWeeks[userProfile.experienceYears] ?? '8'} weeks</strong>
            </p>
          </Card>
        </div>
      )}

      {/* ── Step 1: Position & Play Style ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Primary position</p>
            <p className="text-xs text-gray-500 mb-2">Pre-filled from your profile — change if needed</p>
            <div className="grid grid-cols-3 gap-2">
              {POSITION_OPTS.map(o => (
                <button key={o.value} onClick={() => setPrimaryPos(o.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    primaryPos === o.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Secondary position <span className="text-gray-400 font-normal">(optional)</span></p>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: '', label: '— None' }, ...POSITION_OPTS].map(o => (
                <button key={o.value} onClick={() => setSecondaryPos(o.value === primaryPos ? '' : o.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    secondaryPos === o.value && o.value !== '' ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : o.value === primaryPos && o.value !== '' ? 'opacity-30 border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : o.value === '' ? secondaryPos === '' ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-200 bg-white text-gray-500'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          {primaryPos !== 'GK' && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Play style</p>
              <ChipSelector options={PLAY_STYLE_OPTS} selected={playStyle as PlayStyle} onToggle={setPlayStyle} />
            </div>
          )}
          {primaryPos === 'GK' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-700 font-medium">Goalkeeper-specific training selected. Play style not applicable — GK programme uses dedicated shot-stopping, distribution and footwork blocks.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 0: Goals ── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Primary goal</p>
            <p className="text-xs text-gray-500 mb-2">Gets majority of programme focus</p>
            <ChipSelector options={GOAL_OPTS} selected={primaryGoal as PrimaryGoal} onToggle={setPrimaryGoal} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Secondary goals <span className="text-gray-400 font-normal">(up to 3)</span></p>
            <p className="text-xs text-gray-500 mb-2">Maintained at minimum effective dose</p>
            <div className="flex flex-wrap gap-2">
              {SECONDARY_GOAL_OPTS.filter(o => o.value !== primaryGoal).map(o => (
                <button key={o.value} onClick={() => toggleSecondary(o.value)}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    secondaryGoals.includes(o.value)
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-brand-400'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Biggest physical weakness</p>
            <ChipSelector options={WEAKNESS_OPTS} selected={biggestWeakness as Weakness} onToggle={setBiggestWeakness} />
          </div>
        </div>
      )}

      {/* ── Step 2: Injury history ── */}
      {step === 2 && (
        <div>
          <p className="text-sm text-gray-600 mb-4">Select any areas with a history of injury. Targeted prehab will be built into every session.</p>
          <div className="grid grid-cols-2 gap-3">
            {INJURY_OPTS.map(o => (
              <button key={o.value} onClick={() => toggleInjury(o.value)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  injuryHistory.includes(o.value)
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}>
                <div className="text-2xl mb-1">{o.emoji}</div>
                <div className="text-sm font-semibold">{o.label}</div>
              </button>
            ))}
          </div>
          {injuryHistory.length === 0 && (
            <Card className="mt-4 p-4 bg-green-50 border-green-200">
              <p className="text-xs text-green-700">No injury history — a general prehab protocol (hamstring + groin) will be included in every session.</p>
            </Card>
          )}
          {userProfile.gymAccess !== 'none' && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Squat Preference</p>
              <button
                onClick={() => setPreferBackSquat(p => !p)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  preferBackSquat
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">🏋️</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">I enjoy Back Squat / have plateaued on split squat</div>
                  <div className="text-xs text-gray-500 mt-0.5">Enables Back Squat in off-season Foundation phases. BSS always used when in-season, speed goal, or back/hamstring history.</div>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  preferBackSquat ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
                }`}>
                  {preferBackSquat && <Check size={12} className="text-white" />}
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Lift Baselines ── */}
      {step === 4 && (
        <div className="space-y-1">
          <p className="text-sm text-gray-600 mb-2">
            Enter your best working set for each lift — the algorithm uses these to set exact weekly weights with progressive overload. Leave blank any you haven't tested.
          </p>
          {existingStrengthSetup && (
            <div className="px-3 py-2 mb-3 rounded-xl bg-green-50 border border-green-200">
              <p className="text-xs text-green-700 font-medium">Pre-filled from your last programme — update if you've gotten stronger.</p>
            </div>
          )}
          <div className="flex flex-col gap-4 mt-3">
            {LIFT_KEYS.map(key => {
              const meta = LIFT_META[key];
              const inp = liftInputs[key];
              const w = parseFloat(inp?.weightKg ?? '');
              const r = parseInt(inp?.reps ?? '', 10);
              const oneRM = w > 0 && r > 0 ? Math.round(epley1RM(w, r)) : null;
              return (
                <div key={key} className="p-4 rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800">{meta.label}</span>
                    {oneRM && (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">~{oneRM} kg 1RM</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2.5">{meta.hint}</p>
                  {key === 'upperPull' && (
                    <div className="flex gap-1.5 mb-3">
                      <button
                        type="button"
                        onClick={() => setUpperPullChoice('pull-up')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          upperPullChoice === 'pull-up'
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Pull-Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpperPullChoice('row')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          upperPullChoice === 'row'
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Row
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 100"
                        value={inp?.weightKg ?? ''}
                        onChange={e => setLiftField(key, 'weightKg', e.target.value)}
                        style={{ fontSize: '16px' }}
                        className="w-full text-center font-bold border-2 border-gray-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Reps</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        placeholder="e.g. 5"
                        value={inp?.reps ?? ''}
                        onChange={e => setLiftField(key, 'reps', e.target.value)}
                        style={{ fontSize: '16px' }}
                        className="w-full text-center font-bold border-2 border-gray-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 text-center mt-3 pb-2">All fields are optional — you can set these later from your programme.</p>
        </div>
      )}

      {/* ── Step 5: Duration + Generate ── */}
      {step === 5 && (
        <div>
          <p className="text-sm text-gray-600 mb-5">Choose how long your programme should be. Longer programmes allow more progressive phases. You can always regenerate later.</p>

          {/* Suggested callout */}
          <Card className="p-4 bg-blue-50 border-blue-200 mb-5">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Suggested for your experience</p>
            <p className="text-sm font-bold text-blue-800">{suggestedWeeks} weeks</p>
            <p className="text-xs text-blue-600 mt-1">Based on {userProfile.experienceYears} years of training — enough time to complete a full progressive overload cycle.</p>
          </Card>

          {/* Preset chips */}
          <p className="text-sm font-semibold text-gray-700 mb-3">Select a duration</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {DURATION_PRESETS.map(w => (
              <button
                key={w}
                onClick={() => { setProgramDuration(w); setCustomDurStr(''); }}
                className={`py-4 rounded-xl border-2 text-center transition-all ${
                  programDuration === w && customDurStr === ''
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-xl font-black">{w}</div>
                <div className="text-xs text-gray-500 mt-0.5">weeks</div>
                {w === suggestedWeeks && <div className="text-[10px] font-bold text-brand-500 mt-1">Suggested</div>}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">Custom length</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="16"
                placeholder="e.g. 10"
                value={customDurStr}
                onChange={e => {
                  const val = e.target.value;
                  setCustomDurStr(val);
                  const n = parseInt(val, 10);
                  if (!isNaN(n) && n >= 1 && n <= 16) setProgramDuration(n);
                }}
                style={{ fontSize: '16px' }}
                className="w-24 text-center text-lg font-bold border-2 border-gray-200 rounded-xl py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <span className="text-sm text-gray-500 font-medium">weeks (1–16)</span>
            </div>
          </div>

          <div className="mb-2 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">Selected: <span className="font-bold text-gray-800">{programDuration} weeks</span> · {sessionsPerWeek} sessions/week</p>
          </div>

          <Button fullWidth size="lg" onClick={handleGenerate}>
            <Zap size={18} />
            Generate My Program
          </Button>
          <p className="text-center text-xs text-gray-400 mt-2 pb-6">
            {programDuration} weeks · {sessionsPerWeek} sessions/week
          </p>
        </div>
      )}

      {step < totalSteps - 1 && (
        <div className="mt-8 pb-8">
          <Button fullWidth size="lg" onClick={() => setStep(s => s + 1)} disabled={!canNext}>
            Next <ChevronRight size={18} />
          </Button>
        </div>
      )}
    </Layout>
  );
}
