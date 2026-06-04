import { useState, useEffect } from 'react';
import { Zap, Check, PlayCircle, Activity, Loader2 } from 'lucide-react';
import { DailyReadiness } from '../types';
import { calcReadiness } from '../lib/programmeGenerator';
import {
  isHealthKitSupported, connectHealth, fetchRecovery,
  sleepHoursToScore, hrvToFatigueScore, restingHrToStressScore,
  type RecoveryData,
} from '../lib/healthKit';

interface Props {
  existing: DailyReadiness | null;
  onSave: (entry: DailyReadiness) => void;
}

const LEVEL_CONFIG = {
  elite:    { bg: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Elite' },
  high:     { bg: 'bg-green-500',   light: 'bg-green-50 border-green-200',     text: 'text-green-700',   label: 'High' },
  moderate: { bg: 'bg-yellow-500',  light: 'bg-yellow-50 border-yellow-200',   text: 'text-yellow-700',  label: 'Moderate' },
  low:      { bg: 'bg-red-500',     light: 'bg-red-50 border-red-200',         text: 'text-red-700',     label: 'Low' },
};

// Quick-tap row: 1–5 dots
function QuickSlider({
  label, value, onChange, inverted,
}: { label: string; value: number; onChange: (v: number) => void; inverted?: boolean }) {
  const dotColour = (d: number) => {
    const isActive = d === value;
    if (!isActive) return 'bg-gray-200';
    const good = inverted ? d <= 2 : d >= 4;
    const bad  = inverted ? d >= 4 : d <= 2;
    if (good) return 'bg-green-500';
    if (bad)  return 'bg-red-500';
    return 'bg-yellow-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-700">{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => i + 1).map(d => (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${dotColour(d)} ${
              d === value ? 'scale-110 shadow-sm text-white' : 'text-gray-400 hover:opacity-70'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DailyReadinessWidget({ existing, onSave }: Props) {
  const [open, setOpen] = useState(false);
  // Pre-fill sliders with today's logged values when editing; default to neutral midpoint (3)
  // so a user who taps Save without moving any slider doesn't silently log "High Readiness"
  const [sleep, setSleep]       = useState(() => existing?.sleep    ?? 3);
  const [fatigue, setFatigue]   = useState(() => existing?.fatigue  ?? 3);
  const [soreness, setSoreness] = useState(() => existing?.soreness ?? 3);
  const [stress, setStress]     = useState(() => existing?.stress   ?? 3);

  // Sync sliders if existing changes after mount (e.g. cloud restore)
  useEffect(() => {
    if (!existing) return;
    setSleep(existing.sleep);
    setFatigue(existing.fatigue);
    setSoreness(existing.soreness);
    setStress(existing.stress);
  }, [existing]);

  const handleSave = () => {
    const raw = calcReadiness({ sleep, fatigue, soreness, stress });
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const entry: DailyReadiness = {
      date: localDate,
      sleep, fatigue, soreness, stress,
      score: raw.score,
      level: raw.level,
      completedAt: Date.now(),
    };
    onSave(entry);
    setOpen(false);
  };

  // Already logged today — show summary (with optional inline edit form)
  if (existing) {
    const cfg = LEVEL_CONFIG[existing.level] ?? LEVEL_CONFIG.high;
    return (
      <div className={`w-full mb-5 p-4 rounded-2xl border ${cfg.light}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg}`}>
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label} Readiness · {existing.score}/5</p>
              <p className="text-xs text-gray-500">Today's check-in complete</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs text-gray-400 underline"
          >
            Edit
          </button>
        </div>
        {open && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <ReadinessForm
              sleep={sleep} fatigue={fatigue} soreness={soreness} stress={stress}
              setSleep={setSleep} setFatigue={setFatigue} setSoreness={setSoreness} setStress={setStress}
              onSave={handleSave}
            />
          </div>
        )}
      </div>
    );
  }

  // Not yet logged — collapsed CTA with prominent Start button
  if (!open) {
    return (
      <div className="w-full mb-5 rounded-2xl border-2 border-dashed border-gray-200 bg-white overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Zap size={18} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700">How are you feeling today?</p>
            <p className="text-xs text-gray-400">Log your daily readiness in 30 seconds</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors flex-shrink-0"
          >
            <PlayCircle size={15} />
            Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-5 p-4 rounded-2xl border border-brand-200 bg-brand-50">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} className="text-brand-500" />
        <p className="text-sm font-bold text-brand-700">Daily Readiness Check-in</p>
        <button onClick={() => setOpen(false)} className="ml-auto text-xs text-gray-400">✕</button>
      </div>
      <ReadinessForm
        sleep={sleep} fatigue={fatigue} soreness={soreness} stress={stress}
        setSleep={setSleep} setFatigue={setFatigue} setSoreness={setSoreness} setStress={setStress}
        onSave={handleSave}
      />
    </div>
  );
}

function ReadinessForm({
  sleep, fatigue, soreness, stress,
  setSleep, setFatigue, setSoreness, setStress,
  onSave,
}: {
  sleep: number; fatigue: number; soreness: number; stress: number;
  setSleep: (v: number) => void; setFatigue: (v: number) => void;
  setSoreness: (v: number) => void; setStress: (v: number) => void;
  onSave: () => void;
}) {
  const [hkBusy, setHkBusy] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [hkError, setHkError] = useState(false);

  // Web-preview flag: HealthKit is iOS-only, so the button is hidden on web for
  // real users. Setting localStorage 'vf_health_preview' = '1' reveals the UI on
  // web with SAMPLE data, purely to preview layout before the iOS build.
  const healthPreview = (() => {
    try { return localStorage.getItem('vf_health_preview') === '1'; } catch { return false; }
  })();
  const showHealth = isHealthKitSupported() || healthPreview;

  // iOS-only: pull last night's recovery from Apple Health and auto-fill the
  // sleep slider. HRV / resting HR are shown as context. Scoring is unchanged —
  // the user can still adjust every slider before saving.
  const autofillFromHealth = async () => {
    setHkBusy(true);
    setHkError(false);
    try {
      if (!isHealthKitSupported()) {
        // Web preview only — HealthKit can't exist on web, so show sample data.
        const demo = { sleepHours: 7.4, hrvMs: 62, restingHr: 51 };
        setRecovery(demo);
        setSleep(sleepHoursToScore(demo.sleepHours));
        setFatigue(hrvToFatigueScore(demo.hrvMs));
        setStress(restingHrToStressScore(demo.restingHr));
        return;
      }
      const granted = await connectHealth();
      if (!granted) { setHkError(true); return; }
      const data = await fetchRecovery();
      if (!data) { setHkError(true); return; }
      setRecovery(data);
      // Auto-fill every slider we have data for — user can still adjust before saving.
      if (data.sleepHours != null) setSleep(sleepHoursToScore(data.sleepHours));
      if (data.hrvMs != null)      setFatigue(hrvToFatigueScore(data.hrvMs));
      if (data.restingHr != null)  setStress(restingHrToStressScore(data.restingHr));
    } finally {
      setHkBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {showHealth && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          {/* HealthKit label — required by App Store guideline 2.5.1 */}
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Apple HealthKit
          </p>
          <button
            onClick={autofillFromHealth}
            disabled={hkBusy}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-brand-700 disabled:opacity-60"
          >
            {hkBusy ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />}
            {hkBusy ? 'Reading Apple Health…' : 'Autofill from Apple Health'}
          </button>
          {recovery && (
            <div className="mt-2 space-y-1">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
                {recovery.sleepHours != null && <span>😴 {recovery.sleepHours.toFixed(1)}h sleep</span>}
                {recovery.hrvMs != null && <span>💓 {Math.round(recovery.hrvMs)}ms HRV</span>}
                {recovery.restingHr != null && <span>❤️ {Math.round(recovery.restingHr)} bpm resting</span>}
              </div>
              <p className="text-center text-xs text-brand-600 font-medium">
                Sliders updated — adjust anything below then tap Save.
              </p>
            </div>
          )}
          {hkError && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Couldn't read Health data. Check Settings → Privacy → Health, or fill in manually below.
            </p>
          )}
          {!isHealthKitSupported() && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Preview with sample data — live Apple Health sync works in the iPhone app.
            </p>
          )}
        </div>
      )}
      <QuickSlider label="Sleep quality" value={sleep} onChange={setSleep} />
      <QuickSlider label="Fatigue" value={fatigue} onChange={setFatigue} inverted />
      <QuickSlider label="Soreness" value={soreness} onChange={setSoreness} inverted />
      <QuickSlider label="Stress" value={stress} onChange={setStress} inverted />
      <button
        onClick={onSave}
        className="w-full mt-1 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-600 transition-colors"
      >
        <Check size={16} />
        Save Readiness
      </button>
    </div>
  );
}
