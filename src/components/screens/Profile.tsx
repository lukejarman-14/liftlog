import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import {
  Camera, Mail, User, Shield, Calendar, Target, Dumbbell,
  LogOut, ChevronRight, ChevronDown, ChevronUp, Activity, Zap, Lock, Eye, EyeOff, Check,
  Ruler, Weight, AlertTriangle, Pencil, Plus, TrendingUp, TrendingDown, Bell, BellOff, Download,
  Trophy,
} from 'lucide-react';
import { isSupabaseConfigured, cloudUpdatePassword } from '../../lib/cloudSync';
import { exportData } from '../../lib/dataSync';
import { hashPassword } from '../../lib/authUtils';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { UserProfile, WeightEntry, UserSettings, WorkoutSession } from '../../types';
import { BaselineData } from '../../hooks/useStore';
import { GRADE_LABELS, GRADE_COLOURS, calcVo2Max, calcYoyoDistance } from '../../data/testingBattery';
import {
  requestNotificationPermission,
  checkNotificationPermission,
  cancelAllTrainingReminders,
} from '../../lib/notifications';
import { trackEvent } from '../../lib/analytics';


function WeightTracker({
  log,
  onSave,
  onDelete,
}: {
  log: WeightEntry[];
  onSave: (entry: WeightEntry) => void;
  onDelete: (date: string) => void;
}) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const todayEntry = log.find(e => e.date === today);
  const [inputStr, setInputStr] = useState(todayEntry ? String(todayEntry.weightKg) : '');
  const [saved, setSaved] = useState(false);

  // Sync input when today's entry arrives after cloud restore
  useEffect(() => {
    if (todayEntry) setInputStr(String(todayEntry.weightKg));
  }, [todayEntry?.weightKg]);
  const [showHistory, setShowHistory] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  const handleSave = () => {
    const val = parseFloat(inputStr);
    if (!val || val < 20 || val > 300) return;
    onSave({ date: today, weightKg: val, recordedAt: Date.now() });
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  // Last 10 entries for sparkline
  const recent = log.slice(0, 10).reverse();
  const weights = recent.map(e => e.weightKg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const latest = log[0];
  const prev   = log[1];
  const delta  = latest && prev ? latest.weightKg - prev.weightKg : null;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Weight size={14} className="text-brand-500" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weight Log</h3>
        </div>
        {latest && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-800">{latest.weightKg} kg</span>
            {delta !== null && delta !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${delta < 0 ? 'text-green-600' : 'text-amber-500'}`}>
                {delta < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sparkline */}
      {weights.length >= 2 && (
        <div className="mb-3 h-10 flex items-end gap-0.5">
          {recent.map((e, i) => {
            const h = Math.max(4, Math.round(((e.weightKg - minW) / range) * 32) + 4);
            const isLatest = i === recent.length - 1;
            return (
              <div key={e.date} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                <div
                  className={`w-full rounded-sm ${isLatest ? 'bg-brand-500' : 'bg-brand-200'}`}
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Log today's weight */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min="20"
            max="300"
            step="0.1"
            value={inputStr}
            onChange={e => { setInputStr(e.target.value); setSaved(false); }}
            placeholder={todayEntry ? String(todayEntry.weightKg) : 'e.g. 75.5'}
            style={{ fontSize: '16px' }}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">kg</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saved}
          className={`px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1 ${
            saved ? 'bg-green-100 text-green-600' : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          {saved ? <><Check size={13} /> Saved</> : <><Plus size={13} /> Log</>}
        </button>
      </div>

      {/* History toggle */}
      {log.length > 0 && (
        <button
          onClick={() => setShowHistory(s => !s)}
          className="mt-2 text-xs text-brand-500 font-semibold underline underline-offset-2"
        >
          {showHistory ? 'Hide history' : `Show history (${log.length} entries)`}
        </button>
      )}
      {showHistory && (
        <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
          {log.map(e => (
            <div key={e.date} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50">
              <span className="text-xs text-gray-500">
                {new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800">{e.weightKg} kg</span>
                <button onClick={() => onDelete(e.date)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}


function TrainingReminders({
  settings,
  onUpdate,
}: {
  settings: UserSettings;
  onUpdate: (patch: Partial<UserSettings>) => void;
}) {
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [saving, setSaving] = useState(false);

  // Check current permission on mount
  useEffect(() => {
    checkNotificationPermission().then(granted =>
      setPermState(granted ? 'granted' : 'denied'),
    );
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const fmt2 = (n: number) => String(n).padStart(2, '0');

  const handleToggle = async () => {
    if (settings.reminderEnabled) {
      await cancelAllTrainingReminders();
      onUpdate({ reminderEnabled: false });
      trackEvent('reminder_disabled');
    } else {
      setSaving(true);
      const granted = await requestNotificationPermission();
      setPermState(granted ? 'granted' : 'denied');
      if (granted) {
        onUpdate({ reminderEnabled: true });
        trackEvent('reminder_enabled', { hour: settings.reminderHour, minute: settings.reminderMinute });
      }
      setSaving(false);
    }
  };

  const handleTimeChange = (field: 'reminderHour' | 'reminderMinute', value: number) => {
    onUpdate({ [field]: value });
  };

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={14} className="text-brand-500" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Training Reminders</h3>
      </div>

      {/* Toggle row */}
      <div className="flex items-center justify-between py-1">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-sm font-medium text-gray-800">Daily session reminder</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">
            {settings.reminderEnabled
              ? `Notifications scheduled at ${fmt2(settings.reminderHour)}:${fmt2(settings.reminderMinute)}`
              : 'Get notified when a training session is due'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
            settings.reminderEnabled ? 'bg-brand-500' : 'bg-gray-200'
          } ${saving ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            settings.reminderEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Permission denied warning */}
      {permState === 'denied' && !settings.reminderEnabled && (
        <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
          <BellOff size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-snug">
            Notifications are blocked. Go to <strong>Settings → Vector Football → Notifications</strong> and enable them, then come back and turn this on.
          </p>
        </div>
      )}

      {/* Time picker — only visible when enabled */}
      {settings.reminderEnabled && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Remind me at</p>
          <div className="flex items-center gap-2">
            <select
              value={settings.reminderHour}
              onChange={e => handleTimeChange('reminderHour', Number(e.target.value))}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              style={{ fontSize: 16 }}
            >
              {hours.map(h => (
                <option key={h} value={h}>{fmt2(h)}:00</option>
              ))}
            </select>
            <span className="text-gray-400 font-bold">:</span>
            <select
              value={settings.reminderMinute}
              onChange={e => handleTimeChange('reminderMinute', Number(e.target.value))}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              style={{ fontSize: 16 }}
            >
              {minutes.map(m => (
                <option key={m} value={m}>{fmt2(m)}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-snug">
            Notifications will fire on each training day in your current programme. Re-toggle after changing time to apply.
          </p>
        </div>
      )}
    </Card>
  );
}


type BadgeCategory = 'consistency' | 'volume' | 'testing' | 'programme';

const BADGE_DEFS: { id: string; emoji: string; name: string; desc: string; category: BadgeCategory }[] = [
  { id: 'streak_1', emoji: '🌱', name: 'First Step', desc: 'Complete your first training week', category: 'consistency' },
  { id: 'streak_4', emoji: '🔥', name: 'On Fire', desc: '4-week training streak', category: 'consistency' },
  { id: 'streak_8', emoji: '💪', name: 'Unstoppable', desc: '8-week training streak', category: 'consistency' },
  { id: 'streak_12', emoji: '👑', name: 'Elite', desc: '12-week training streak', category: 'consistency' },
  { id: 'sessions_1', emoji: '⚡', name: 'Off the Mark', desc: 'Log your first session', category: 'volume' },
  { id: 'sessions_10', emoji: '🏋️', name: 'Gaining Ground', desc: '10 sessions completed', category: 'volume' },
  { id: 'sessions_25', emoji: '🎯', name: 'Dedicated', desc: '25 sessions completed', category: 'volume' },
  { id: 'sessions_50', emoji: '🏆', name: 'Veteran', desc: '50 sessions completed', category: 'volume' },
  { id: 'sessions_100', emoji: '💎', name: 'Legend', desc: '100 sessions completed', category: 'volume' },
  { id: 'test_first', emoji: '🧪', name: 'Know Your Numbers', desc: 'Complete your first test battery', category: 'testing' },
  { id: 'test_3', emoji: '📈', name: 'Data Driven', desc: 'Complete 3 test batteries', category: 'testing' },
  { id: 'test_improve', emoji: '🚀', name: 'Level Up', desc: 'Improve on any test result', category: 'testing' },
  { id: 'prog_built', emoji: '📋', name: 'Planner', desc: 'Build your first programme', category: 'programme' },
  { id: 'prog_done', emoji: '🎖️', name: 'Finisher', desc: 'Complete a full programme', category: 'programme' },
  { id: 'prog_done_2', emoji: '🥇', name: 'Returner', desc: 'Complete two full programmes', category: 'programme' },
];

const CAT_LABELS: Record<BadgeCategory, string> = {
  consistency: '🔥 Consistency',
  volume: '🏋️ Volume',
  testing: '🧪 Testing',
  programme: '📋 Programme',
};

function calcStreak(sessions: WorkoutSession[]): number {
  if (!sessions.length) return 0;
  const monday = (d: Date) => {
    const m = new Date(d);
    m.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
    return m.toISOString().split('T')[0];
  };
  const weeks = new Set(sessions.map(s => monday(new Date(s.date))));
  let n = 0;
  const cur = new Date();
  if (!weeks.has(monday(cur))) cur.setDate(cur.getDate() - 7);
  while (n < 52 && weeks.has(monday(cur))) {
    n++;
    cur.setDate(cur.getDate() - 7);
  }
  return n;
}

function BadgesCard({
  sessions,
  totalSessions,
  testSessionCount,
  hasImprovedTest,
  programmesBuilt,
  programmesCompleted,
}: {
  sessions: WorkoutSession[];
  totalSessions: number;
  testSessionCount: number;
  hasImprovedTest: boolean;
  programmesBuilt: number;
  programmesCompleted: number;
}) {
  const streak = calcStreak(sessions);
  const [selectedBadge, setSelectedBadge] = useState<typeof BADGE_DEFS[0] | null>(null);

  const earned = new Set<string>();
  if (streak >= 1) earned.add('streak_1');
  if (streak >= 4) earned.add('streak_4');
  if (streak >= 8) earned.add('streak_8');
  if (streak >= 12) earned.add('streak_12');
  if (totalSessions >= 1) earned.add('sessions_1');
  if (totalSessions >= 10) earned.add('sessions_10');
  if (totalSessions >= 25) earned.add('sessions_25');
  if (totalSessions >= 50) earned.add('sessions_50');
  if (totalSessions >= 100) earned.add('sessions_100');
  if (testSessionCount >= 1) earned.add('test_first');
  if (testSessionCount >= 3) earned.add('test_3');
  if (hasImprovedTest) earned.add('test_improve');
  if (programmesBuilt >= 1) earned.add('prog_built');
  if (programmesCompleted >= 1) earned.add('prog_done');
  if (programmesCompleted >= 2) earned.add('prog_done_2');

  const earnedCount = earned.size;
  const total = BADGE_DEFS.length;
  const categories: BadgeCategory[] = ['consistency', 'volume', 'testing', 'programme'];

  const selectedEarned = selectedBadge ? earned.has(selectedBadge.id) : false;

  return (
    <>
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-brand-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Badges &amp; Rewards</h3>
          </div>
          <span className="text-xs font-bold text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full">
            {earnedCount}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${(earnedCount / total) * 100}%` }}
          />
        </div>

        {categories.map(cat => {
          const badges = BADGE_DEFS.filter(b => b.category === cat);
          return (
            <div key={cat} className="mb-4 last:mb-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                {CAT_LABELS[cat]}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {badges.map(badge => {
                  const isEarned = earned.has(badge.id);
                  return (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                        isEarned
                          ? 'bg-brand-50 border-brand-200'
                          : 'bg-gray-50 border-gray-100 opacity-40 grayscale'
                      }`}
                    >
                      <span className="text-2xl leading-none">{badge.emoji}</span>
                      <span className={`text-[10px] font-bold text-center leading-tight ${isEarned ? 'text-brand-700' : 'text-gray-400'}`}>
                        {badge.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Badge detail sheet */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
          onClick={() => setSelectedBadge(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl p-6 pb-28 shadow-2xl overflow-y-auto max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-5" />

            <div className="flex flex-col items-center text-center gap-3">
              {/* Big emoji with earned ring */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-5xl border-4 ${
                selectedEarned ? 'border-brand-400 bg-brand-50' : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 grayscale opacity-50'
              }`}>
                {selectedBadge.emoji}
              </div>

              {/* Status pill */}
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                selectedEarned
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
              }`}>
                {selectedEarned ? '✓ Earned' : 'Locked'}
              </span>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedBadge.name}</h2>

              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
                {selectedEarned
                  ? `You earned this badge by completing: ${selectedBadge.desc.toLowerCase()}.`
                  : `To earn this badge: ${selectedBadge.desc.toLowerCase()}.`}
              </p>
            </div>

            <button
              onClick={() => setSelectedBadge(null)}
              className="mt-6 w-full py-3 rounded-2xl bg-brand-500 text-white font-bold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}


interface ProfileProps {
  userProfile: UserProfile;
  profilePicture: string | null;
  totalSessions: number;
  sessions: WorkoutSession[];
  testSessionCount: number;
  hasImprovedTest: boolean;
  programmesBuilt: number;
  programmesCompleted: number;
  baseline: BaselineData | null;
  referralCode?: string;
  weightLog: WeightEntry[];
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onSetProfilePicture: (pic: string | null) => void;
  onStartBattery: () => void;
  onResetProfile: () => void;
  onChangePassword: (newHash: string) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onSaveTrainingProfile: (updates: Partial<UserProfile>) => void;
  onSaveWeight: (entry: WeightEntry) => void;
  onDeleteWeight: (date: string) => void;
  onLogout: () => void;
  onBack: () => void;
  onManageSubscription?: () => void;
}

function ChangePasswordModal({
  currentHash,
  userEmail,
  onSave,
  onClose,
}: {
  currentHash?: string;
  userEmail: string;
  onSave: (newHash: string) => void;
  onClose: () => void;
}) {
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  const passwordStrong = newPw.length >= 8;
  const passwordsMatch = newPw === confirmPw && confirmPw !== '';

  const handleSave = async () => {
    setError('');
    if (!passwordStrong) { setError('New password must be at least 8 characters.'); return; }
    if (!passwordsMatch) { setError('New passwords do not match.'); return; }
    setLoading(true);
    // Verify current password (local hash check)
    if (currentHash) {
      const curHash = await hashPassword(currentPw, userEmail);
      if (curHash !== currentHash) {
        setError('Current password is incorrect.');
        setLoading(false);
        return;
      }
    }
    // Update password in Supabase (this is the real auth password)
    if (isSupabaseConfigured) {
      try {
        await cloudUpdatePassword(newPw);
      } catch {
        setError('Failed to update password. Please try again.');
        setLoading(false);
        return;
      }
    }
    const newHash = await hashPassword(newPw, userEmail);
    setLoading(false);
    setSuccess(true);
    onSave(newHash);
    onClose();
  };

  const inputCls = (err = false) =>
    `w-full px-4 py-3 rounded-xl border ${err ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'} bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 pr-11`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 pb-20">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
            <Lock size={16} className="text-brand-600" />
          </div>
          <h3 className="font-bold text-gray-900">Change Password</h3>
        </div>

        <div className="flex flex-col gap-4">
          {currentHash && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Current Password</label>
              <div className="relative">
                <input value={currentPw} onChange={e => { setCurrentPw(e.target.value); setError(''); }}
                  type={showCur ? 'text' : 'password'} placeholder="Enter current password"
                  autoComplete="current-password" style={{ fontSize: '16px' }} className={inputCls(!!error && !currentPw)} />
                <button type="button" onClick={() => setShowCur(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCur ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">New Password</label>
            <div className="relative">
              <input value={newPw} onChange={e => { setNewPw(e.target.value); setError(''); }}
                type={showNew ? 'text' : 'password'} placeholder="Min. 8 characters"
                autoComplete="new-password" style={{ fontSize: '16px' }} className={inputCls(newPw !== '' && !passwordStrong)} />
              <button type="button" onClick={() => setShowNew(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPw !== '' && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className={`h-1 flex-1 rounded-full ${passwordStrong ? 'bg-green-400' : 'bg-red-300'}`} />
                <span className={`text-xs font-medium ${passwordStrong ? 'text-green-600' : 'text-red-400'}`}>
                  {passwordStrong ? 'Strong enough' : 'Too short'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Confirm New Password</label>
            <div className="relative">
              <input value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                type="password" placeholder="Re-enter new password"
                autoComplete="new-password" style={{ fontSize: '16px' }} className={inputCls(confirmPw !== '' && !passwordsMatch)} />
              {confirmPw !== '' && passwordsMatch && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"><Check size={15} /></div>
              )}
            </div>
            {confirmPw !== '' && !passwordsMatch && (
              <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          {success && (
            <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
              <Check size={16} /> Password updated!
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || success || !newPw || !confirmPw || (!!currentHash && !currentPw)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              loading || success || !newPw || !confirmPw
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}>
            {loading ? 'Saving…' : 'Save Password'}
          </button>
        </div>
      </div>
    </div>
  );
}


function UnitToggle({ imperial, onChange }: { imperial: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
      <button
        onClick={() => onChange(false)}
        className={`px-2.5 py-1 transition-colors ${!imperial ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}
      >
        Metric
      </button>
      <button
        onClick={() => onChange(true)}
        className={`px-2.5 py-1 transition-colors ${imperial ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}
      >
        Imperial
      </button>
    </div>
  );
}

function EditMetricsModal({
  currentHeight,
  currentWeight,
  currentDob,
  onSave,
  onClose,
}: {
  currentHeight?: number;
  currentWeight?: number;
  currentDob?: string;
  onSave: (heightCm?: number, weightKg?: number, dateOfBirth?: string) => void;
  onClose: () => void;
}) {
  // Height state
  const [heightImperial, setHeightImperial] = useState(false);
  const [cmStr, setCmStr] = useState(currentHeight ? String(currentHeight) : '');
  const [ftStr, setFtStr] = useState(currentHeight ? String(Math.floor(currentHeight / 2.54 / 12)) : '');
  const [inStr, setInStr] = useState(currentHeight ? String(Math.round((currentHeight / 2.54) % 12)) : '');

  // Weight state
  const [weightImperial, setWeightImperial] = useState(false);
  const [kgStr,  setKgStr]  = useState(currentWeight ? String(currentWeight) : '');
  const [lbsStr, setLbsStr] = useState(currentWeight ? String(Math.round(currentWeight / 0.453592)) : '');

  // Date of birth state
  const [dobStr, setDobStr] = useState(currentDob ?? '');

  const [saved, setSaved] = useState(false);
  const metricsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (metricsTimerRef.current) clearTimeout(metricsTimerRef.current); }, []);

  const switchHeightUnit = (toImperial: boolean) => {
    if (toImperial) {
      const cm = parseFloat(cmStr);
      if (cm > 0) {
        const totalIn = cm / 2.54;
        setFtStr(String(Math.floor(totalIn / 12)));
        setInStr(String(Math.round(totalIn % 12)));
      }
    } else {
      const ft = parseFloat(ftStr) || 0;
      const inches = parseFloat(inStr) || 0;
      const cm = Math.round((ft * 12 + inches) * 2.54);
      if (cm > 0) setCmStr(String(cm));
    }
    setHeightImperial(toImperial);
  };

  const switchWeightUnit = (toImperial: boolean) => {
    if (toImperial) {
      const kg = parseFloat(kgStr);
      if (kg > 0) setLbsStr(String(Math.round(kg / 0.453592)));
    } else {
      const lbs = parseFloat(lbsStr);
      if (lbs > 0) setKgStr(String(Math.round(lbs * 0.453592 * 10) / 10));
    }
    setWeightImperial(toImperial);
  };

  const handleSave = () => {
    let heightCm: number | undefined;
    let weightKg: number | undefined;

    if (heightImperial) {
      const ft = parseFloat(ftStr) || 0;
      const inches = parseFloat(inStr) || 0;
      const computed = Math.round((ft * 12 + inches) * 2.54);
      if (computed >= 100 && computed <= 250) heightCm = computed;
    } else {
      const cm = parseFloat(cmStr);
      if (cm >= 100 && cm <= 250) heightCm = cm;
    }

    if (weightImperial) {
      const lbs = parseFloat(lbsStr);
      const computed = Math.round(lbs * 0.453592 * 10) / 10;
      if (computed >= 30 && computed <= 300) weightKg = computed;
    } else {
      const kg = parseFloat(kgStr);
      if (kg >= 30 && kg <= 300) weightKg = kg;
    }

    setSaved(true);
    metricsTimerRef.current = setTimeout(() => { onSave(heightCm, weightKg, dobStr || undefined); onClose(); }, 600);
  };

  const inputCls = `w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 pb-20">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
            <Ruler size={16} className="text-brand-600" />
          </div>
          <h3 className="font-bold text-gray-900">Body Metrics</h3>
        </div>

        <div className="flex flex-col gap-5">
          {/* Height */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Height</label>
              <UnitToggle imperial={heightImperial} onChange={switchHeightUnit} />
            </div>
            {heightImperial ? (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    value={ftStr}
                    onChange={e => setFtStr(e.target.value)}
                    type="number" min="3" max="8"
                    placeholder="5"
                    style={{ fontSize: '16px' }}
                    className={inputCls + ' pr-8'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">ft</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    value={inStr}
                    onChange={e => setInStr(e.target.value)}
                    type="number" min="0" max="11"
                    placeholder="11"
                    style={{ fontSize: '16px' }}
                    className={inputCls + ' pr-8'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">in</span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={cmStr}
                  onChange={e => setCmStr(e.target.value)}
                  type="number" min="100" max="230"
                  placeholder="e.g. 180"
                  style={{ fontSize: '16px' }}
                  className={inputCls + ' pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">cm</span>
              </div>
            )}
          </div>

          {/* Weight */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weight</label>
              <UnitToggle imperial={weightImperial} onChange={switchWeightUnit} />
            </div>
            {weightImperial ? (
              <div className="relative">
                <input
                  value={lbsStr}
                  onChange={e => setLbsStr(e.target.value)}
                  type="number" min="66" max="440"
                  placeholder="e.g. 165"
                  style={{ fontSize: '16px' }}
                  className={inputCls + ' pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">lbs</span>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={kgStr}
                  onChange={e => setKgStr(e.target.value)}
                  type="number" min="30" max="200"
                  placeholder="e.g. 75"
                  style={{ fontSize: '16px' }}
                  className={inputCls + ' pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">kg</span>
              </div>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Date of Birth</label>
            <p className="text-xs text-gray-400 mb-1.5">Used to track your age accurately over years of use.</p>
            <input
              value={dobStr}
              onChange={e => setDobStr(e.target.value)}
              type="date"
              style={{ fontSize: '16px' }}
              className={inputCls}
            />
          </div>

          {saved && (
            <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
              <Check size={16} /> Saved!
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              saved ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre Back', FB: 'Full Back',
  CM: 'Midfielder', W: 'Winger', ST: 'Striker',
};
const POSITION_EMOJI: Record<string, string> = {
  GK: '🧤', CB: '🛡️', FB: '⚡', CM: '⚙️', W: '💨', ST: '🎯',
};
const EXPERIENCE_LABELS: Record<string, string> = {
  '<1': 'Less than 1 year', '1-3': '1–3 years',
  '3-5': '3–5 years', '5+': '5+ years',
};
const FREQUENCY_LABELS: Record<string, string> = {
  '0': 'Just starting', '1-2': '1–2 sessions/week',
  '3-4': '3–4 sessions/week', '5+': '5+ sessions/week',
};
const GYM_LABELS: Record<string, string> = {
  full: 'Full gym', basic: 'Basic gym', none: 'Home / Outdoor',
};

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}


const POSITIONS = [
  { id: 'GK', label: '🧤 Goalkeeper' },
  { id: 'CB', label: '🛡️ Centre Back' },
  { id: 'FB', label: '⚡ Full Back' },
  { id: 'CM', label: '⚙️ Midfielder' },
  { id: 'W',  label: '💨 Winger' },
  { id: 'ST', label: '🎯 Striker' },
] as const;

const EXPERIENCE_OPTIONS = [
  { id: '<1',  label: 'Less than 1 year' },
  { id: '1-3', label: '1–3 years' },
  { id: '3-5', label: '3–5 years' },
  { id: '5+',  label: '5+ years' },
] as const;

const FREQUENCY_OPTIONS = [
  { id: '0',   label: 'Just starting' },
  { id: '1-2', label: '1–2 sessions/week' },
  { id: '3-4', label: '3–4 sessions/week' },
  { id: '5+',  label: '5+ sessions/week' },
] as const;

const GYM_ACCESS_OPTIONS = [
  { id: 'full',  label: '🏋️ Full gym' },
  { id: 'basic', label: '🪑 Basic gym' },
  { id: 'none',  label: '🌳 Home / Outdoor' },
] as const;

type EditableProfile = Pick<UserProfile, 'position' | 'experienceYears' | 'gymFrequency' | 'gymAccess'>;

function EditTrainingProfileModal({
  current,
  onSave,
  onClose,
}: {
  current: EditableProfile;
  onSave: (updates: EditableProfile) => void;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [position, setPosition]           = useState(current.position);
  const [experienceYears, setExperience]  = useState(current.experienceYears);
  const [gymFrequency, setFrequency]      = useState(current.gymFrequency);
  const [gymAccess, setGymAccess]         = useState(current.gymAccess);
  const [saved, setSaved]                 = useState(false);
  const trainingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (trainingTimerRef.current) clearTimeout(trainingTimerRef.current); }, []);

  const handleSave = () => {
    setSaved(true);
    trainingTimerRef.current = setTimeout(() => {
      onSave({ position, experienceYears, gymFrequency, gymAccess });
      onClose();
    }, 600);
  };

  const btnBase = 'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all text-center';
  const btnActive = 'bg-brand-500 text-white border-brand-500';
  const btnInactive = 'bg-white text-gray-600 border-gray-200 hover:border-brand-300';

  if (!confirmed) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 pb-8">
        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Edit Training Profile?</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Changing your position, experience, gym frequency or equipment access may mean your current programme is no longer optimal.
              </p>
              <p className="text-sm font-semibold text-amber-700 mt-2">
                You may need to rebuild your programme after saving.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmed(true)}
              className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 pb-8 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
            <Pencil size={15} className="text-brand-600" />
          </div>
          <h3 className="font-bold text-gray-900">Edit Training Profile</h3>
        </div>

        <div className="flex flex-col gap-5">
          {/* Position */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Position</label>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map(p => (
                <button key={p.id} onClick={() => setPosition(p.id as typeof position)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all text-center ${position === p.id ? btnActive : btnInactive}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Training Experience</label>
            <div className="grid grid-cols-2 gap-2">
              {EXPERIENCE_OPTIONS.map(o => (
                <button key={o.id} onClick={() => setExperience(o.id as typeof experienceYears)}
                  className={`${btnBase} ${experienceYears === o.id ? btnActive : btnInactive}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gym frequency */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Current Gym Sessions per Week</label>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCY_OPTIONS.map(o => (
                <button key={o.id} onClick={() => setFrequency(o.id as typeof gymFrequency)}
                  className={`${btnBase} ${gymFrequency === o.id ? btnActive : btnInactive}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gym access */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Equipment Access</label>
            <div className="flex flex-col gap-2">
              {GYM_ACCESS_OPTIONS.map(o => (
                <button key={o.id} onClick={() => setGymAccess(o.id as typeof gymAccess)}
                  className={`${btnBase} ${gymAccess === o.id ? btnActive : btnInactive}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {saved && (
            <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
              <Check size={16} /> Saved!
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saved}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${saved ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}


export function Profile({
  userProfile, profilePicture, totalSessions,
  sessions, testSessionCount, hasImprovedTest, programmesBuilt, programmesCompleted,
  baseline, referralCode, weightLog, onSetProfilePicture,
  onStartBattery, onResetProfile, onChangePassword, onUpdateProfile, onSaveTrainingProfile,
  onSaveWeight, onDeleteWeight, onLogout, onBack,
  settings, onUpdateSettings, onManageSubscription,
}: ProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showChangePw,         setShowChangePw]         = useState(false);
  const [showEditMetrics,      setShowEditMetrics]      = useState(false);
  const [expandedMetric,       setExpandedMetric]       = useState<string | null>(null);
  const [showEditTraining,     setShowEditTraining]     = useState(false);
  const [showDeleteConfirm,    setShowDeleteConfirm]    = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('vf_dark_mode') === 'true');
  const [isSharingCode, setIsSharingCode] = useState(false);

  const toggleDarkMode = (on: boolean) => {
    setDarkMode(on);
    localStorage.setItem('vf_dark_mode', String(on));
    if (on) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type — defence against SVG/script injection
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Please choose a JPEG, PNG, WebP, or GIF image.');
      e.target.value = '';
      return;
    }
    // Validate file size — localStorage limit; 2 MB covers any reasonable photo
    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      alert('Photo must be under 2 MB. Please choose a smaller image.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') onSetProfilePicture(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const joinedDate = new Date(userProfile.completedAt).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  });

  return (
    <Layout title="My Profile" onBack={onBack}>

      <Card className="p-6 mb-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-brand-100 flex items-center justify-center border-4 border-white shadow-lg">
              {profilePicture ? (
                <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-brand-600">
                  {getInitials(userProfile.firstName, userProfile.lastName)}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-md hover:bg-brand-600 transition-colors"
            >
              <Camera size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {userProfile.firstName} {userProfile.lastName}
          </h2>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
            <Mail size={13} />
            {userProfile.email}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-2xl">{POSITION_EMOJI[userProfile.position] ?? '⚽'}</span>
            <span className="text-sm font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
              {POSITION_LABELS[userProfile.position] ?? userProfile.position}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
            <Calendar size={12} />
            Joined {joinedDate}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-brand-500">{totalSessions}</div>
          <div className="text-xs text-gray-500 mt-0.5">Workouts logged</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-brand-500">{POSITION_EMOJI[userProfile.position] ?? '⚽'}</div>
          <div className="text-xs text-gray-500 mt-0.5">{POSITION_LABELS[userProfile.position]}</div>
        </Card>
      </div>

      <BadgesCard
        sessions={sessions}
        totalSessions={totalSessions}
        testSessionCount={testSessionCount}
        hasImprovedTest={hasImprovedTest}
        programmesBuilt={programmesBuilt}
        programmesCompleted={programmesCompleted}
      />

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Training Profile</h3>
          <button
            onClick={() => setShowEditTraining(true)}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full hover:bg-brand-100 transition-colors"
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="text-base leading-none">{POSITION_EMOJI[userProfile.position] ?? '⚽'}</span>
            </div>
            <div>
              <div className="text-xs text-gray-400">Position</div>
              <div className="text-sm font-semibold text-gray-800">{POSITION_LABELS[userProfile.position] ?? userProfile.position}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Experience</div>
              <div className="text-sm font-semibold text-gray-800">{EXPERIENCE_LABELS[userProfile.experienceYears] ?? userProfile.experienceYears}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Dumbbell size={14} className="text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Gym frequency</div>
              <div className="text-sm font-semibold text-gray-800">{FREQUENCY_LABELS[userProfile.gymFrequency] ?? userProfile.gymFrequency}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Shield size={14} className="text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Equipment access</div>
              <div className="text-sm font-semibold text-gray-800">{GYM_LABELS[userProfile.gymAccess] ?? userProfile.gymAccess}</div>
            </div>
          </div>
        </div>
      </Card>

      {userProfile.goals.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-brand-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Goals</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {userProfile.goals.map(g => (
              <span key={g} className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1 rounded-full font-medium capitalize">
                {g.replace('-', ' ')}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-brand-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fitness Testing</h3>
          </div>
          <button
            onClick={onStartBattery}
            className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full hover:bg-brand-100 transition-colors flex items-center gap-1"
          >
            <Zap size={11} />
            {baseline ? 'Re-test' : 'Take Test'}
          </button>
        </div>

        {!baseline && (
          <p className="text-xs text-gray-400 mb-3">No tests completed yet — tap Take Test to begin.</p>
        )}
        {baseline && (
          <p className="text-xs text-gray-400 mb-3">
            Tested {new Date(baseline.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}

        <div>
          {(baseline?.results.aerobicScore !== undefined || baseline?.results.anaerobicScore !== undefined) && (
            <div className="mb-3">
              {baseline?.results.aerobicScore !== undefined && (
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">🫀 Aerobic</span>
                    <span className="font-bold text-blue-600">{baseline.results.aerobicScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${baseline.results.aerobicScore}%` }} />
                  </div>
                </div>
              )}
              {baseline?.results.anaerobicScore !== undefined && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">⚡ Anaerobic</span>
                    <span className="font-bold text-orange-500">{baseline.results.anaerobicScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${baseline.results.anaerobicScore}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metric rows — tap any row to see norm benchmarks */}
          {(() => {
            const bSex: 'male'|'female' = baseline?.test.sex ?? (userProfile.gender === 'female' ? 'female' : 'male');
            const wKg = userProfile.weightKg;
            const fmtYoyo = (lvl: number) => { const l = Math.floor(lvl); const s = Math.round((lvl - l) * 10); return s > 0 ? `Level ${l} · Sh ${s}` : `Level ${l}`; };
            const NORM_ROWS_P: Record<string, { grade: 1|2|3|4|5; male: string; female: string }[]> = {
              '10m':       [{ grade:5,male:'< 1.60 s',female:'< 1.70 s'},{grade:4,male:'1.60–1.70 s',female:'1.70–1.80 s'},{grade:3,male:'1.71–1.80 s',female:'1.81–1.90 s'},{grade:2,male:'1.81–1.95 s',female:'1.91–2.05 s'},{grade:1,male:'> 1.95 s',female:'> 2.05 s'}],
              '30m':       [{ grade:5,male:'< 3.90 s',female:'< 4.30 s'},{grade:4,male:'3.90–4.10 s',female:'4.30–4.50 s'},{grade:3,male:'4.11–4.30 s',female:'4.51–4.70 s'},{grade:2,male:'4.31–4.50 s',female:'4.71–4.90 s'},{grade:1,male:'> 4.50 s',female:'> 4.90 s'}],
              cmj:         [{ grade:5,male:'≥ 60 cm',female:'≥ 48 cm'},{grade:4,male:'50–59 cm',female:'38–47 cm'},{grade:3,male:'40–49 cm',female:'28–37 cm'},{grade:2,male:'30–39 cm',female:'20–27 cm'},{grade:1,male:'< 30 cm',female:'< 20 cm'}],
              broad_jump:  [{ grade:5,male:'≥ 280 cm',female:'≥ 240 cm'},{grade:4,male:'250–279 cm',female:'210–239 cm'},{grade:3,male:'230–249 cm',female:'195–209 cm'},{grade:2,male:'200–229 cm',female:'165–194 cm'},{grade:1,male:'< 200 cm',female:'< 165 cm'}],
              fi:          [{ grade:5,male:'< 3.0 %',female:'< 3.5 %'},{grade:4,male:'3.0–5.0 %',female:'3.5–5.5 %'},{grade:3,male:'5.1–7.0 %',female:'5.6–7.5 %'},{grade:2,male:'7.1–9.0 %',female:'7.6–9.5 %'},{grade:1,male:'> 9.0 %',female:'> 9.5 %'}],
              yoyo:        [{ grade:5,male:'> Level 20.2',female:'> Level 17.0'},{grade:4,male:'19.1–20.2',female:'15.5–17.0'},{grade:3,male:'18.1–19.0',female:'13.0–15.4'},{grade:2,male:'16.7–18.0',female:'10.5–12.9'},{grade:1,male:'< Level 16.6',female:'< Level 10.4'}],
            };
            const rows = [
              { label: '10m Sprint',    testKey: '10m',        value: baseline?.test.sprint10m        ? `${baseline.test.sprint10m}s`                  : null, grade: baseline?.results.sprint10mGrade  },
              { label: '30m Sprint',    testKey: '30m',        value: baseline?.test.sprint30m        ? `${baseline.test.sprint30m}s`                  : null, grade: baseline?.results.sprint30mGrade  },
              { label: 'CMJ (best)',    testKey: 'cmj',        value: baseline?.test.cmjBest          ? `${baseline.test.cmjBest}cm`                   : null, grade: baseline?.results.cmjGrade        },
              { label: 'Broad Jump',    testKey: 'broad_jump', value: baseline?.test.broadJumpBest    ? `${baseline.test.broadJumpBest}cm`             : null, grade: baseline?.results.broadJumpGrade  },
              { label: 'Fatigue Index', testKey: 'fi',         value: baseline?.results.fatigueIndex  ? `${baseline.results.fatigueIndex.toFixed(1)}%` : null, grade: baseline?.results.fiGrade         },
              { label: 'Yo-Yo IR1',     testKey: 'yoyo',       value: baseline?.test.yoyoLevel        ? fmtYoyo(baseline.test.yoyoLevel)               : null, grade: baseline?.results.yoyoGrade       },
            ] as { label: string; testKey: string; value: string | null; grade?: 1|2|3|4|5 }[];
            return (
              <div className="flex flex-col gap-1">
                {rows.map(row => {
                  const isOpen = expandedMetric === row.testKey;
                  const canExpand = !!row.value;
                  const norms = NORM_ROWS_P[row.testKey];
                  const vo2 = row.testKey === 'yoyo' && baseline?.test.yoyoLevel ? calcVo2Max(baseline.test.yoyoLevel) : null;
                  const distM = row.testKey === 'yoyo' && baseline?.test.yoyoLevel ? calcYoyoDistance(baseline.test.yoyoLevel) : null;
                  const vo2Abs = vo2 && wKg ? Math.round(vo2 * wKg / 1000 * 10) / 10 : null;
                  return (
                    <div key={row.testKey}>
                      <button
                        onClick={() => canExpand && setExpandedMetric(isOpen ? null : row.testKey)}
                        disabled={!canExpand}
                        className={`w-full flex items-center justify-between gap-2 py-1.5 rounded-lg px-1 transition-colors ${canExpand ? 'hover:bg-gray-50 active:bg-gray-100 cursor-pointer' : 'cursor-default'}`}
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
                            {isOpen ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-400 italic">Waiting</span>
                        )}
                      </button>
                      {isOpen && norms && (
                        <div className="mt-2 mb-1 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
                          {vo2 !== null && (
                            <div className="px-3 pt-3 pb-2 border-b border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">VO₂max Estimate</p>
                              <div className="flex items-end gap-4">
                                <div>
                                  <p className="text-2xl font-extrabold text-brand-600 leading-none">{vo2}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">ml · kg⁻¹ · min⁻¹</p>
                                </div>
                                {vo2Abs !== null && (<div><p className="text-lg font-bold text-gray-700 leading-none">{vo2Abs} L/min</p><p className="text-xs text-gray-400 mt-0.5">absolute ({wKg} kg)</p></div>)}
                                {distM !== null && (<div className="ml-auto text-right"><p className="text-sm font-bold text-gray-600 leading-none">{distM} m</p><p className="text-xs text-gray-400 mt-0.5">distance covered</p></div>)}
                              </div>
                            </div>
                          )}
                          <div className="px-3 py-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Benchmarks · Adult field-sport athletes</p>
                            <div className="flex flex-col gap-1">
                              {norms.map(nr => {
                                const isAthlete = nr.grade === row.grade;
                                const c = GRADE_COLOURS[nr.grade];
                                return (
                                  <div key={nr.grade} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isAthlete ? `${c.bg} border ${c.border}` : 'bg-white border border-transparent'}`}>
                                    <span className={`text-xs font-bold w-20 shrink-0 ${isAthlete ? c.text : 'text-gray-500'}`}>{GRADE_LABELS[nr.grade]}{isAthlete ? ' ← you' : ''}</span>
                                    <span className={`text-xs flex-1 ${isAthlete ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>♂ {bSex === 'male' ? <strong>{nr.male}</strong> : nr.male}</span>
                                    <span className={`text-xs flex-1 ${isAthlete ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>♀ {bSex === 'female' ? <strong>{nr.female}</strong> : nr.female}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Body Metrics</h3>
          <button
            onClick={() => setShowEditMetrics(true)}
            className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full hover:bg-brand-100 transition-colors"
          >
            Edit
          </button>
        </div>
        {(() => {
          const age = userProfile.dateOfBirth
            ? (() => {
                const dob = new Date(userProfile.dateOfBirth);
                const today = new Date();
                let a = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
                return a;
              })()
            : null;
          return (
            <div className="flex gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Ruler size={14} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Height</div>
                  <div className="text-sm font-bold text-gray-800">
                    {userProfile.heightCm ? `${userProfile.heightCm} cm` : <span className="text-gray-400 font-normal">Not set</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Weight size={14} className="text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-400">Weight</div>
                  <div className="text-sm font-bold text-gray-800">
                    {userProfile.weightKg ? `${userProfile.weightKg} kg` : <span className="text-gray-400 font-normal">Not set</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 text-xs font-bold">Age</span>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Date of Birth</div>
                  <div className="text-sm font-bold text-gray-800">
                    {age !== null ? `${age} yrs` : <span className="text-gray-400 font-normal">Not set</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      <WeightTracker log={weightLog} onSave={onSaveWeight} onDelete={onDeleteWeight} />

      <TrainingReminders settings={settings} onUpdate={onUpdateSettings} />

      <Card className="p-4 mb-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
            <p className="text-xs text-gray-400 mt-0.5">{darkMode ? 'Dark theme enabled' : 'Light theme active'}</p>
          </div>
          <button
            onClick={() => toggleDarkMode(!darkMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-brand-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </Card>

      {/* Privacy / Analytics opt-out — required by GDPR, CCPA, and other global privacy laws */}
      <Card className="p-4 mb-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Privacy</h3>
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Usage Analytics</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {settings.analyticsOptOut
                ? 'Analytics off — no usage events are sent'
                : 'Anonymous usage data helps improve the app'}
            </p>
          </div>
          <button
            onClick={() => onUpdateSettings({ analyticsOptOut: !settings.analyticsOptOut })}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${!settings.analyticsOptOut ? 'bg-brand-500' : 'bg-gray-200'}`}
            aria-label={settings.analyticsOptOut ? 'Enable analytics' : 'Disable analytics'}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${!settings.analyticsOptOut ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          We never sell your data. Turn this off to opt out at any time.{' '}
          <a href="https://vectorfootball.co.uk/privacy" target="_blank" rel="noopener noreferrer" className="underline text-brand-500">Privacy Policy</a>
        </p>
      </Card>

      {referralCode && (
        <div className="mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-600 to-brand-500 p-5 shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤝</span>
            <h3 className="text-sm font-extrabold text-white">Refer a Friend</h3>
          </div>
          <p className="text-xs text-white/80 mb-4 leading-relaxed">
            Your friend gets <strong className="text-white">21 days free</strong> — you get <strong className="text-white">+14 days</strong> added to your subscription.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-center">
              <span className="text-lg font-extrabold text-white tracking-widest">{referralCode}</span>
            </div>
            <button
              onClick={async () => {
                if (isSharingCode) return;
                setIsSharingCode(true);
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: 'Join Vector Football',
                      text: `Use my referral code ${referralCode} on Vector Football and get 21 days free! vectorfootball.co.uk`,
                    });
                  } else {
                    navigator.clipboard.writeText(referralCode);
                  }
                } catch {
                  // User dismissed the share sheet — not an error
                } finally {
                  setIsSharingCode(false);
                }
              }}
              disabled={isSharingCode}
              className="px-4 py-3 rounded-xl bg-white text-brand-600 text-sm font-extrabold hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {isSharingCode ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </div>
      )}

      <Card className="p-4 mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Account</h3>

        {/* Manage Subscription */}
        {onManageSubscription && (
          <button
            onClick={onManageSubscription}
            className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center justify-between gap-2 hover:text-gray-900"
          >
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-gray-400" />
              Manage Subscription
            </div>
            <ChevronRight size={14} className="text-gray-300" />
          </button>
        )}

        {/* Change Password */}
        <button
          onClick={() => setShowChangePw(true)}
          className={`w-full text-left text-sm text-gray-600 py-2.5 flex items-center justify-between gap-2 hover:text-gray-900 ${onManageSubscription ? 'border-t border-gray-100' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-gray-400" />
            Change Password
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {/* Export my data */}
        <button
          onClick={() => exportData()}
          className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center justify-between gap-2 hover:text-gray-900 border-t border-gray-100"
        >
          <div className="flex items-center gap-2">
            <Download size={15} className="text-gray-400" />
            Export my data
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {/* Privacy Policy */}
        <a
          href="https://vectorfootball.co.uk/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center justify-between gap-2 hover:text-gray-900 border-t border-gray-100"
        >
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-gray-400" />
            Privacy Policy
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </a>

        {/* Log Out */}
        <button
          onClick={onLogout}
          className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center justify-between gap-2 hover:text-gray-900 border-t border-gray-100"
        >
          <div className="flex items-center gap-2">
            <LogOut size={15} className="text-gray-400" />
            Log Out
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {profilePicture && (
          <button
            onClick={() => onSetProfilePicture(null)}
            className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center gap-2 hover:text-gray-900 border-t border-gray-100"
          >
            <Camera size={15} className="text-gray-400" />
            Remove profile photo
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-left text-sm text-red-500 py-2.5 flex items-center gap-2 hover:text-red-600 border-t border-gray-100 mt-1 pt-3"
        >
          Delete Account &amp; All Data
        </button>
      </Card>

      {showChangePw && (
        <ChangePasswordModal
          currentHash={userProfile.passwordHash}
          userEmail={userProfile.email}
          onSave={onChangePassword}
          onClose={() => setShowChangePw(false)}
        />
      )}

      {showEditMetrics && (
        <EditMetricsModal
          currentHeight={userProfile.heightCm}
          currentWeight={userProfile.weightKg}
          currentDob={userProfile.dateOfBirth}
          onSave={(h, w, dob) => onUpdateProfile({ heightCm: h, weightKg: w, dateOfBirth: dob })}
          onClose={() => setShowEditMetrics(false)}
        />
      )}

      {showEditTraining && (
        <EditTrainingProfileModal
          current={{
            position: userProfile.position,
            experienceYears: userProfile.experienceYears,
            gymFrequency: userProfile.gymFrequency,
            gymAccess: userProfile.gymAccess,
          }}
          onSave={(updates) => onSaveTrainingProfile(updates)}
          onClose={() => setShowEditTraining(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 text-base mb-2">Delete Account?</h3>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              This permanently deletes your account and all training data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onResetProfile(); }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
