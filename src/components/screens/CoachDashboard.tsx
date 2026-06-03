import { useState, lazy, Suspense, useEffect } from 'react';
const FormationBuilder = lazy(() => import('./FormationBuilder').then(m => ({ default: m.FormationBuilder })));
import type { FormationData } from './FormationBuilder';
import { deriveTeamCode } from '../../lib/teams';
import {
  Users, Copy, Check, Calendar, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Activity, Dumbbell, ClipboardCheck, LayoutDashboard,
  History as HistoryIcon, Megaphone, Trophy, Download, AlertTriangle, Award, ChevronDown, Lock,
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
  description?: string;
}
export interface ScheduleWeek {
  label: string;
  phase: string;
  days: ScheduleDay[];
  weekStart?: string; // ISO date string for the Monday of this week
}
export interface Announcement {
  id?: string;
  date: string;
  text: string;
}
export interface MatchResult {
  id?: string;
  matchDate: string;
  opponent: string;
  venue: 'home' | 'away';
  goalsFor: number;
  goalsAgainst: number;
  notes: string;
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
  /** Free coaches (false) have analytics, schedule and testing locked + a 5-player cap. */
  isPaid?: boolean;
  onUpgrade?: () => void;
  onOpenProfile?: () => void;
  onPostAnnouncement?: (text: string) => Promise<void>;
  onDeleteAnnouncement?: (id: string) => Promise<void>;
  onUpdateScheduleDay?: (weekStart: string, day: string, type: ScheduleDay['type'], label: string, description: string) => Promise<void>;
  matchResults?: MatchResult[];
  onSaveMatchResult?: (result: Omit<MatchResult, 'id'>) => Promise<void>;
  onUpdateMatchResult?: (result: MatchResult) => Promise<void>;
  onDeleteMatchResult?: (id: string) => Promise<void>;
  savedAttendance?: Array<{ session_date: string; session_title: string; attendance: Record<string, boolean> }>;
  onSaveAttendance?: (sessionDate: string, sessionTitle: string, attendance: Record<string, boolean>) => Promise<void>;
  onSaveMatchSquad?: (matchDate: string, squad: { playerId: string; role: 'starter' | 'sub' | 'unavailable'; position: string }[], formationData?: any) => Promise<void>;
  onFetchSavedFormation?: (matchDate: string) => Promise<FormationData | null>;
  onFetchPreviousFormation?: () => Promise<FormationData | null>;
  onNotifySquad?: (message: string) => Promise<void>;
}

/** Returns ISO date string for a named weekday within a given week (weekStart = Monday). */
function getSessionDate(weekStart: string, dayName: string): string {
  if (!weekStart) return '';
  const offset: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + (offset[dayName] ?? 0));
  return d.toISOString().slice(0, 10);
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

// All player-mode tests. lowerIsBetter drives leaderboard sort direction.
const TEST_METRICS: { label: string; lowerIsBetter: boolean }[] = [
  { label: '10m Sprint', lowerIsBetter: true },
  { label: '30m Sprint', lowerIsBetter: true },
  { label: 'CMJ', lowerIsBetter: false },
  { label: 'Standing Long Jump', lowerIsBetter: false },
  { label: 'RSA (6×30m)', lowerIsBetter: true },
  { label: 'Yo-Yo IR1', lowerIsBetter: false },
];

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
      { label: '30m Sprint', value: '4.05s', change: '-0.06s', improved: true },
      { label: 'CMJ', value: '44cm', change: '+3cm', improved: true },
      { label: 'Standing Long Jump', value: '255cm', change: '+6cm', improved: true },
      { label: 'RSA (6×30m)', value: '4.30s', change: '-0.05s', improved: true },
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
      { label: '30m Sprint', value: '4.38s', change: '-0.03s', improved: true },
      { label: 'CMJ', value: '38cm', change: '+1cm', improved: true },
      { label: 'Standing Long Jump', value: '238cm', change: '+2cm', improved: true },
      { label: 'RSA (6×30m)', value: '4.55s', change: '+0.04s', improved: false },
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
      { label: '30m Sprint', value: '3.98s', change: '-0.02s', improved: true },
      { label: 'CMJ', value: '47cm', change: '+1cm', improved: true },
      { label: 'Standing Long Jump', value: '262cm', change: '+4cm', improved: true },
      { label: 'RSA (6×30m)', value: '4.25s', change: '-0.03s', improved: true },
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
      { label: '30m Sprint', value: '4.20s', change: '-0.04s', improved: true },
      { label: 'CMJ', value: '41cm', change: '+2cm', improved: true },
      { label: 'Standing Long Jump', value: '248cm', change: '+5cm', improved: true },
      { label: 'RSA (6×30m)', value: '4.40s', change: '-0.06s', improved: true },
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

