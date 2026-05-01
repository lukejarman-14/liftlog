import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Calendar, Info } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { useStore } from '../../hooks/useStore';
import { MatchEntry, NavState } from '../../types';
import { classifyDay, getLoadProfile, getMonthProfiles } from '../../lib/loadManagement';

interface LoadCalendarProps {
  onNavigate: (nav: NavState) => void;
  onBack: () => void;
}

// ── Month calendar grid ────────────────────────────────────────────────────

function MonthlyCalendarGrid({
  year,
  month,
  matchEntries,
  onSelectDay,
}: {
  year: number;
  month: number;
  matchEntries: MatchEntry[];
  onSelectDay: (date: string) => void;
}) {
  const days = getMonthProfiles(matchEntries, year, month);
  const firstDow = days[0]?.dayOfWeek ?? 0; // 0=Mon padding cells

  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Pad cells before first day of month
  const paddingCells = Array(firstDow).fill(null);
  const allCells = [...paddingCells, ...days];
  // Pad to complete last row
  while (allCells.length % 7 !== 0) allCells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {allCells.map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square" />;
          const { date, dayNum, isToday, profile, matchEntry, trainingEntry } = cell;
          return (
            <button
              key={date}
              onClick={() => onSelectDay(date)}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all ${
                isToday ? 'ring-2 ring-brand-500' : ''
              } ${
                matchEntry
                  ? 'bg-red-50 border border-red-300'
                  : trainingEntry
                  ? 'bg-blue-50 border border-blue-300'
                  : profile.day !== 'free'
                  ? `${profile.bgColour} border ${profile.borderColour}`
                  : 'bg-white border border-gray-100 hover:bg-gray-50'
              }`}
            >
              <span className={`font-bold leading-none mb-0.5 ${
                isToday ? 'text-brand-600' :
                matchEntry ? 'text-red-700' :
                trainingEntry ? 'text-blue-700' :
                profile.day !== 'free' ? profile.textColour :
                'text-gray-700'
              }`}>
                {dayNum}
              </span>
              {matchEntry && <span className="text-[9px] leading-none">⚽</span>}
              {!matchEntry && trainingEntry && <span className="text-[9px] leading-none">🏃</span>}
              {!matchEntry && !trainingEntry && profile.day !== 'free' && (
                <span className={`text-[8px] font-bold leading-none ${profile.textColour}`}>
                  {profile.shortLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day modal ──────────────────────────────────────────────────────────────

function DayModal({
  dateStr,
  matchEntries,
  onSave,
  onDelete,
  onClose,
}: {
  dateStr: string;
  matchEntries: MatchEntry[];
  onSave: (entry: MatchEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const existing = matchEntries.find(e => e.date === dateStr);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [minutes, setMinutes] = useState<string>(existing?.minutes?.toString() ?? '');

  const d = new Date(dateStr + 'T12:00:00');
  const displayDate = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const loadDay = classifyDay(dateStr, matchEntries);
  const loadProfile = getLoadProfile(loadDay);

  const handleSave = (type: MatchEntry['type']) => {
    const entry: MatchEntry = {
      id: existing?.id ?? `match-${dateStr}`,
      date: dateStr,
      type,
      label: label.trim() || undefined,
      minutes: minutes ? parseInt(minutes, 10) : undefined,
    };
    onSave(entry);
    onClose();
  };

  const handleDelete = () => {
    if (existing) onDelete(existing.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={16} className="text-brand-500" />
          <h3 className="font-bold text-gray-900">{displayDate}</h3>
        </div>

        {/* Show load profile for this day */}
        {loadDay !== 'free' && (
          <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg mb-4 flex items-center gap-1.5 border ${loadProfile.bgColour} ${loadProfile.textColour} ${loadProfile.borderColour}`}>
            <span>{loadProfile.emoji}</span>
            <span>{loadProfile.label} — {loadProfile.shortLabel}</span>
          </div>
        )}

        {existing && (
          <div className={`text-xs font-semibold px-2 py-1 rounded-full mb-4 w-max ${
            existing.type === 'match' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {existing.type === 'match' ? '⚽ Match' : '🏃 Team Training'}
            {existing.label && ` — ${existing.label}`}
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Label (optional)
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. League vs City FC"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Minutes played (optional)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            placeholder="e.g. 90"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="text-xs text-gray-400 mt-1">Used to auto-adjust recovery session load</p>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <button
            onClick={() => handleSave('match')}
            className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
          >
            ⚽ Mark as Match Day
          </button>
          <button
            onClick={() => handleSave('team_training')}
            className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors"
          >
            🏃 Mark as Team Training
          </button>
        </div>

        {existing && (
          <button
            onClick={handleDelete}
            className="w-full py-2 text-sm text-red-400 hover:text-red-600 flex items-center justify-center gap-1.5 mb-2"
          >
            <Trash2 size={13} />
            Remove this entry
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Periodisation explanations ─────────────────────────────────────────────

const PERIOD_INFO = [
  {
    label: 'MD-3', emoji: '💪', colour: 'bg-blue-50 border-blue-200 text-blue-800',
    title: '3 Days Before Match — Full Load',
    bullets: [
      'Maximum training stimulus — heavy compound lifts, full volume',
      'Sufficient recovery time before match day (72 h)',
      'Target: strength and power adaptations',
      'Conditioning runs and high-speed work permitted',
    ],
  },
  {
    label: 'MD-2', emoji: '⚡', colour: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    title: '2 Days Before Match — Moderate Load',
    bullets: [
      'Power work is fine — explosive lifts, jumps, sprint technique',
      'Avoid high-rep conditioning or AMRAP sets',
      'Cap volume: 3–4 sets per exercise maximum',
      'Focus on neural activation, not muscle fatigue',
    ],
  },
  {
    label: 'MD-1', emoji: '🔥', colour: 'bg-orange-50 border-orange-200 text-orange-800',
    title: 'Day Before Match — Low Load',
    bullets: [
      'Neural priming only — 2–3 short acceleration sprints',
      'Light plyometrics (box jumps, broad jumps) at low volume',
      'No barbell work, no conditioning runs',
      'Goal: feel sharp and fresh for tomorrow',
    ],
  },
  {
    label: 'MD', emoji: '⚽', colour: 'bg-red-50 border-red-200 text-red-800',
    title: 'Match Day — No Gym',
    bullets: [
      'Dynamic activation only if desired (10 min)',
      'No loaded exercises — conserve all energy for the match',
      'Pre-match nutrition and sleep are the priority',
    ],
  },
  {
    label: 'MD+1', emoji: '🛌', colour: 'bg-purple-50 border-purple-200 text-purple-800',
    title: 'Day After Match — Active Recovery',
    bullets: [
      'Flush out metabolic waste — walk, swim, light cycle',
      'No loaded exercises or high-intensity work',
      'Mobility and soft-tissue work (foam roll, stretch)',
      'Hydration and nutrition replenishment priority',
    ],
  },
  {
    label: 'MD+2', emoji: '🔄', colour: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    title: '2 Days After Match — Reload',
    bullets: [
      'Begin rebuilding at 60–70% normal intensity',
      'Keep volume low: 2–3 sets per exercise',
      'Eccentric-focused movements to restore muscle resilience',
      'Monitor RPE — if soreness is high, stay conservative',
    ],
  },
  {
    label: 'MD+3', emoji: '🏋️', colour: 'bg-teal-50 border-teal-200 text-teal-800',
    title: '3 Days After Match — Return to Load',
    bullets: [
      'Full programme can resume if well recovered',
      'This often aligns with MD-3 of the next match week',
      'Good day for heavy compound work and high volume',
      'Monitor for residual fatigue before pushing hard',
    ],
  },
];

function PeriodisationGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info size={16} className="text-brand-500" />
          <span className="text-sm font-semibold text-gray-800">Periodisation Guide</span>
        </div>
        <ChevronRight size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-3">
          {PERIOD_INFO.map(item => (
            <div key={item.label} className={`p-4 rounded-2xl border ${item.colour}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{item.emoji}</span>
                <span className="text-xs font-extrabold tracking-wide">{item.label}</span>
                <span className="text-xs font-semibold">{item.title}</span>
              </div>
              <ul className="space-y-1">
                {item.bullets.map((b, i) => (
                  <li key={i} className="text-xs flex gap-2">
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function LoadCalendar({ onNavigate: _onNavigate, onBack }: LoadCalendarProps) {
  const { matchEntries, saveMatchEntry, deleteMatchEntry } = useStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Upcoming events (next 30 days)
  const upcoming = matchEntries
    .filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      const diff = (d.getTime() - today.getTime()) / 86400000;
      return diff >= -1 && diff <= 30;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Layout title="Match Load" onBack={onBack}>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-base font-bold text-gray-900">{MONTHS[viewMonth]} {viewYear}</h2>
        <button onClick={nextMonth} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Monthly calendar grid */}
      <Card className="p-3 mb-4">
        <MonthlyCalendarGrid
          year={viewYear}
          month={viewMonth}
          matchEntries={matchEntries}
          onSelectDay={setSelectedDate}
        />
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: 'MD3', desc: 'Full load', col: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'MD2', desc: 'Moderate', col: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'MD1', desc: 'Low load', col: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'MD', desc: 'Match', col: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'MD+1', desc: 'Recovery', col: 'bg-purple-50 text-purple-700 border-purple-200' },
          { label: 'MD+2', desc: 'Reload', col: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        ].map(item => (
          <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold ${item.col}`}>
            {item.label}
            <span className="font-normal opacity-70">{item.desc}</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center mb-5">
        Tap any day to mark a match or team training session
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h3>
          <div className="flex flex-col gap-2">
            {upcoming.map(entry => {
              const d = new Date(entry.date + 'T12:00:00');
              const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <Card key={entry.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{entry.type === 'match' ? '⚽' : '🏃'}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">
                        {entry.type === 'match' ? 'Match' : 'Team Training'}
                        {entry.label && <span className="font-normal text-gray-500"> — {entry.label}</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {label}
                        {entry.minutes && <span className="ml-2 text-brand-500">{entry.minutes} min</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMatchEntry(entry.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Periodisation guide */}
      <PeriodisationGuide />

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          matchEntries={matchEntries}
          onSave={saveMatchEntry}
          onDelete={deleteMatchEntry}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </Layout>
  );
}
