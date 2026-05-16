import { useState } from 'react';
import type React from 'react';

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
import { ChevronLeft, ChevronRight, Trash2, Calendar, Info, ArrowRightLeft, AlertTriangle, X } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { useStore } from '../../hooks/useStore';
import { MatchEntry, GeneratedProgramme } from '../../types';
import { classifyDay, getLoadProfile, getMonthProfiles } from '../../lib/loadManagement';

// ── Session dot type ───────────────────────────────────────────────────────

interface SessionDot {
  sessionKey: string;   // "wi-dayOfWeek"
  objective: string;
  originalDate: string;
  mdDay: string;
  type: 'gym' | 'conditioning';
}

// ── Session type classifier ────────────────────────────────────────────────

function classifySessionType(objective: string, mdDay: string): 'gym' | 'conditioning' {
  const obj = objective.toLowerCase();
  const md = mdDay.toLowerCase();
  // Explicit conditioning mdDay values from the generator
  if (md === 'md+1' || md === 'conditioning') return 'conditioning';
  // Objective-based fallbacks (recovery sessions, speed/cardio sessions)
  if (
    obj.includes('active recovery') ||
    obj.includes('conditioning session') ||
    obj.includes('speed session') ||
    obj.includes('cardio')
  ) return 'conditioning';
  return 'gym';
}

// ── Programme session date helpers ─────────────────────────────────────────

