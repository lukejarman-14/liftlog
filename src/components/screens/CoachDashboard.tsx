import { useState } from 'react';
import {
  Users, Copy, Check, UserPlus, Calendar, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Activity, Dumbbell, ClipboardCheck, LayoutDashboard, History as HistoryIcon,
} from 'lucide-react';

export type Readiness = 'ready' | 'moderate' | 'low' | 'unknown';

export interface TestResult {
  label: string;
  value: string;
  change: string;
  improved: boolean;
}

export interface ActivityEntry {
  date: string;
  label: string;
  rpe?: number;
}

export interface SquadPlayer {
  id: string;
  name: string;
  position: string;
  readiness: Readiness;
  programmeName: string;
  sessionsThisWeek: number;
  sessionsTarget: number;
  lastSessionLabel?: string;
  testing: TestResult[];
  recentActivity: ActivityEntry[];
}

export interface ScheduleDay {
  day: string;
  type: 'match' | 'training' | 'rest';
  label: string;
}

type CoachTab = 'home' | 'schedule' | 'history' | 'tests';

interface CoachDashboardProps {
  coachName: string;
  inviteSeed: string;
  players?: SquadPlayer[];
  schedule?: ScheduleDay[];
  maxPlayers?: number;
  onOpenProfile?: () => void;
}

function deriveInviteCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '', n = hash;
  for (let i = 0; i < 5; i++) { code += alphabet[n % alphabet.length]; n = Math.floor(n / alphabet.length); }
  return `VF-${code}`;
}

const READINESS_DOT: Record<Readiness, string> = {
  ready: 'bg-green-500', moderate: 'bg-amber-400', low: 'bg-red-500', unknown: 'bg-gray-300',
};
const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready today', moderate: 'Moderate', low: 'Low readiness', unknown: 'No data yet',
};
const SCHEDULE_STYLE: Record<ScheduleDay['type'], string> = {
  match: 'bg-brand-500 text-white',
  training: 'bg-brand-100 text-brand-700',
  rest: 'bg-gray-100 text-gray-400',
};
const SCHEDULE_BADGE: Record<ScheduleDay['type'], string> = {
  match: 'bg-brand-500 text-white',
  training: 'bg-brand-100 text-brand-700',
  rest: 'bg-gray-100 text-gray-500',
};

// --- Demo data so the coach view is illustrative in preview ---
export const DEMO_SCHEDULE: ScheduleDay[] = [
  { day: 'Mon', type: 'training', label: 'Team training' },
  { day: 'Tue', type: 'rest', label: 'Rest' },
  { day: 'Wed', type: 'training', label: 'Team training' },
  { day: 'Thu', type: 'rest', label: 'Recovery' },
  { day: 'Fri', type: 'training', label: 'Activation' },
  { day: 'Sat', type: 'match', label: 'vs Eastside FC' },
  { day: 'Sun', type: 'rest', label: 'Rest' },
];

