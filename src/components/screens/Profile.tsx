import { useRef, useState } from 'react';
import {
  Camera, Mail, User, Shield, Calendar, Target, Dumbbell,
  LogOut, ChevronRight, Activity, Zap, Lock, Eye, EyeOff, Check,
  Ruler, Weight, AlertTriangle, Pencil,
} from 'lucide-react';
import { isSupabaseConfigured, cloudUpdatePassword } from '../../lib/cloudSync';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { UserProfile } from '../../types';
import { BaselineData } from '../../hooks/useStore';
import { GRADE_LABELS, GRADE_COLOURS } from '../../data/testingBattery';

interface ProfileProps {
  userProfile: UserProfile;
  profilePicture: string | null;
  totalSessions: number;
  baseline: BaselineData | null;
  onSetProfilePicture: (pic: string | null) => void;
  onStartBattery: () => void;
  onResetProfile: () => void;
  onChangePassword: (newHash: string) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onLogout: () => void;
  onBack: () => void;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ChangePasswordModal({
  currentHash,
  onSave,
  onClose,
}: {
  currentHash?: string;
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
      const curHash = await hashPassword(currentPw);
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
    const newHash = await hashPassword(newPw);
    setSuccess(true);
    setTimeout(() => { onSave(newHash); onClose(); }, 800);
    setLoading(false);
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
                  autoComplete="current-password" className={inputCls(!!error && !currentPw)} />
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
                autoComplete="new-password" className={inputCls(newPw !== '' && !passwordStrong)} />
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
                autoComplete="new-password" className={inputCls(confirmPw !== '' && !passwordsMatch)} />
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


function EditMetricsModal({
  currentHeight,
  currentWeight,
  onSave,
  onClose,
}: {
  currentHeight?: number;
  currentWeight?: number;
  onSave: (heightCm?: number, weightKg?: number) => void;
  onClose: () => void;
}) {
  const [heightStr, setHeightStr] = useState(currentHeight ? String(currentHeight) : '');
  const [weightStr, setWeightStr] = useState(currentWeight ? String(currentWeight) : '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const h = heightStr ? parseFloat(heightStr) : undefined;
    const w = weightStr ? parseFloat(weightStr) : undefined;
    setSaved(true);
    setTimeout(() => { onSave(h, w); onClose(); }, 600);
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

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Height (cm)
            </label>
            <input
              value={heightStr}
              onChange={e => setHeightStr(e.target.value)}
              type="number"
              min="100"
              max="230"
              placeholder="e.g. 180"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Weight (kg)
            </label>
            <input
              value={weightStr}
              onChange={e => setWeightStr(e.target.value)}
              type="number"
              min="30"
              max="200"
              placeholder="e.g. 75"
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

// ── Edit Training Profile Modal ────────────────────────────────────────────

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

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      onSave({ position, experienceYears, gymFrequency, gymAccess });
      onClose();
    }, 600);
  };

  const btnBase = 'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all text-center';
  const btnActive = 'bg-brand-500 text-white border-brand-500';
  const btnInactive = 'bg-white text-gray-600 border-gray-200 hover:border-brand-300';

  // ── Step 1: warning ────────────────────────────────────────────────────────
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

  // ── Step 2: edit form ──────────────────────────────────────────────────────
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
  baseline, onSetProfilePicture,
  onStartBattery, onResetProfile, onChangePassword, onUpdateProfile, onLogout, onBack,
}: ProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showChangePw,         setShowChangePw]         = useState(false);
  const [showEditMetrics,      setShowEditMetrics]      = useState(false);
  const [showEditTraining,     setShowEditTraining]     = useState(false);

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

      {/* ── Body Metrics ──────────────────────────────────────────────── */}
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
        <div className="flex gap-4">
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
        </div>
      </Card>

      {/* ── Account ───────────────────────────────────────────────────── */}
      <Card className="p-4 mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Account</h3>

        {/* Change Password */}
        <button
          onClick={() => setShowChangePw(true)}
          className="w-full text-left text-sm text-gray-600 py-2.5 flex items-center justify-between gap-2 hover:text-gray-900"
        >
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-gray-400" />
            Change Password
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

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
          onClick={() => {
            if (window.confirm('⚠️ This will permanently delete your account and ALL data (workouts, programmes, history). This cannot be undone. Continue?')) {
              onResetProfile();
            }
          }}
          className="w-full text-left text-sm text-red-500 py-2.5 flex items-center gap-2 hover:text-red-600 border-t border-gray-100 mt-1 pt-3"
        >
          Delete Account &amp; All Data
        </button>
      </Card>

      {showChangePw && (
        <ChangePasswordModal
          currentHash={userProfile.passwordHash}
          onSave={onChangePassword}
          onClose={() => setShowChangePw(false)}
        />
      )}

      {showEditMetrics && (
        <EditMetricsModal
          currentHeight={userProfile.heightCm}
          currentWeight={userProfile.weightKg}
          onSave={(h, w) => onUpdateProfile({ heightCm: h, weightKg: w })}
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
          onSave={(updates) => onUpdateProfile(updates)}
          onClose={() => setShowEditTraining(false)}
        />
      )}
    </Layout>
  );
}
