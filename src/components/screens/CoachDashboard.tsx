import { useState } from 'react';
import {
  Users, Copy, Check, Calendar, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Activity, Dumbbell, ClipboardCheck, LayoutDashboard,
  History as HistoryIcon, Megaphone, Trophy, Download, AlertTriangle, Award, ChevronDown,
} from 'lucide-react';

export type Readiness = 'ready' | 'moderate' | 'low' | 'unknown';
export type SquadGroup = 'Defence' | 'Midfield' | 'Attack';

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
  group: SquadGroup;
  readiness: Readiness;
  available: boolean;
  injury?: string;
  improvementScore: number;   // 0–100, drives "most improved"
  note?: string;
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
export interface ScheduleWeek {
  label: string;
  phase: string;
  days: ScheduleDay[];
}
export interface Announcement {
  date: string;
  text: string;
}

type CoachTab = 'home' | 'schedule' | 'history' | 'tests';

interface CoachDashboardProps {
  coachName: string;
  inviteSeed: string;
  players?: SquadPlayer[];
  weeks?: ScheduleWeek[];
  teams?: string[];
  announcements?: Announcement[];
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
function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
function numFromValue(v: string): number {
  return parseFloat(v.replace(/[^\d.]/g, '')) || 0;
}

const READINESS_DOT: Record<Readiness, string> = {
  ready: 'bg-green-500', moderate: 'bg-amber-400', low: 'bg-red-500', unknown: 'bg-gray-300',
};
const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready today', moderate: 'Moderate', low: 'Low readiness', unknown: 'No data yet',
};
const HEAT_BG: Record<Readiness, string> = {
  ready: 'bg-green-500 text-white', moderate: 'bg-amber-400 text-white',
  low: 'bg-red-500 text-white', unknown: 'bg-gray-200 text-gray-500',
};
const SCHEDULE_STYLE: Record<ScheduleDay['type'], string> = {
  match: 'bg-brand-500 text-white', training: 'bg-brand-100 text-brand-700', rest: 'bg-gray-100 text-gray-400',
};
const SCHEDULE_BADGE: Record<ScheduleDay['type'], string> = {
  match: 'bg-brand-500 text-white', training: 'bg-brand-100 text-brand-700', rest: 'bg-gray-100 text-gray-500',
};
const READINESS_SCORE: Record<Readiness, number> = { ready: 3, moderate: 2, low: 1, unknown: 0 };

// ---------------- Demo data ----------------
export const DEMO_TEAMS = ['First Team', 'U18s', 'U16s'];

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { date: 'Today', text: 'Bring both boot types Saturday — pitch may be wet.' },
  { date: 'Mon 26 May', text: 'Gym session moved to 6pm Wednesday.' },
];

export const DEMO_WEEKS: ScheduleWeek[] = [
  {
    label: 'This week', phase: 'In-Season · Maintenance',
    days: [
      { day: 'Mon', type: 'training', label: 'Team training' },
      { day: 'Tue', type: 'rest', label: 'Rest' },
      { day: 'Wed', type: 'training', label: 'Team training' },
      { day: 'Thu', type: 'rest', label: 'Recovery' },
      { day: 'Fri', type: 'training', label: 'Activation' },
      { day: 'Sat', type: 'match', label: 'vs Eastside FC (H)' },
      { day: 'Sun', type: 'rest', label: 'Rest' },
    ],
  },
  {
    label: 'Next week', phase: 'In-Season · Maintenance',
    days: [
      { day: 'Mon', type: 'rest', label: 'Recovery' },
      { day: 'Tue', type: 'training', label: 'Team training' },
      { day: 'Wed', type: 'training', label: 'Strength' },
      { day: 'Thu', type: 'rest', label: 'Rest' },
      { day: 'Fri', type: 'training', label: 'Activation' },
      { day: 'Sat', type: 'match', label: 'vs Northgate (A)' },
      { day: 'Sun', type: 'rest', label: 'Rest' },
    ],
  },
  {
    label: 'Week 3', phase: 'In-Season · Taper',
    days: [
      { day: 'Mon', type: 'training', label: 'Team training' },
      { day: 'Tue', type: 'rest', label: 'Rest' },
      { day: 'Wed', type: 'training', label: 'Speed' },
      { day: 'Thu', type: 'rest', label: 'Recovery' },
      { day: 'Fri', type: 'training', label: 'Activation' },
      { day: 'Sat', type: 'match', label: 'Cup: vs Riverside' },
      { day: 'Sun', type: 'rest', label: 'Rest' },
    ],
  },
];

