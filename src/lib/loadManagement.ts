/**
 * Match load management
 *
 * Classifies any calendar date relative to the nearest upcoming match,
 * then returns a full training profile (volume multiplier, guidance, colour).
 *
 * Classification window:
 *   MD-3  → full load, high intensity
 *   MD-2  → moderate load, power OK, no conditioning
 *   MD-1  → low load, speed activation only
 *   MD    → match day, gym = off
 *   MD+1  → recovery, active only
 *   MD+2  → reload, 50% load
 *   free  → standard training day (no match within the window)
 */

import { MatchEntry, LoadDay } from '../types';

export interface LoadProfile {
  day: LoadDay;
  label: string;
  shortLabel: string;
  emoji: string;
  textColour: string;
  bgColour: string;
  borderColour: string;
  volumeMultiplier: number;   // 0–1.0, fraction of normal session volume
  guidance: string;           // one-liner shown on dashboard
  sessionFocus: string;       // detail shown on load calendar
}

const PROFILES: Record<LoadDay, LoadProfile> = {
  MD: {
    day: 'MD', label: 'Match Day', shortLabel: 'MD', emoji: '⚽',
    textColour: 'text-red-700', bgColour: 'bg-red-50', borderColour: 'border-red-200',
    volumeMultiplier: 0,
    guidance: 'Match day — no gym work today.',
    sessionFocus: 'Dynamic activation only. No loaded exercises.',
  },
  'MD-1': {
    day: 'MD-1', label: 'Day Before Match', shortLabel: 'MD-1', emoji: '🔥',
    textColour: 'text-orange-700', bgColour: 'bg-orange-50', borderColour: 'border-orange-200',
    volumeMultiplier: 0.3,
    guidance: 'Low load — stay sharp, avoid fatigue.',
    sessionFocus: 'Speed activation: 2–3 short sprints, light plyos, no barbell work.',
  },
  'MD-2': {
    day: 'MD-2', label: '2 Days Before Match', shortLabel: 'MD-2', emoji: '⚡',
    textColour: 'text-yellow-700', bgColour: 'bg-yellow-50', borderColour: 'border-yellow-200',
    volumeMultiplier: 0.6,
    guidance: 'Moderate load — power work fine, avoid conditioning.',
    sessionFocus: 'Power & strength: 3–4 sets per exercise, no AMRAP or conditioning runs.',
  },
  'MD-3': {
    day: 'MD-3', label: '3 Days Before Match', shortLabel: 'MD-3', emoji: '💪',
    textColour: 'text-blue-700', bgColour: 'bg-blue-50', borderColour: 'border-blue-200',
    volumeMultiplier: 1.0,
    guidance: 'High load — push hard. Full recovery before match.',
    sessionFocus: 'Full strength & power session. Maximum training stimulus.',
  },
  'MD+1': {
    day: 'MD+1', label: 'Day After Match', shortLabel: 'MD+1', emoji: '🛌',
    textColour: 'text-purple-700', bgColour: 'bg-purple-50', borderColour: 'border-purple-200',
    volumeMultiplier: 0.2,
    guidance: 'Recovery day — active recovery only.',
    sessionFocus: 'Walk, swim, or mobility work. No loaded exercises.',
  },
  'MD+2': {
    day: 'MD+2', label: '2 Days After Match', shortLabel: 'MD+2', emoji: '🔄',
    textColour: 'text-indigo-700', bgColour: 'bg-indigo-50', borderColour: 'border-indigo-200',
    volumeMultiplier: 0.5,
    guidance: 'Reload — begin rebuilding at reduced load.',
    sessionFocus: 'Strength maintenance: 2–3 sets, 60–70% normal intensity.',
  },
  free: {
    day: 'free', label: 'Training Day', shortLabel: '', emoji: '🏋️',
    textColour: 'text-gray-600', bgColour: 'bg-gray-50', borderColour: 'border-gray-200',
    volumeMultiplier: 0.85,
    guidance: 'Standard training day — follow your plan.',
    sessionFocus: 'Full programme as prescribed.',
  },
};

/**
 * Classify a date string (YYYY-MM-DD) relative to the nearest match.
 * Uses the nearest upcoming match first, then nearest past match as fallback.
 */
export function classifyDay(dateStr: string, matchEntries: MatchEntry[]): LoadDay {
  const matchDates = matchEntries
    .filter(e => e.type === 'match')
    .map(e => new Date(e.date + 'T12:00:00'));

  if (!matchDates.length) return 'free';

  const target = new Date(dateStr + 'T12:00:00');
  const MS_PER_DAY = 86_400_000;

  let nearestDays = Infinity;
  for (const m of matchDates) {
    const days = Math.round((target.getTime() - m.getTime()) / MS_PER_DAY);
    if (Math.abs(days) < Math.abs(nearestDays)) nearestDays = days;
  }

  switch (nearestDays) {
    case 0:  return 'MD';
    case -1: return 'MD-1';
    case -2: return 'MD-2';
    case -3: return 'MD-3';
    case 1:  return 'MD+1';
    case 2:  return 'MD+2';
    default: return 'free';
  }
}

export function getLoadProfile(day: LoadDay): LoadProfile {
  return PROFILES[day];
}

export function getTodayProfile(matchEntries: MatchEntry[]): LoadProfile {
  const today = new Date().toISOString().split('T')[0];
  return PROFILES[classifyDay(today, matchEntries)];
}

/**
 * Returns load profiles for every day in a given calendar month.
 * dayOfWeek: 0=Mon … 6=Sun (ISO week order)
 */
export function getMonthProfiles(
  matchEntries: MatchEntry[],
  year: number,
  month: number, // 0-indexed
): Array<{ date: string; dayNum: number; dayOfWeek: number; isToday: boolean; profile: LoadProfile; matchEntry?: MatchEntry; trainingEntry?: MatchEntry }> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const matchEntry = matchEntries.find(e => e.date === dateStr && e.type === 'match');
    const trainingEntry = matchEntries.find(e => e.date === dateStr && e.type === 'team_training');
    return {
      date: dateStr,
      dayNum: d.getDate(),
      dayOfWeek: (d.getDay() + 6) % 7, // 0=Mon, 6=Sun
      isToday: dateStr === todayStr,
      profile: PROFILES[classifyDay(dateStr, matchEntries)],
      matchEntry,
      trainingEntry,
    };
  });
}

/**
 * Returns load profiles for each day of a two-week window
 * starting from the Monday of the current week.
 */
export function getTwoWeekProfiles(
  matchEntries: MatchEntry[],
): Array<{ date: string; dayLabel: string; dayNum: number; isToday: boolean; profile: LoadProfile }> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: dateStr,
      dayLabel: SHORT_DAYS[i % 7],
      dayNum: d.getDate(),
      isToday: dateStr === todayStr,
      profile: PROFILES[classifyDay(dateStr, matchEntries)],
    };
  });
}
