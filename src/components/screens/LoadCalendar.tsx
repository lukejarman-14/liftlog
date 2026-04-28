import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { useStore } from '../../hooks/useStore';
import { MatchEntry, NavState } from '../../types';
import { getTwoWeekProfiles, getTodayProfile, LoadProfile } from '../../lib/loadManagement';

interface LoadCalendarProps {
  onNavigate: (nav: NavState) => void;
  onBack: () => void;
}

// ── Load badge ─────────────────────────────────────────────────────────────

function LoadBadge({ profile, small = false }: { profile: LoadProfile; small?: boolean }) {
  if (profile.day === 'free' && !profile.shortLabel) {
    return small ? null : <span className="text-xs text-gray-300">—</span>;
  }
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md border ${profile.bgColour} ${profile.textColour} ${profile.borderColour}`}>
      {profile.shortLabel || profile.emoji}
    </span>
  );
}

// ── Calendar grid ──────────────────────────────────────────────────────────

function CalendarGrid({
  weekOffset,
  matchEntries,
  onToggleMatch,
}: {
  weekOffset: number;
  matchEntries: MatchEntry[];
  onToggleMatch: (dateStr: string) => void;
}) {
  const allDays = getTwoWeekProfiles(matchEntries);
  // weekOffset 0 = current week (days 0–6), 1 = next week (days 7–13)
  const days = allDays.slice(weekOffset * 7, weekOffset * 7 + 7);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map(({ date, dayLabel, dayNum, isToday, profile }) => {
        const matchEntry = matchEntries.find(e => e.date === date && e.type === 'match');
        const trainingEntry = matchEntries.find(e => e.date === date && e.type === 'team_training');

        return (
          <button
            key={date}
            onClick={() => onToggleMatch(date)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
              isToday
                ? 'border-brand-400 bg-brand-50'
                : matchEntry
                ? 'border-red-300 bg-red-50'
                : trainingEntry
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <span className={`text-xs font-semibold ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>
              {dayLabel}
            </span>
            <span className={`text-sm font-bold ${
              isToday ? 'text-brand-600' :
              matchEntry ? 'text-red-600' :
              trainingEntry ? 'text-blue-600' :
              'text-gray-700'
            }`}>
              {dayNum}
            </span>
            {matchEntry && <span className="text-xs">⚽</span>}
            {trainingEntry && !matchEntry && <span className="text-xs">🏃</span>}
            {!matchEntry && !trainingEntry && (
              <LoadBadge profile={profile} small />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Toggle modal ───────────────────────────────────────────────────────────

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

  const d = new Date(dateStr + 'T12:00:00');
  const displayDate = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleSave = (type: MatchEntry['type']) => {
    const entry: MatchEntry = {
      id: existing?.id ?? `match-${dateStr}`,
      date: dateStr,
      type,
      label: label.trim() || undefined,
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
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-brand-500" />
          <h3 className="font-bold text-gray-900">{displayDate}</h3>
        </div>

        {existing && (
          <div className={`text-xs font-semibold px-2 py-1 rounded-full mb-4 w-max ${
            existing.type === 'match' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {existing.type === 'match' ? '⚽ Match' : '🏃 Team Training'}
            {existing.label && ` — ${existing.label}`}
          </div>
        )}

        <div className="mb-4">
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

// ── Main ───────────────────────────────────────────────────────────────────

export function LoadCalendar({ onNavigate: _onNavigate, onBack }: LoadCalendarProps) {
  const { matchEntries, saveMatchEntry, deleteMatchEntry } = useStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayProfile = getTodayProfile(matchEntries);

  const handleToggle = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  // Upcoming matches (next 14 days)
  const upcoming = matchEntries
    .filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      const today = new Date();
      const diff = (d.getTime() - today.getTime()) / 86400000;
      return diff >= -1 && diff <= 14;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Layout title="Match Load" onBack={onBack}>

      {/* Today's load card */}
      <Card className={`p-4 mb-5 border-2 ${todayProfile.borderColour} ${todayProfile.bgColour}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{todayProfile.emoji}</span>
              <span className={`text-sm font-bold ${todayProfile.textColour}`}>
                Today — {todayProfile.label}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${todayProfile.textColour} opacity-80`}>
              {todayProfile.guidance}
            </p>
          </div>
          {todayProfile.volumeMultiplier > 0 && (
            <div className={`text-center px-2.5 py-1.5 rounded-xl ${todayProfile.bgColour} border ${todayProfile.borderColour}`}>
              <div className={`text-base font-extrabold ${todayProfile.textColour}`}>
                {Math.round(todayProfile.volumeMultiplier * 100)}%
              </div>
              <div className="text-xs text-gray-400">load</div>
            </div>
          )}
        </div>
        {todayProfile.sessionFocus !== todayProfile.guidance && (
          <div className={`mt-2 pt-2 border-t ${todayProfile.borderColour}`}>
            <p className={`text-xs ${todayProfile.textColour} opacity-70 leading-relaxed`}>
              {todayProfile.sessionFocus}
            </p>
          </div>
        )}
      </Card>

      {/* Calendar header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">
          {weekOffset === 0 ? 'This Week' : 'Next Week'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setWeekOffset(1)}
            disabled={weekOffset === 1}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <Card className="p-3 mb-4">
        <CalendarGrid
          weekOffset={weekOffset}
          matchEntries={matchEntries}
          onToggleMatch={handleToggle}
        />
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: 'MD-3', desc: 'Full load', col: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'MD-2', desc: 'Moderate', col: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'MD-1', desc: 'Low load', col: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'MD', desc: 'Match', col: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'MD+1', desc: 'Recovery', col: 'bg-purple-50 text-purple-700 border-purple-200' },
        ].map(item => (
          <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold ${item.col}`}>
            {item.label}
            <span className="font-normal opacity-70">{item.desc}</span>
          </div>
        ))}
      </div>

      {/* Tap to add reminder */}
      <div className="text-xs text-gray-400 text-center mb-5 flex items-center justify-center gap-1.5">
        <Plus size={11} />
        Tap any day to mark a match or team training session
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <section>
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
                      <div className="text-xs text-gray-400">{label}</div>
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