export const DEMO_SQUAD: SquadPlayer[] = [
  {
    id: '1', name: 'Tom Hartley', position: 'Winger', group: 'Attack', readiness: 'ready',
    available: true, improvementScore: 88, note: 'Strong on the ball — keep loading single-leg work.',
    programmeName: 'Speed & Power · Wk 3', sessionsThisWeek: 3, sessionsTarget: 3, lastSessionLabel: 'Lower Body Power',
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
    id: '2', name: 'Jay Patel', position: 'Centre Back', group: 'Defence', readiness: 'moderate',
    available: false, injury: 'Tight hamstring', improvementScore: 54,
    programmeName: 'Strength Base · Wk 2', sessionsThisWeek: 2, sessionsTarget: 3, lastSessionLabel: 'Upper Body Strength',
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
    id: '3', name: 'Sam Okafor', position: 'Striker', group: 'Attack', readiness: 'low',
    available: true, improvementScore: 71,
    programmeName: 'Power & Conditioning · Wk 4', sessionsThisWeek: 1, sessionsTarget: 3, lastSessionLabel: 'Conditioning',
    testing: [
      { label: '10m Sprint', value: '1.74s', change: '-0.01s', improved: true },
      { label: 'CMJ', value: '47cm', change: '+0cm', improved: true },
      { label: 'Yo-Yo IR1', value: '19.0', change: '+0.4', improved: true },
    ],
    recentActivity: [{ date: 'Mon 26 May', label: 'Conditioning', rpe: 9 }],
  },
  {
    id: '4', name: 'Leo Marsh', position: 'Midfielder', group: 'Midfield', readiness: 'ready',
    available: true, improvementScore: 92, note: 'Most consistent attender — ready for more volume.',
    programmeName: 'Speed & Power · Wk 3', sessionsThisWeek: 3, sessionsTarget: 3, lastSessionLabel: 'Speed & Acceleration',
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
      {t.improved ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{t.change}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3 text-center">
      <p className="text-lg font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function CoachDashboard({
  inviteSeed, players = [], weeks = [], teams = [], announcements = [],
  maxPlayers = 30, onOpenProfile,
}: CoachDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<CoachTab>('home');
  const [team, setTeam] = useState(teams[0] ?? 'First Team');
  const [teamOpen, setTeamOpen] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'All' | SquadGroup>('All');
  const [weekIdx, setWeekIdx] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');

  const inviteCode = deriveInviteCode(inviteSeed);
  const selected = players.find(p => p.id === selectedId) ?? null;

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard unavailable */ }
  };

  // ----- Derived squad metrics -----
  const avgReadinessScore = players.length
    ? players.reduce((s, p) => s + READINESS_SCORE[p.readiness], 0) / players.length : 0;
  const avgReadinessLabel = avgReadinessScore >= 2.5 ? 'High' : avgReadinessScore >= 1.8 ? 'Moderate' : 'Low';
  const totalDone = players.reduce((s, p) => s + p.sessionsThisWeek, 0);
  const totalTarget = players.reduce((s, p) => s + p.sessionsTarget, 0);
  const compliancePct = totalTarget ? Math.round((totalDone / totalTarget) * 100) : 0;
  const mostImproved = [...players].sort((a, b) => b.improvementScore - a.improvementScore)[0];
  const availableCount = players.filter(p => p.available).length;

  const filteredPlayers = groupFilter === 'All' ? players : players.filter(p => p.group === groupFilter);

  // Leaderboards
  const sprintBoard = [...players].sort((a, b) =>
    numFromValue(a.testing.find(t => t.label === '10m Sprint')?.value ?? '99') -
    numFromValue(b.testing.find(t => t.label === '10m Sprint')?.value ?? '99')).slice(0, 3);
  const cmjBoard = [...players].sort((a, b) =>
    numFromValue(b.testing.find(t => t.label === 'CMJ')?.value ?? '0') -
    numFromValue(a.testing.find(t => t.label === 'CMJ')?.value ?? '0')).slice(0, 3);

  const squadActivity = players
    .flatMap(p => p.recentActivity.map(a => ({ ...a, player: p.name })))
    .sort((a, b) => b.date.localeCompare(a.date));

  const exportReport = () => {
    const rows = [['Name', 'Position', 'Readiness', 'Sessions', '10m', 'CMJ', 'Yo-Yo']];
    players.forEach(p => rows.push([
      p.name, p.position, p.readiness, `${p.sessionsThisWeek}/${p.sessionsTarget}`,
      p.testing.find(t => t.label === '10m Sprint')?.value ?? '',
      p.testing.find(t => t.label === 'CMJ')?.value ?? '',
      p.testing.find(t => t.label === 'Yo-Yo IR1')?.value ?? '',
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'squad-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Player detail ----------
  if (selected) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <div className="bg-gradient-to-b from-brand-600 to-brand-500 text-white px-5 pb-6"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}>
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-white/80 text-sm font-medium mb-3 hover:text-white">
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

        <div className="max-w-md mx-auto w-full px-5 pt-5">
          {/* Availability / injury */}
          {!selected.available && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">Unavailable{selected.injury ? ` · ${selected.injury}` : ''}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell size={16} className="text-brand-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Their programme</p>
            </div>
            <p className="font-bold text-gray-900">{selected.programmeName}</p>
            <p className="text-xs text-gray-400 mt-0.5">Self-built around your squad schedule · {selected.sessionsThisWeek}/{selected.sessionsTarget} sessions this week</p>
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
                  <div className="flex items-center gap-2"><span className="font-bold text-gray-900 text-sm">{t.value}</span><TestChange t={t} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-brand-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recent activity</p>
            </div>
            <div className="flex flex-col gap-3">
              {selected.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div><p className="text-sm font-semibold text-gray-900">{a.label}</p><p className="text-xs text-gray-400">{a.date}</p></div>
                  {a.rpe != null && <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">RPE {a.rpe}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Coach notes (private) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Private coach notes</p>
            <textarea
              defaultValue={selected.note ?? ''}
              onChange={e => setNoteDraft(e.target.value)}
              placeholder="Add a private note about this player…"
              rows={3}
              className="w-full text-sm rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Only you can see this — never shown to the player.{noteDraft ? ' (unsaved)' : ''}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentWeek = weeks[weekIdx];
  const tabTitle: Record<CoachTab, string> = {
    home: team, schedule: 'Squad Schedule', history: 'Squad History', tests: 'Squad Tests',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-brand-600 to-brand-500 text-white px-5 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="relative">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Coach</p>
            {tab === 'home' && teams.length > 1 ? (
              <button onClick={() => setTeamOpen(o => !o)} className="flex items-center gap-1.5">
                <h1 className="text-2xl font-extrabold">{tabTitle[tab]}</h1>
                <ChevronDown size={20} className="mt-1" />
              </button>
            ) : (
              <h1 className="text-2xl font-extrabold">{tabTitle[tab]}</h1>
            )}
            {teamOpen && tab === 'home' && (
              <div className="absolute z-20 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px]">
                {teams.map(t => (
                  <button key={t} onClick={() => { setTeam(t); setTeamOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${t === team ? 'text-brand-600 font-bold' : 'text-gray-700'} hover:bg-gray-50`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onOpenProfile} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" aria-label="Profile">
            <Users size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-white/90 text-sm">
          <Users size={15} />
          <span className="font-semibold">{players.length} / {maxPlayers}</span>
          <span className="text-white/60">players · {availableCount} available</span>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 pt-5">
        {/* ---------- HOME ---------- */}
        {tab === 'home' && (
          <>
            {/* Squad summary stats */}
            <div className="flex gap-2 mb-5">
              <StatCard label="Avg readiness" value={avgReadinessLabel} />
              <StatCard label="Compliance" value={`${compliancePct}%`} sub="sessions done" />
              <StatCard label="Available" value={`${availableCount}/${players.length}`} />
            </div>

            {/* Most improved */}
            {mostImproved && (
              <div className="bg-gradient-to-r from-amber-50 to-white rounded-2xl border border-amber-200 p-4 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                  <Award size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Most improved</p>
                  <p className="font-bold text-gray-900">{mostImproved.name}</p>
                  <p className="text-xs text-gray-500">{mostImproved.position} · biggest gains this block</p>
                </div>
              </div>
            )}

            {/* Readiness heatmap */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Readiness heatmap</p>
              <div className="grid grid-cols-5 gap-2">
                {players.map(p => (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-bold ${HEAT_BG[p.readiness]}`}>
                    {initials(p.name)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Ready</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Moderate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Low</span>
              </div>
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-brand-500" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Announcements</p>
                </div>
                <button className="text-xs font-semibold text-brand-600">+ New</button>
              </div>
              <div className="flex flex-col gap-2.5">
                {announcements.map((a, i) => (
                  <div key={i} className="text-sm">
                    <p className="text-gray-800">{a.text}</p>
                    <p className="text-[11px] text-gray-400">{a.date}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite code */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your invite code</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-brand-50 border-2 border-dashed border-brand-200 rounded-xl py-3 text-center">
                  <span className="text-xl font-extrabold text-brand-600 tracking-widest font-mono">{inviteCode}</span>
                </div>
                <button onClick={copyCode} className="w-12 h-12 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors flex-shrink-0" aria-label="Copy code">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">Players enter this code at sign-up to join your squad and get full Premium — at no cost to them.</p>
            </div>

            {/* Players + group filter */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Players</p>
            </div>
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {(['All', 'Defence', 'Midfield', 'Attack'] as const).map(g => (
                <button key={g} onClick={() => setGroupFilter(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${groupFilter === g ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                  {g}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {filteredPlayers.map(p => (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 text-left hover:border-brand-200 transition-colors">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${READINESS_DOT[p.readiness]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      {!p.available && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                    </div>
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
          </>
        )}

        {/* ---------- SCHEDULE ---------- */}
        {tab === 'schedule' && currentWeek && (
          <>
            {/* Phase + week selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <button disabled={weekIdx === 0} onClick={() => setWeekIdx(i => i - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={18} /></button>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{currentWeek.label}</p>
                  <p className="text-[11px] text-brand-600 font-semibold">{currentWeek.phase}</p>
                </div>
                <button disabled={weekIdx === weeks.length - 1} onClick={() => setWeekIdx(i => i + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={18} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {currentWeek.days.map(d => (
                  <div key={d.day} className="text-center">
                    <p className="text-[10px] text-gray-400 font-semibold mb-1">{d.day}</p>
                    <div className={`rounded-lg py-2 text-[10px] font-bold ${SCHEDULE_STYLE[d.type]}`}>{d.type === 'match' ? 'M' : d.type === 'training' ? 'T' : '·'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {currentWeek.days.map(d => (
                <div key={d.day} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className="w-12 text-center"><p className="text-sm font-bold text-gray-900">{d.day}</p></div>
                  <div className="flex-1"><p className="text-sm font-semibold text-gray-900">{d.label}</p></div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full capitalize ${SCHEDULE_BADGE[d.type]}`}>{d.type}</span>
                </div>
              ))}
            </div>

            {/* Match-day readiness check */}
            <div className="mt-5 bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-start gap-3">
              <ClipboardCheck size={18} className="text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">Match-day readiness check</p>
                <p className="text-xs text-gray-500 mt-0.5">On match morning, players get a quick readiness prompt so you can see who's fit to start before kick-off.</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4 leading-relaxed px-1">Players build their own programme around this schedule — sessions auto-periodise around match day and the current training phase.</p>
          </>
        )}

        {/* ---------- HISTORY ---------- */}
        {tab === 'history' && (
          <>
            {/* Attendance & compliance */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Attendance & compliance</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Squad sessions completed</span>
                <span className="font-bold text-gray-900">{totalDone}/{totalTarget} ({compliancePct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${compliancePct}%` }} />
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {players.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{p.name}</span>
                    <span className={`font-semibold ${p.sessionsThisWeek >= p.sessionsTarget ? 'text-green-600' : 'text-amber-500'}`}>{p.sessionsThisWeek}/{p.sessionsTarget}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Recent squad activity</p>
            <div className="flex flex-col gap-2">
              {squadActivity.map((a, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                  <div><p className="text-sm font-semibold text-gray-900">{a.player}</p><p className="text-xs text-gray-400">{a.label} · {a.date}</p></div>
                  {a.rpe != null && <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">RPE {a.rpe}</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------- TESTS ---------- */}
        {tab === 'tests' && (
          <>
            {/* Leaderboards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-1.5 mb-2"><Trophy size={14} className="text-amber-500" /><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fastest 10m</p></div>
                {sprintBoard.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-gray-700"><span className="text-gray-400 mr-1">{i + 1}.</span>{p.name.split(' ')[0]}</span>
                    <span className="font-bold text-gray-900">{p.testing.find(t => t.label === '10m Sprint')?.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-1.5 mb-2"><Trophy size={14} className="text-amber-500" /><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Highest CMJ</p></div>
                {cmjBoard.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-gray-700"><span className="text-gray-400 mr-1">{i + 1}.</span>{p.name.split(' ')[0]}</span>
                    <span className="font-bold text-gray-900">{p.testing.find(t => t.label === 'CMJ')?.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Latest testing by player</p>
              <button onClick={exportReport} className="flex items-center gap-1 text-xs font-semibold text-brand-600"><Download size={13} /> Export</button>
            </div>
            <div className="flex flex-col gap-3">
              {players.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${READINESS_DOT[p.readiness]}`} />
                    <p className="font-semibold text-gray-900">{p.name}</p><span className="text-xs text-gray-400">· {p.position}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {p.testing.map(t => (
                      <div key={t.label} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{t.label}</span>
                        <div className="flex items-center gap-2"><span className="font-bold text-gray-900 text-sm">{t.value}</span><TestChange t={t} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom navigation */}
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
              <button key={id} onClick={() => { setTab(id); setSelectedId(null); }} aria-current={active ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${active ? 'text-brand-500' : 'text-gray-400 hover:text-gray-600'}`}>
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