export const DEMO_SQUAD: SquadPlayer[] = [
  {
    id: '1', name: 'Tom Hartley', position: 'Winger', readiness: 'ready',
    programmeName: 'Speed & Power · Wk 3', sessionsThisWeek: 3, sessionsTarget: 3,
    lastSessionLabel: 'Lower Body Power',
    testing: [
      { label: '10m Sprint', value: '1.78s', change: '-0.05s', improved: true },
      { label: 'CMJ', value: '44cm', change: '+3cm', improved: true },
      { label: 'Yo-Yo IR1', value: '18.4', change: '+0.6', improved: true },
    ],
    recentActivity: [
      { date: 'Fri 30 May', label: 'Lower Body Power', rpe: 8 },
      { date: 'Wed 28 May', label: 'Speed & Acceleration', rpe: 7 },
      { date: 'Mon 26 May', label: 'Upper Body Strength', rpe: 6 },
    ],
  },
  {
    id: '2', name: 'Jay Patel', position: 'Centre Back', readiness: 'moderate',
    programmeName: 'Strength Base · Wk 2', sessionsThisWeek: 2, sessionsTarget: 3,
    lastSessionLabel: 'Upper Body Strength',
    testing: [
      { label: '10m Sprint', value: '1.91s', change: '-0.02s', improved: true },
      { label: 'CMJ', value: '38cm', change: '+1cm', improved: true },
      { label: 'Yo-Yo IR1', value: '17.1', change: '-0.2', improved: false },
    ],
    recentActivity: [
      { date: 'Thu 29 May', label: 'Upper Body Strength', rpe: 7 },
      { date: 'Tue 27 May', label: 'Conditioning', rpe: 9 },
    ],
  },
  {
    id: '3', name: 'Sam Okafor', position: 'Striker', readiness: 'low',
    programmeName: 'Power & Conditioning · Wk 4', sessionsThisWeek: 1, sessionsTarget: 3,
    lastSessionLabel: 'Conditioning',
    testing: [
      { label: '10m Sprint', value: '1.74s', change: '-0.01s', improved: true },
      { label: 'CMJ', value: '47cm', change: '+0cm', improved: true },
      { label: 'Yo-Yo IR1', value: '19.0', change: '+0.4', improved: true },
    ],
    recentActivity: [
      { date: 'Mon 26 May', label: 'Conditioning', rpe: 9 },
    ],
  },
  {
    id: '4', name: 'Leo Marsh', position: 'Midfielder', readiness: 'ready',
    programmeName: 'Speed & Power · Wk 3', sessionsThisWeek: 3, sessionsTarget: 3,
    lastSessionLabel: 'Speed & Acceleration',
    testing: [
      { label: '10m Sprint', value: '1.83s', change: '-0.03s', improved: true },
      { label: 'CMJ', value: '41cm', change: '+2cm', improved: true },
      { label: 'Yo-Yo IR1', value: '18.8', change: '+0.8', improved: true },
    ],
    recentActivity: [
      { date: 'Fri 30 May', label: 'Speed & Acceleration', rpe: 7 },
      { date: 'Wed 28 May', label: 'Lower Body Strength', rpe: 8 },
    ],
  },
];