const DOW_INDEX: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function getStartMonday(ts: number): Date {
  const d = new Date(ts);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getProgrammeDates(programme: GeneratedProgramme): Map<string, SessionDot[]> {
  const monday = getStartMonday(programme.createdAt);
  const overrides = programme.sessionOverrides ?? {};
  const map = new Map<string, SessionDot[]>();

  programme.weeks.forEach((week, wi) => {
    week.sessions.forEach((session, si) => {
      // Use session index (not dayOfWeek) so two sessions on the same day get unique keys
      const sessionKey = `${wi}-${si}`;
      const dayIdx = DOW_INDEX[session.dayOfWeek] ?? 0;
      const d = new Date(monday);
      d.setDate(monday.getDate() + wi * 7 + dayIdx);
      const originalDate = localDateStr(d);
      const effectiveDate = overrides[sessionKey] ?? originalDate;

      const dot: SessionDot = {
        sessionKey,
        objective: session.objective,
        originalDate,
        mdDay: session.mdDay,
        type: classifySessionType(session.objective, session.mdDay),
      };
      const existing = map.get(effectiveDate) ?? [];
      map.set(effectiveDate, [...existing, dot]);
    });
  });

  return map;
}

interface LoadCalendarProps {
  onBack: () => void;
  activeProgramme?: GeneratedProgramme | null;
  onUpdateProgramme?: (programme: GeneratedProgramme) => void;
}

// ── Risky day check ────────────────────────────────────────────────────────

function isRiskyDay(dateStr: string, matchEntries: MatchEntry[]): { risky: boolean; reason: string } {
  const day = classifyDay(dateStr, matchEntries);
  if (day === 'MD') return { risky: true, reason: 'Match Day — training here will exhaust you before kick-off' };
  if (day === 'MD-1') return { risky: true, reason: 'Day Before Match — heavy sessions impair match performance' };
  if (day === 'MD+1') return { risky: true, reason: 'Day After Match — muscles are still recovering, injury risk is high' };
  return { risky: false, reason: '' };
}

// ── Session colour config ──────────────────────────────────────────────────

const SESSION_STYLE = {
  gym: {
    bg: 'bg-orange-500',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    label: '💪 Gym',
  },
  conditioning: {
    bg: 'bg-emerald-500',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    label: '🏃 Conditioning',
  },
};

// ── Month calendar grid ────────────────────────────────────────────────────

function MonthlyCalendarGrid({
  year,
  month,
  matchEntries,
  programmeDates,
  onSelectDay,
  dragKey,
  dropTarget,
  onSessionDragStart,
  onDragEnd,
  onCellDragOver,
  onCellDrop,
}: {
  year: number;
  month: number;
  matchEntries: MatchEntry[];
  programmeDates: Map<string, SessionDot[]>;
  onSelectDay: (date: string) => void;
  dragKey: string | null;
  dropTarget: string | null;
  onSessionDragStart: (sessionKey: string) => void;
  onDragEnd: () => void;
  onCellDragOver: (date: string, e: React.DragEvent) => void;
  onCellDrop: (date: string, e: React.DragEvent) => void;
}) {
  const days = getMonthProfiles(matchEntries, year, month);
  const firstDow = days[0]?.dayOfWeek ?? 0;
  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const paddingCells = Array(firstDow).fill(null);
  const allCells = [...paddingCells, ...days];
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
          const sessions = programmeDates.get(date) ?? [];
          const gymSessions = sessions.filter(s => s.type === 'gym');
          const condSessions = sessions.filter(s => s.type === 'conditioning');
          const isDropTarget = dropTarget === date;

          return (
            <div
              key={date}
              onClick={() => onSelectDay(date)}
              onDragOver={(e) => onCellDragOver(date, e)}
              onDrop={(e) => onCellDrop(date, e)}
              className={`aspect-square flex flex-col rounded-lg border overflow-hidden cursor-pointer transition-all ${
                isToday ? 'ring-2 ring-brand-500' : ''
              } ${
                isDropTarget
                  ? 'ring-2 ring-brand-400 border-brand-400 scale-105'
                  : matchEntry
                  ? 'bg-red-50 border-red-300'
                  : trainingEntry
                  ? 'bg-blue-50 border-blue-300'
                  : profile.day !== 'free'
                  ? `${profile.bgColour} ${profile.borderColour}`
                  : sessions.length > 0
                  ? 'bg-white border-gray-200'
                  : 'bg-white border-gray-100 hover:bg-gray-50'
              }`}
            >
              {/* Day number */}
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-xs font-bold leading-none ${
                  isToday ? 'text-brand-600' :
                  matchEntry ? 'text-red-700' :
                  trainingEntry ? 'text-blue-700' :
                  profile.day !== 'free' ? profile.textColour :
                  'text-gray-700'
                }`}>
                  {dayNum}
                </span>
                {matchEntry && <span className="text-[9px] ml-0.5">⚽</span>}
                {!matchEntry && trainingEntry && <span className="text-[9px] ml-0.5">🏃</span>}
                {!matchEntry && !trainingEntry && profile.day !== 'free' && sessions.length === 0 && (
                  <span className={`text-[9px] ml-0.5 font-bold ${profile.textColour}`}>{profile.shortLabel}</span>
                )}
              </div>

              {/* Bottom 60%: coloured session strips */}
              {sessions.length > 0 && (
                <div className="h-[60%] flex gap-px">
                  {gymSessions.map(s => (
                    <div
                      key={s.sessionKey}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', s.sessionKey);
                        e.dataTransfer.effectAllowed = 'move';
                        onSessionDragStart(s.sessionKey);
                      }}
                      onDragEnd={onDragEnd}
                      className={`flex-1 bg-orange-500 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none ${s.sessionKey === dragKey ? 'opacity-40' : ''}`}
                      title="Gym — drag to move"
                    >
                      <span className="text-[9px] leading-none">💪</span>
                      <span className="text-white font-bold leading-none mt-0.5" style={{ fontSize: '7px' }}>GYM</span>
                    </div>
                  ))}
                  {condSessions.map(s => (
                    <div
                      key={s.sessionKey}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', s.sessionKey);
                        e.dataTransfer.effectAllowed = 'move';
                        onSessionDragStart(s.sessionKey);
                      }}
                      onDragEnd={onDragEnd}
                      className={`flex-1 bg-emerald-500 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none ${s.sessionKey === dragKey ? 'opacity-40' : ''}`}
                      title="Conditioning — drag to move"
                    >
                      <span className="text-[9px] leading-none">🏃</span>
                      <span className="text-white font-bold leading-none mt-0.5" style={{ fontSize: '7px' }}>COND</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overload warning confirm ───────────────────────────────────────────────

function OverloadWarningModal({
  reason,
  onConfirm,
  onCancel,
}: {
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-6">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">⚠️ Overload / Injury Risk</h3>
            <p className="text-xs text-gray-600">{reason}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-5">Moving this session to this date significantly increases injury risk and may impair performance. Are you sure?</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
          >
            Move Anyway
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Day modal ──────────────────────────────────────────────────────────────

function DayModal({
  dateStr,
  matchEntries,
  programmeSessions,
  onSave,
  onDelete,
  onClose,
  onMoveSession,
}: {
  dateStr: string;
  matchEntries: MatchEntry[];
  programmeSessions: SessionDot[];
  onSave: (entry: MatchEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onMoveSession: (sessionKey: string, newDate: string) => void;
}) {
  const existing = matchEntries.find(e => e.date === dateStr);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [minutes, setMinutes] = useState<string>(existing?.minutes?.toString() ?? '');
  const [movingSession, setMovingSession] = useState<SessionDot | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState('');

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

  const handlePickDate = (sessionKey: string, newDate: string) => {
    const { risky, reason } = isRiskyDay(newDate, matchEntries);
    if (risky) {
      setWarningReason(reason);
      setShowWarning(true);
      // store pending action
      setMoveTarget(newDate);
    } else {
      onMoveSession(sessionKey, newDate);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 pb-20">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl mb-4 max-h-[90vh] overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={16} className="text-brand-500" />
              <h3 className="font-bold text-gray-900">{displayDate}</h3>
            </div>

            {loadDay !== 'free' && (
              <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg mb-3 flex items-center gap-1.5 border ${loadProfile.bgColour} ${loadProfile.textColour} ${loadProfile.borderColour}`}>
                <span>{loadProfile.emoji}</span>
                <span>{loadProfile.label} — {loadProfile.shortLabel}</span>
              </div>
            )}

            {/* Programme sessions */}
            {programmeSessions.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {programmeSessions.map(s => {
                  const style = SESSION_STYLE[s.type];
                  const moved = s.originalDate !== dateStr;
                  return (
                    <div key={s.sessionKey}>
                      <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${style.lightBg} border ${style.border}`}>
                        <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${style.bg}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold ${style.text}`}>{style.label}{moved ? ' (moved)' : ''}</p>
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{s.objective}</p>
                          {moved && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Originally: {new Date(s.originalDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setMovingSession(movingSession?.sessionKey === s.sessionKey ? null : s)}
                          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            movingSession?.sessionKey === s.sessionKey
                              ? `${style.bg} text-white`
                              : `${style.lightBg} ${style.text} hover:opacity-80`
                          }`}
                        >
                          <ArrowRightLeft size={11} />
                          Move
                        </button>
                      </div>

                      {movingSession?.sessionKey === s.sessionKey && (
                        <div className="mt-1.5 px-3 py-3 rounded-xl bg-gray-50 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Move to date:</p>
                          <input
                            type="date"
                            defaultValue={s.originalDate}
                            style={{ fontSize: '16px' }}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 mb-2"
                            onChange={(e) => {
                              if (e.target.value) handlePickDate(s.sessionKey, e.target.value);
                            }}
                          />
                          <button onClick={() => setMovingSession(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <X size={11} /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                style={{ fontSize: '16px' }}
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
                style={{ fontSize: '16px' }}
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
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {showWarning && movingSession && (
        <OverloadWarningModal
          reason={warningReason}
          onConfirm={() => {
            onMoveSession(movingSession.sessionKey, moveTarget);
            setShowWarning(false);
            onClose();
          }}
          onCancel={() => setShowWarning(false)}
        />
      )}
    </>
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
      'Monitor RIR — if soreness is high, stay conservative',
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

export function LoadCalendar({ onBack, activeProgramme, onUpdateProgramme }: LoadCalendarProps) {
  const { matchEntries, saveMatchEntry, deleteMatchEntry } = useStore();
  const programmeDates = activeProgramme ? getProgrammeDates(activeProgramme) : new Map<string, SessionDot[]>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Drag state
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ sessionKey: string; newDate: string; reason: string } | null>(null);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleMoveSession = (sessionKey: string, newDate: string) => {
    if (!activeProgramme || !onUpdateProgramme) return;
    const overrides = { ...(activeProgramme.sessionOverrides ?? {}), [sessionKey]: newDate };
    onUpdateProgramme({ ...activeProgramme, sessionOverrides: overrides });
    setSelectedDate(null);
  };

  const handleCellDrop = (toDate: string, e: React.DragEvent) => {
    e.preventDefault();
    // Read sessionKey from dataTransfer — more reliable than React state which may be stale
    const sessionKey = e.dataTransfer.getData('text/plain');
    if (!sessionKey) return;
    setDropTarget(null);
    setDragKey(null);
    const { risky, reason } = isRiskyDay(toDate, matchEntries);
    if (risky) {
      setPendingMove({ sessionKey, newDate: toDate, reason });
    } else {
      handleMoveSession(sessionKey, toDate);
    }
  };

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

      <Card className="p-3 mb-4">
        <MonthlyCalendarGrid
          year={viewYear}
          month={viewMonth}
          matchEntries={matchEntries}
          programmeDates={programmeDates}
          onSelectDay={setSelectedDate}
          dragKey={dragKey}
          dropTarget={dropTarget}
          onSessionDragStart={(key) => setDragKey(key)}
          onDragEnd={() => { setDragKey(null); setDropTarget(null); }}
          onCellDragOver={(date, e) => { e.preventDefault(); setDropTarget(date); }}
          onCellDrop={(date, e) => handleCellDrop(date, e)}
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
        {programmeDates.size > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold bg-orange-50 text-orange-700 border-orange-200">
              <div className="w-2 h-2 rounded-sm bg-orange-500" />
              Gym
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              Conditioning
            </div>
          </>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center mb-5">
        Tap any day to mark a match or training · Drag purple/green strips to reschedule
      </div>

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

      <PeriodisationGuide />

      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          matchEntries={matchEntries}
          programmeSessions={programmeDates.get(selectedDate) ?? []}
          onSave={saveMatchEntry}
          onDelete={deleteMatchEntry}
          onClose={() => setSelectedDate(null)}
          onMoveSession={handleMoveSession}
        />
      )}

      {pendingMove && (
        <OverloadWarningModal
          reason={pendingMove.reason}
          onConfirm={() => {
            handleMoveSession(pendingMove.sessionKey, pendingMove.newDate);
            setPendingMove(null);
          }}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </Layout>
  );
}
