import { useState } from 'react';
import {
  Users, Copy, Check, UserPlus, Calendar, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Activity, Dumbbell, ClipboardCheck,
} from 'lucide-react';

export type Readiness = 'ready' | 'moderate' | 'low' | 'unknown';

export interface TestResult {
  label: string;
  value: string;        // formatted, e.g. "1.78s", "42cm"
  change: string;       // e.g. "-0.04s", "+3cm" — empty string if no prior
  improved: boolean;    // true if the change is an improvement (drives colour + arrow)
}

export interface ActivityEntry {
  date: string;         // e.g. "Mon 2 Jun"
  label: string;        // e.g. "Lower Body Strength"
  rpe?: number;         // session RPE 1–10
}

export interface SquadPlayer {
  id: string;
  name: string;
  position: string;       // e.g. "Winger"
  readiness: Readiness;
  programmeName: string;  // self-built programme name
  sessionsThisWeek: number;
  sessionsTarget: number;
  lastSessionLabel?: string;
  testing: TestResult[];
  recentActivity: ActivityEntry[];
}

export interface ScheduleDay {
  day: string;            // "Mon"
  type: 'match' | 'training' | 'rest';
  label: string;          // "vs Eastside FC" / "Team training" / "Rest"
}

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
  const inviteCode = deriveInviteCode(inviteSeed);
  const selected = players.find(p => p.id === selectedId) ?? null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  // ---------- Player detail view ----------
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
          {/* Programme + week progress */}
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

          {/* Testing results + improvements */}
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
                    {t.change && (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${t.improved ? 'text-green-600' : 'text-red-500'}`}>
                        {t.improved ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {t.change}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
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

  // ---------- Squad overview ----------
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div
        className="bg-gradient-to-b from-brand-600 to-brand-500 text-white px-5 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Coach</p>
            <h1 className="text-2xl font-extrabold">{coachName || 'Your Squad'}</h1>
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
        {/* Invite code card */}
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

        {/* Squad schedule */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-brand-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">This week’s schedule</p>
            </div>
            <button className="text-xs font-semibold text-brand-600">Edit</button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {schedule.map(d => (
              <div key={d.day} className="text-center">
                <p className="text-[10px] text-gray-400 font-semibold mb-1">{d.day}</p>
                <div className={`rounded-lg py-2 text-[10px] font-bold ${SCHEDULE_STYLE[d.type]}`}>
                  {d.type === 'match' ? 'M' : d.type === 'training' ? 'T' : '·'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            Players build their own programme around this schedule — sessions auto-periodise around match day.
          </p>
        </div>

        {/* Players */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Players</p>

        {players.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={26} className="text-brand-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">No players yet</h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              Share your invite code above to add your first player. They'll appear here once they join.
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
                  <p className="text-xs text-gray-400 truncate">
                    {p.position} · {p.programmeName}
                  </p>
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
      </div>
    </div>
  );
}