function TestChange({ t }: { t: TestResult }) {
  if (!t.change) return null;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${t.improved ? 'text-green-600' : 'text-red-500'}`}>
      {t.improved ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {t.change}
    </span>
  );
}

export function CoachDashboard({
  coachName,
  inviteSeed,
  players = [],
  schedule = [],
  maxPlayers = 30,
  onOpenProfile,
}: CoachDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<CoachTab>('home');
  const inviteCode = deriveInviteCode(inviteSeed);
  const selected = players.find(p => p.id === selectedId) ?? null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  // ---------- Player detail view (drill-down, no bottom nav) ----------
  if (selected) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <div
          className="bg-gradient-to-b from-brand-600 to-brand-500 text-white px-5 pb-6"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
        >
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1 text-white/80 text-sm font-medium mb-3 hover:text-white"
          >
            <ChevronLeft size={16} /> Squad
          </button>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${READINESS_DOT[selected.readiness]}`} />
            <div>
              <h1 className="text-2xl font-extrabold">{selected.name}</h1>
              <p className="text-white/70 text-sm">{selected.position} · {READINESS_LABEL[selected.readiness]}</p>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto w-full px-5 -mt-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell size={16} className="text-brand-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Their programme</p>
            </div>
            <p className="font-bold text-gray-900">{selected.programmeName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Self-built around your squad schedule · {selected.sessionsThisWeek}/{selected.sessionsTarget} sessions this week
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${(selected.sessionsThisWeek / selected.sessionsTarget) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck size={16} className="text-brand-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Testing & improvements</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {selected.testing.map(t => (
                <div key={t.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{t.value}</span>
                    <TestChange t={t} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-brand-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recent activity</p>
            </div>
            <div className="flex flex-col gap-3">
              {selected.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                    <p className="text-xs text-gray-400">{a.date}</p>
                  </div>
                  {a.rpe != null && (
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">RPE {a.rpe}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Header title per tab
  const tabTitle: Record<CoachTab, string> = {
    home: coachName || 'Your Squad',
    schedule: 'Squad Schedule',
    history: 'Squad History',
    tests: 'Squad Tests',
  };

  // Flatten activity across the squad for the History tab
  const squadActivity = players
    .flatMap(p => p.recentActivity.map(a => ({ ...a, player: p.name })))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div
        className="bg-gradient-to-b from-brand-600 to-brand-500 text-white px-5 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Coach</p>
            <h1 className="text-2xl font-extrabold">{tabTitle[tab]}</h1>
          </div>
          <button
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Profile"
          >
            <Users size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-white/90 text-sm">
          <Users size={15} />
          <span className="font-semibold">{players.length} / {maxPlayers}</span>
          <span className="text-white/60">players in your squad</span>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 -mt-4">
        {/* ---------- HOME ---------- */}
        {tab === 'home' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your invite code</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-brand-50 border-2 border-dashed border-brand-200 rounded-xl py-3 text-center">
                  <span className="text-xl font-extrabold text-brand-600 tracking-widest font-mono">{inviteCode}</span>
                </div>
                <button
                  onClick={copyCode}
                  className="w-12 h-12 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors flex-shrink-0"
                  aria-label="Copy code"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Players enter this code at sign-up to join your squad and get full Premium — at no cost to them.
              </p>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Players</p>
            {players.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4">
                  <UserPlus size={26} className="text-brand-500" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">No players yet</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Share your invite code above to add your first player.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 text-left hover:border-brand-200 transition-colors"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${READINESS_DOT[p.readiness]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.position} · {p.programmeName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-700">{p.sessionsThisWeek}/{p.sessionsTarget}</p>
                      <p className="text-[10px] text-gray-400">this wk</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- SCHEDULE ---------- */}
        {tab === 'schedule' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <div className="grid grid-cols-7 gap-1.5 mb-4">
                {schedule.map(d => (
                  <div key={d.day} className="text-center">
                    <p className="text-[10px] text-gray-400 font-semibold mb-1">{d.day}</p>
                    <div className={`rounded-lg py-2 text-[10px] font-bold ${SCHEDULE_STYLE[d.type]}`}>
                      {d.type === 'match' ? 'M' : d.type === 'training' ? 'T' : '·'}
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-2.5 rounded-xl border border-brand-200 text-brand-600 text-sm font-semibold hover:bg-brand-50 transition-colors">
                Edit schedule
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {schedule.map(d => (
                <div key={d.day} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className="w-12 text-center">
                    <p className="text-sm font-bold text-gray-900">{d.day}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{d.label}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full capitalize ${SCHEDULE_BADGE[d.type]}`}>
                    {d.type}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 leading-relaxed px-1">
              Players build their own programme around this schedule — sessions auto-periodise around match day.
            </p>
          </>
        )}

        {/* ---------- HISTORY ---------- */}
        {tab === 'history' && (
          <>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Recent squad activity</p>
            {squadActivity.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500">
                No activity logged yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {squadActivity.map((a, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{a.player}</p>
                      <p className="text-xs text-gray-400">{a.label} · {a.date}</p>
                    </div>
                    {a.rpe != null && (
                      <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">RPE {a.rpe}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- TESTS ---------- */}
        {tab === 'tests' && (
          <>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Latest testing by player</p>
            <div className="flex flex-col gap-3">
              {players.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${READINESS_DOT[p.readiness]}`} />
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <span className="text-xs text-gray-400">· {p.position}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {p.testing.map(t => (
                      <div key={t.label} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{t.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">{t.value}</span>
                          <TestChange t={t} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom navigation — coach equivalent of the player nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-pb z-50">
        <div className="max-w-lg mx-auto flex">
          {([
            { id: 'home', label: 'Home', icon: LayoutDashboard },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
            { id: 'history', label: 'History', icon: HistoryIcon },
            { id: 'tests', label: 'Tests', icon: ClipboardCheck },
          ] as { id: CoachTab; label: string; icon: typeof LayoutDashboard }[]).map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); setSelectedId(null); }}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-brand-500' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