function UpgradeCard({ title, body, onUpgrade }: { title: string; body: string; onUpgrade?: () => void }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-brand-200 p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-3">
        <Lock size={22} className="text-brand-500" />
      </div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-4 max-w-xs mx-auto">{body}</p>
      <button onClick={onUpgrade} className="w-full max-w-xs py-3 rounded-2xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 transition-colors">
        Upgrade to Pro
      </button>
    </div>
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
  maxPlayers = 30, isPaid = true, onUpgrade, onOpenProfile,
  onPostAnnouncement, onDeleteAnnouncement, onUpdateScheduleDay,
  matchResults = [], onSaveMatchResult, onUpdateMatchResult, onDeleteMatchResult, savedAttendance = [], onSaveAttendance, onSaveMatchSquad, onFetchSavedFormation, onFetchPreviousFormation, onNotifySquad,
}: CoachDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [announcementPosting, setAnnouncementPosting] = useState(false);
  // Day editor state
  const [editingDay, setEditingDay] = useState<{ weekStart: string; day: ScheduleDay } | null>(null);
  // Match result modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchVenue, setMatchVenue] = useState<'home' | 'away'>('home');
  const [matchGoalsFor, setMatchGoalsFor] = useState('');
  const [matchGoalsAgainst, setMatchGoalsAgainst] = useState('');
  const [matchNotes, setMatchNotes] = useState('');
  const [matchSaving, setMatchSaving] = useState(false);
  const [matchDate, setMatchDate] = useState('');
  // Attendance modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState<{ date: string; title: string } | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  // Formation builder
  const [showFormationBuilder, setShowFormationBuilder] = useState(false);
  const [formationMatchDate, setFormationMatchDate] = useState('');
  const [savedFormationData, setSavedFormationData] = useState<FormationData | undefined>(undefined);
  // Session picker (for attendance from History)
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [editType, setEditType] = useState<ScheduleDay['type']>('rest');
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [tab, setTab] = useState<CoachTab>('home');
  const [team, setTeam] = useState(teams[0] ?? 'First Team');
  const [teamOpen, setTeamOpen] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'All' | SquadGroup>('All');
  const [weekIdx, setWeekIdx] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');

  const inviteCode = deriveTeamCode(inviteSeed);
  const selected = players.find(p => p.id === selectedId) ?? null;

  // Load saved formation for the current match when FormationBuilder opens
  useEffect(() => {
    if (showFormationBuilder && formationMatchDate && onFetchSavedFormation) {
      onFetchSavedFormation(formationMatchDate)
        .then(data => setSavedFormationData(data || undefined))
        .catch(err => {
          if (import.meta.env.DEV) console.error('[formation] fetch error:', err);
          setSavedFormationData(undefined);
        });
    }
  }, [showFormationBuilder, formationMatchDate, onFetchSavedFormation]);

  // All non-rest sessions from all schedule weeks, newest first — used by session picker
  const allScheduledSessions = weeks.flatMap(w =>
    w.days
      .filter(d => d.type !== 'rest')
      .map(d => ({ weekLabel: w.label, day: d, date: getSessionDate(w.weekStart ?? '', d.day) }))
  ).sort((a, b) => b.date.localeCompare(a.date));

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

  // Leaderboards — top 3 per test, sorted by each test's direction
  const leaderboards = TEST_METRICS.map(metric => {
    const ranked = [...players]
      .filter(p => p.testing.some(t => t.label === metric.label))
      .sort((a, b) => {
        const av = numFromValue(a.testing.find(t => t.label === metric.label)?.value ?? '0');
        const bv = numFromValue(b.testing.find(t => t.label === metric.label)?.value ?? '0');
        return metric.lowerIsBetter ? av - bv : bv - av;
      })
      .slice(0, 3);
    return { metric, ranked };
  });

  // squadActivity kept for future use
  const _squadActivity = players
    .flatMap(p => p.recentActivity.map(a => ({ ...a, player: p.name })))
    .sort((a, b) => b.date.localeCompare(a.date));
  void _squadActivity;

  const exportReport = () => {
    // Quote a cell value — wraps in double quotes if it contains comma, quotes, or newlines
    const q = (v: string) => /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const header = ['Name', 'Position', 'Readiness', 'Available', 'Sessions This Week', 'Sessions Target',
      ...TEST_METRICS.flatMap(m => [m.label, `${m.label} Change`])];
    const rows = [header];
    players.forEach(p => rows.push([
      p.name, p.position, p.readiness, p.available ? 'Yes' : 'No',
      String(p.sessionsThisWeek), String(p.sessionsTarget),
      ...TEST_METRICS.flatMap(m => {
        const t = p.testing.find(tt => tt.label === m.label);
        return [t?.value ?? '', t?.change ?? ''];
      }),
    ]));
    // UTF-8 BOM (﻿) ensures Excel opens the file with correct encoding
    const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `squad-report-${date}.csv`; a.click();
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
            {/* Invite code — always at top */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-brand-50 border-2 border-dashed border-brand-200 rounded-xl py-2.5 text-center">
                  <span className="text-lg font-extrabold text-brand-600 tracking-widest font-mono">{inviteCode}</span>
                </div>
                <button onClick={copyCode} className="w-11 h-11 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors flex-shrink-0" aria-label="Copy code">
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                {isPaid ? 'Players enter this code at sign-up — they get full Premium free.' : 'Players can join with this code. Upgrade to Pro to give them Premium.'}
              </p>
            </div>

            {/* Squad analytics — paid only */}
            {isPaid ? (
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
              </>
            ) : (
              <div className="mb-5">
                <UpgradeCard
                  title="Unlock squad analytics"
                  body="Readiness heatmap, compliance, most-improved and testing dashboards are part of the Pro plan — which also gives all your players free Premium and raises your cap to 30."
                  onUpgrade={onUpgrade}
                />
              </div>
            )}

            {/* Announcements */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-brand-500" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Announcements</p>
                </div>
                <button
                  onClick={() => { setShowNewAnnouncement(true); setAnnouncementDraft(''); }}
                  className="text-xs font-semibold text-brand-600"
                >+ New</button>
              </div>

              {/* New announcement composer */}
              {showNewAnnouncement && (
                <div className="mb-4 bg-brand-50 rounded-xl p-3 border border-brand-100">
                  <textarea
                    className="w-full text-sm bg-transparent outline-none resize-none text-gray-800 placeholder-gray-400 min-h-[72px]"
                    placeholder="Type your announcement to the squad…"
                    value={announcementDraft}
                    onChange={e => setAnnouncementDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setShowNewAnnouncement(false)}
                      className="text-xs text-gray-500 px-3 py-1.5 rounded-lg"
                    >Cancel</button>
                    <button
                      disabled={!announcementDraft.trim() || announcementPosting}
                      onClick={async () => {
                        if (!announcementDraft.trim() || !onPostAnnouncement) return;
                        setAnnouncementPosting(true);
                        await onPostAnnouncement(announcementDraft.trim());
                        setAnnouncementPosting(false);
                        setShowNewAnnouncement(false);
                        setAnnouncementDraft('');
                      }}
                      className="text-xs font-semibold bg-brand-500 text-white px-4 py-1.5 rounded-lg disabled:opacity-40"
                    >{announcementPosting ? 'Sending…' : 'Post'}</button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {announcements.length === 0 && !showNewAnnouncement && (
                  <p className="text-sm text-gray-400 text-center py-2">No announcements yet. Tap + New to post one.</p>
                )}
                {announcements.map((a, i) => (
                  <div key={a.id ?? i} className="text-sm flex items-start justify-between gap-2">
                    <div>
                      <p className="text-gray-800">{a.text}</p>
                      <p className="text-[11px] text-gray-400">{a.date}</p>
                    </div>
                    {onDeleteAnnouncement && a.id && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this announcement?')) {
                            onDeleteAnnouncement(a.id!);
                          }
                        }}
                        className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0 mt-0.5"
                        aria-label="Delete"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
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
        {tab === 'schedule' && !isPaid && (
          <UpgradeCard
            title="Unlock the squad schedule"
            body="Set your fixtures and training days so players' programmes auto-periodise around match day. Part of the Pro plan."
            onUpgrade={onUpgrade}
          />
        )}
        {tab === 'schedule' && isPaid && currentWeek && (
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
                <div key={d.day} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => { setEditingDay({ weekStart: currentWeek.weekStart ?? '', day: d }); setEditType(d.type); setEditLabel(d.label); setEditDescription(d.description ?? ''); }}
                    className="p-4 flex items-center gap-3 w-full text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 text-center"><p className="text-sm font-bold text-gray-900">{d.day}</p></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{d.label || <span className="text-gray-300">Tap to set</span>}</p>
                      {d.description && <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>}
                    </div>
                    {/* Show match result score if logged */}
                    {d.type === 'match' && (() => {
                      const result = matchResults.find(r => r.matchDate === currentWeek.weekStart);
                      if (!result) return <span className={`text-[11px] font-bold px-2 py-1 rounded-full capitalize ${SCHEDULE_BADGE[d.type]}`}>{d.type}</span>;
                      const won = result.goalsFor > result.goalsAgainst;
                      const drew = result.goalsFor === result.goalsAgainst;
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-black px-2 py-1 rounded-full text-white ${won ? 'bg-green-500' : drew ? 'bg-amber-400' : 'bg-red-500'}`}>{result.goalsFor}–{result.goalsAgainst}</span>
                        </div>
                      );
                    })()}
                    {d.type !== 'match' && <span className={`text-[11px] font-bold px-2 py-1 rounded-full capitalize ${SCHEDULE_BADGE[d.type]}`}>{d.type}</span>}
                  </button>
                  {d.type !== 'rest' && (
                    <div className="border-t border-gray-50 px-4 py-2 flex gap-3">
                      <button onClick={() => { setAttendanceSession({ date: `${currentWeek.weekStart}`, title: d.label }); setAttendanceMap(Object.fromEntries(players.map(p => [p.id, false]))); setShowAttendanceModal(true); }} className="text-xs font-semibold text-brand-600 flex items-center gap-1">✓ Attendance</button>
                      {d.type === 'match' && (
                        <>
                          <span className="text-gray-200">|</span>
                          <button onClick={() => { setMatchDate(`${currentWeek.weekStart}`); setMatchOpponent(d.label.replace(/^vs /, '')); setMatchVenue('home'); setMatchGoalsFor(''); setMatchGoalsAgainst(''); setMatchNotes(''); setShowMatchModal(true); }} className="text-xs font-semibold text-brand-600">⚽ Log result</button>
                          <span className="text-gray-200">|</span>
                          <button onClick={() => { setFormationMatchDate(currentWeek.weekStart ?? ''); setShowFormationBuilder(true); }} className="text-xs font-semibold text-brand-600">👕 Squad</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-4 leading-relaxed px-1">Tap any day to edit. Players' programmes auto-periodise around match days.</p>

            {/* Day editor bottom sheet */}
            {editingDay && (
              <div className="fixed inset-0 z-50 flex items-end" onClick={() => setEditingDay(null)}>
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative w-full bg-white rounded-t-3xl p-6 pb-24" onClick={e => e.stopPropagation()}>
                  <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
                  <p className="font-bold text-gray-900 text-base mb-4">{editingDay.day.day} — Edit session</p>

                  {/* Type picker */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['rest', 'training', 'match'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setEditType(t); if (t === 'rest') { setEditLabel('Rest'); setEditDescription(''); } }}
                        className={`py-3 rounded-xl text-sm font-bold capitalize transition-colors ${editType === t ? (t === 'match' ? 'bg-brand-500 text-white' : t === 'training' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500') : 'bg-gray-50 text-gray-400'}`}
                      >{t}</button>
                    ))}
                  </div>

                  {/* Title */}
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Title</p>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400 mb-3"
                    placeholder={editType === 'match' ? 'e.g. vs Eastside FC (H)' : editType === 'training' ? 'e.g. Team training' : 'Rest day'}
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                  />

                  {/* Description */}
                  {editType !== 'rest' && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Details <span className="font-normal text-gray-400">(optional)</span></p>
                      <textarea
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400 resize-none min-h-[80px] mb-3"
                        placeholder={editType === 'match' ? 'e.g. Kick-off 3pm · Riverside Ground, Manchester · Bring both kits' : 'e.g. Focus on set pieces · Meet at the main entrance at 6:45pm'}
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                      />
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingDay(null)}
                      className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
                    >Cancel</button>
                    <button
                      disabled={editSaving}
                      onClick={async () => {
                        if (!onUpdateScheduleDay || !editingDay.weekStart) return;
                        setEditSaving(true);
                        await onUpdateScheduleDay(editingDay.weekStart, editingDay.day.day, editType, editLabel || (editType === 'rest' ? 'Rest' : editType === 'training' ? 'Training' : 'Match'), editDescription);
                        setEditSaving(false);
                        setEditingDay(null);
                      }}
                      className="flex-1 bg-brand-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 text-sm"
                    >{editSaving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ---------- HISTORY ---------- */}
        {tab === 'history' && !isPaid && (
          <UpgradeCard
            title="Unlock squad history"
            body="See attendance, compliance and every player's logged sessions across the squad. Part of the Pro plan."
            onUpgrade={onUpgrade}
          />
        )}
        {tab === 'history' && isPaid && (
          <>
            {/* Match results */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Match Results</p>
              <button onClick={() => { setEditingResultId(null); setMatchOpponent(''); setMatchVenue('home'); setMatchGoalsFor(''); setMatchGoalsAgainst(''); setMatchNotes(''); setMatchDate(new Date().toISOString().slice(0,10)); setShowMatchModal(true); }} className="text-xs font-semibold text-brand-600">+ Add Result</button>
            </div>
            {matchResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 text-center text-sm text-gray-400">No match results yet — tap + Add Result</div>
            ) : (
              <div className="flex flex-col gap-2 mb-5">
                {matchResults.map((m, i) => {
                  const won = m.goalsFor > m.goalsAgainst;
                  const drew = m.goalsFor === m.goalsAgainst;
                  return (
                    <div key={m.id ?? i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${won ? 'bg-green-500' : drew ? 'bg-amber-400' : 'bg-red-500'}`}>{won ? 'W' : drew ? 'D' : 'L'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">vs {m.opponent} <span className="text-gray-400 font-normal">({m.venue})</span></p>
                        <p className="text-xs text-gray-400">{m.matchDate}</p>
                        {m.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{m.notes}</p>}
                      </div>
                      <p className="text-lg font-black text-gray-900 flex-shrink-0">{m.goalsFor}–{m.goalsAgainst}</p>
                      <button
                        onClick={() => {
                          setEditingResultId(m.id ?? null);
                          setMatchDate(m.matchDate);
                          setMatchOpponent(m.opponent);
                          setMatchVenue(m.venue);
                          setMatchGoalsFor(String(m.goalsFor));
                          setMatchGoalsAgainst(String(m.goalsAgainst));
                          setMatchNotes(m.notes);
                          setShowMatchModal(true);
                        }}
                        className="text-xs text-brand-500 font-semibold flex-shrink-0 px-2 py-1 rounded-lg hover:bg-brand-50"
                      >Edit</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Attendance */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Attendance</p>
              <button onClick={() => setShowSessionPicker(true)} className="text-xs font-semibold text-brand-600">+ Log Session</button>
            </div>
            {players.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center text-sm text-gray-400">No players in squad yet</div>
            ) : savedAttendance.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm text-gray-500">Tap "+ Log Session" after training or a match to mark who attended.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-5">
                {savedAttendance.map((record, i) => {
                  const attended = Object.values(record.attendance).filter(Boolean).length;
                  const total = Object.keys(record.attendance).length;
                  const attendedNames = Object.entries(record.attendance)
                    .filter(([, present]) => present)
                    .map(([playerId]) => players.find(p => p.id === playerId)?.name || playerId)
                    .filter(Boolean);
                  return (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{record.session_title}</p>
                          <p className="text-xs text-gray-400">{record.session_date}</p>
                        </div>
                        <span className="text-sm font-bold text-brand-600">{attended}/{total}</span>
                      </div>
                      {attendedNames.length > 0 && (
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                          <p className="font-semibold mb-1">Present:</p>
                          <div className="flex flex-wrap gap-1">
                            {attendedNames.map((name, idx) => (
                              <span key={idx} className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-[11px]">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---------- TESTS ---------- */}
        {tab === 'tests' && !isPaid && (
          <UpgradeCard
            title="Unlock squad testing"
            body="Leaderboards, every player's test results and improvements, plus CSV export. Part of the Pro plan."
            onUpgrade={onUpgrade}
          />
        )}
        {tab === 'tests' && isPaid && (
          <>
            {/* Leaderboards — one per test */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Leaderboards</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {leaderboards.map(({ metric, ranked }) => (
                <div key={metric.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy size={14} className="text-amber-500" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">{metric.label}</p>
                  </div>
                  {ranked.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-gray-700 truncate"><span className="text-gray-400 mr-1">{i + 1}.</span>{p.name.split(' ')[0]}</span>
                      <span className="font-bold text-gray-900 flex-shrink-0">{p.testing.find(t => t.label === metric.label)?.value}</span>
                    </div>
                  ))}
                </div>
              ))}
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

      {/* ---- Match Result Modal ---- */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => { setShowMatchModal(false); setEditingResultId(null); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-white rounded-t-3xl p-6 pb-28 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-bold text-gray-900 text-base mb-4">{editingResultId ? 'Edit Match Result' : 'Log Match Result'}</p>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Date</p>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400 mb-3" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Opponent</p>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400 mb-3" placeholder="e.g. Eastside FC" value={matchOpponent} onChange={e => setMatchOpponent(e.target.value)} />
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['home', 'away'] as const).map(v => (
                <button key={v} onClick={() => setMatchVenue(v)} className={`py-3 rounded-xl text-sm font-bold capitalize ${matchVenue === v ? 'bg-brand-500 text-white' : 'bg-gray-50 text-gray-400'}`}>{v}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Goals for</p>
                <input type="number" inputMode="numeric" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400" value={matchGoalsFor} onChange={e => setMatchGoalsFor(e.target.value)} placeholder="0" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Goals against</p>
                <input type="number" inputMode="numeric" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400" value={matchGoalsAgainst} onChange={e => setMatchGoalsAgainst(e.target.value)} placeholder="0" />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Notes <span className="font-normal text-gray-400">(optional)</span></p>
            <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400 resize-none min-h-[60px] mb-4" placeholder="e.g. Great performance, set pieces need work" value={matchNotes} onChange={e => setMatchNotes(e.target.value)} />
            {editingResultId && onDeleteMatchResult && (
              <button
                onClick={async () => {
                  if (!confirm('Delete this result? This cannot be undone.')) return;
                  await onDeleteMatchResult(editingResultId);
                  setShowMatchModal(false);
                  setEditingResultId(null);
                }}
                className="w-full mb-2 py-3 rounded-xl border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors"
              >🗑 Delete Result</button>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowMatchModal(false); setEditingResultId(null); }} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
              <button
                disabled={matchSaving || !matchOpponent.trim()}
                onClick={async () => {
                  setMatchSaving(true);
                  const resultData = { matchDate, opponent: matchOpponent.trim(), venue: matchVenue, goalsFor: parseInt(matchGoalsFor) || 0, goalsAgainst: parseInt(matchGoalsAgainst) || 0, notes: matchNotes };
                  if (editingResultId && onUpdateMatchResult) {
                    await onUpdateMatchResult({ ...resultData, id: editingResultId });
                  } else if (onSaveMatchResult) {
                    await onSaveMatchResult(resultData);
                  }
                  setMatchSaving(false);
                  setShowMatchModal(false);
                  setEditingResultId(null);
                }}
                className="flex-1 bg-brand-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 text-sm"
              >{matchSaving ? 'Saving…' : editingResultId ? 'Update Result' : 'Save Result'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Attendance Modal ---- */}
      {showAttendanceModal && attendanceSession && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAttendanceModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-white rounded-t-3xl p-6 pb-28 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-bold text-gray-900 text-base mb-1">Attendance</p>
            <p className="text-xs text-gray-400 mb-4">{attendanceSession.title} · {attendanceSession.date}</p>
            {players.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No players in squad yet</p>}
            <div className="flex flex-col gap-2 mb-4">
              {players.map(p => (
                <button key={p.id} onClick={() => setAttendanceMap(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${attendanceMap[p.id] ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${attendanceMap[p.id] ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{initials(p.name)}</div>
                    <div className="text-left"><p className="text-sm font-semibold text-gray-900">{p.name}</p><p className="text-xs text-gray-400">{p.position}</p></div>
                  </div>
                  <span className={`text-xs font-bold ${attendanceMap[p.id] ? 'text-green-600' : 'text-gray-300'}`}>{attendanceMap[p.id] ? '✓ Present' : 'Absent'}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAttendanceModal(false)} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
              <button disabled={attendanceSaving} onClick={async () => { if (!onSaveAttendance) return; setAttendanceSaving(true); await onSaveAttendance(attendanceSession.date, attendanceSession.title, attendanceMap); setAttendanceSaving(false); setShowAttendanceModal(false); }} className="flex-1 bg-brand-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 text-sm">{attendanceSaving ? 'Saving…' : 'Save Attendance'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Session Picker Modal (for History attendance) ---- */}
      {showSessionPicker && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowSessionPicker(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-white rounded-t-3xl p-6 pb-12 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-bold text-gray-900 text-base mb-1">Select Session</p>
            <p className="text-xs text-gray-400 mb-4">Choose which session to log attendance for</p>
            {allScheduledSessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No sessions scheduled yet — add training or match days on the Schedule tab first.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {allScheduledSessions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAttendanceSession({ date: s.date, title: s.day.label || s.day.type });
                      setAttendanceMap(Object.fromEntries(players.map(p => [p.id, false])));
                      setShowSessionPicker(false);
                      setShowAttendanceModal(true);
                    }}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 text-left transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{s.day.label || s.day.type}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.date} · {s.weekLabel}</p>
                      {s.day.description && <p className="text-xs text-gray-400">{s.day.description}</p>}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full capitalize ml-3 flex-shrink-0 ${SCHEDULE_BADGE[s.day.type]}`}>{s.day.type}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowSessionPicker(false)} className="w-full mt-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {/* ---- Formation Builder ---- */}
      {showFormationBuilder && (
        <Suspense fallback={null}>
          <FormationBuilder
            players={players}
            matchDate={formationMatchDate}
            initialData={savedFormationData}
            onSave={async (data, formationData) => {
              if (onSaveMatchSquad) {
                await onSaveMatchSquad(formationMatchDate, Object.entries(data.assignments).map(([posId, playerId]) => ({ playerId, role: 'starter' as const, position: posId })), formationData);
              }
            }}
            onNotify={onNotifySquad}
            onFetchPreviousFormation={onFetchPreviousFormation}
            onClose={() => { setShowFormationBuilder(false); setSavedFormationData(undefined); }}
          />
        </Suspense>
      )}

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
