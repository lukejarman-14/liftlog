import { useRef } from 'react';
import {
  Camera, Mail, User, Shield, Calendar, Target, Dumbbell,
  LogOut, PlayCircle, ChevronRight, Activity, Zap,
} from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { UserProfile, UserSettings } from '../../types';
import { BaselineData } from '../../hooks/useStore';
import { GRADE_LABELS, GRADE_COLOURS } from '../../data/testingBattery';

interface ProfileProps {
  userProfile: UserProfile;
  profilePicture: string | null;
  totalSessions: number;
  settings: UserSettings;
  baseline: BaselineData | null;
  onSetProfilePicture: (pic: string | null) => void;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onStartBattery: () => void;
  onResetProfile: () => void;
  onBack: () => void;
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

// ── Toggle switch ──────────────────────────────────────────────────────────
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-brand-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Setting row ────────────────────────────────────────────────────────────
function SettingRow({
  icon,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 text-brand-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-400 leading-snug mt-0.5">{description}</div>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} />
    </div>
  );
}

export function Profile({
  userProfile, profilePicture, totalSessions,
  settings, baseline, onSetProfilePicture, onUpdateSettings,
  onStartBattery, onResetProfile, onBack,
}: ProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

      {/* ── Avatar + name ─────────────────────────────────────────────── */}
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

      {/* ── Stats ─────────────────────────────────────────────────────── */}
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

      {/* ── Training background ───────────────────────────────────────── */}
      <Card className="p-4 mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Training Profile</h3>
        <div className="flex flex-col gap-3">
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

      {/* ── Goals ─────────────────────────────────────────────────────── */}
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

      {/* ── Fitness Baseline ──────────────────────────────────────────── */}
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

        {baseline ? (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              Tested {new Date(baseline.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>

            {(baseline.results.aerobicScore !== undefined || baseline.results.anaerobicScore !== undefined) && (
              <div className="mb-3">
                {baseline.results.aerobicScore !== undefined && (
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
                {baseline.results.anaerobicScore !== undefined && (
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

            <div className="flex flex-col gap-2">
              {([
                { label: '10m Sprint',     value: baseline.test.sprint10m             ? `${baseline.test.sprint10m}s`                    : null, grade: baseline.results.sprint10mGrade },
                { label: '30m Sprint',     value: baseline.test.sprint30m             ? `${baseline.test.sprint30m}s`                    : null, grade: baseline.results.sprint30mGrade },
                { label: 'CMJ (best)',     value: baseline.test.cmjBest               ? `${baseline.test.cmjBest}cm`                     : null, grade: baseline.results.cmjGrade       },
                { label: 'Fatigue Index',  value: baseline.results.fatigueIndex       ? `${baseline.results.fatigueIndex.toFixed(1)}%`   : null, grade: baseline.results.fiGrade        },
                { label: 'Yo-Yo IR1',      value: baseline.test.yoyoLevel             ? `Level ${baseline.test.yoyoLevel}`               : null, grade: baseline.results.yoyoGrade      },
              ] as { label: string; value: string | null; grade?: 1|2|3|4 }[]).filter(r => r.value).map(row => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-600 flex-1">{row.label}</span>
                  <span className="text-xs font-bold text-gray-800">{row.value}</span>
                  {row.grade && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${GRADE_COLOURS[row.grade].bg} ${GRADE_COLOURS[row.grade].text} ${GRADE_COLOURS[row.grade].border}`}>
                      {GRADE_LABELS[row.grade]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center mb-2">
              <Activity size={18} className="text-brand-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">No test on record</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              A 15-minute battery measures your aerobic &amp; anaerobic energy systems against football-specific norms.
            </p>
          </div>
        )}
      </Card>

      {/* ── Settings ──────────────────────────────────────────────────── */}
      <Card className="p-4 mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Settings &amp; Preferences</h3>
        <p className="text-xs text-gray-400 mb-3">More settings will be added here over time.</p>

        <div className="divide-y divide-gray-100">
          <SettingRow
            icon={<PlayCircle size={15} />}
            label="Tutorial videos &amp; explanations"
            description="Show demo videos and step-by-step how-to guides inside each exercise during a workout and in exercise detail"
            enabled={settings.showTutorialVideos}
            onToggle={() => onUpdateSettings({ showTutorialVideos: !settings.showTutorialVideos })}
          />

          {/* Placeholder rows so user can see the pattern — easy to wire up */}
          <div className="flex items-center gap-3 py-3 opacity-40 pointer-events-none">
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <ChevronRight size={14} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">More settings coming soon</div>
              <div className="text-xs text-gray-400">Rest timer sounds, units, theme…</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Account ───────────────────────────────────────────────────── */}
      <Card className="p-4 mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Account</h3>
        {profilePicture && (
          <button
            onClick={() => onSetProfilePicture(null)}
            className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center gap-2 hover:text-gray-900"
          >
            <Camera size={15} className="text-gray-400" />
            Remove profile photo
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm('This will reset your profile and show the onboarding again. Your workout history will be kept. Continue?')) {
              onResetProfile();
            }
          }}
          className="w-full text-left text-sm text-red-500 py-2.5 flex items-center gap-2 hover:text-red-600 border-t border-gray-100 mt-1 pt-3"
        >
          <LogOut size={15} />
          Reset profile &amp; restart onboarding
        </button>
      </Card>
    </Layout>
  );
}
