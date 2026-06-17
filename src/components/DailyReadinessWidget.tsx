import { useState, useEffect, useRef } from 'react';
import { Zap, Check, PlayCircle, Activity, Loader2, RefreshCw } from 'lucide-react';
import { DailyReadiness } from '../types';
import { calcReadiness } from '../lib/programmeGenerator';
import {
  isHealthKitSupported, connectHealth, fetchRecovery,
  calcSleepScore, sleepHoursToScore, calcFatigueScore,
  MIN_RECOVERY_BASELINE_DAYS,
  type RecoveryData,
} from '../lib/healthKit';

// Fatigue/recovery is scored 0–100 (100 = fresh). The readiness model also keeps
// a 1–5 fatigue value (1 = fresh) as a fallback, so map the score onto it.
const fatigueScoreToSlider = (score: number): number =>
  Math.max(1, Math.min(5, Math.round(5 - (score / 100) * 4)));

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

function ScoreRing({
  score, label, colorClass, size = 64,
}: {
  score: number; label: string; colorClass: 'violet' | 'teal'; size?: number;
}) {
  const sw = Math.max(4, Math.round(size * 0.09));
  const r = (size - sw) / 2 - 1;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const s = colorClass === 'violet'
    ? { track: '#ede9fe', stroke: '#7c3aed', text: '#6d28d9', sub: '#7c3aed' }
    : { track: '#ccfbf1', stroke: '#0d9488', text: '#0f766e', sub: '#0d9488' };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.track} strokeWidth={sw} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={s.stroke} strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ color: s.text, fontSize: size < 56 ? 11 : 14, fontWeight: 900, lineHeight: 1 }}>
            {score}
          </span>
        </div>
      </div>
      <span style={{ color: s.sub, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  );
}

// Quick-tap row: 1–5 dots
function QuickSlider({
  label, value, onChange, inverted, healthFilled,
}: { label: string; value: number; onChange: (v: number) => void; inverted?: boolean; healthFilled?: boolean }) {
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
        <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
          {label}
          {healthFilled && <Activity size={10} className="text-brand-500" />}
        </span>
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
  // Last Apple Health pull (today's metrics + 30-day baselines). The baseline is
  // read straight from Apple Health — NOT from in-app logs — so days the athlete
  // never opens the app can't skew their average.
  const [healthData, setHealthData] = useState<RecoveryData | null>(null);

  const [open, setOpen] = useState(false);
  const [quickSyncing, setQuickSyncing] = useState(false);
  const [showQuickHealthInfo, setShowQuickHealthInfo] = useState(false);
  // Sleep is always pre-filled (from health data or the 7.5h fallback), so mark it
  // as health-derived from the start. Fatigue is only marked when Apple Health provides
  // a recovery score with enough baseline days.
  const [healthFilledFields, setHealthFilledFields] = useState<Set<'sleep' | 'fatigue'>>(() =>
    new Set<'sleep' | 'fatigue'>([
      'sleep',
      ...(existing?.fatigueScore != null ? ['fatigue' as const] : []),
    ])
  );
  // Pre-fill sliders with today's logged values when editing; default to neutral midpoint (3)
  // so a user who taps Save without moving any slider doesn't silently log "High Readiness"
  const [sleep, setSleep]       = useState(() => existing?.sleep    ?? 3);
  const [fatigue, setFatigue]   = useState(() => existing?.fatigue  ?? 3);
  const [soreness, setSoreness] = useState(() => existing?.soreness ?? 3);
  const [stress, setStress]     = useState(() => existing?.stress   ?? 3);
  const [sleepHours, setSleepHours] = useState(() => existing?.sleepHours?.toString() ?? '7.5');
  const [hrvMs, setHrvMs] = useState(() => existing?.hrvMs?.toString() ?? '');
  const [restingHr, setRestingHr] = useState(() => existing?.restingHr?.toString() ?? '');
  const backfilledEntryKey = useRef<string | null>(null);

  // One-tap sync: fetch Apple Health → auto-fill sliders → auto-save immediately.
  const handleQuickSync = async () => {
    if (!isHealthKitSupported()) return;
    setQuickSyncing(true);
    try {
      const granted = await connectHealth();
      if (!granted) return;
      localStorage.setItem('vf_health_connected', '1');
      const data = await fetchRecovery();
      if (!data) return;
      setHealthData(data);
      const sleepScore = data.sleepHours != null
        ? calcSleepScore(data.sleepHours, undefined, undefined, undefined, data.avgSleepHours, data.sleepBaselineDays)
        : undefined;
      const fatigueScore = calcFatigueScore(
        data.hrvMs,
        data.restingHr,
        data.avgHrvMs,
        data.avgRestingHr,
        data.hrvBaselineDays,
        data.restingHrBaselineDays,
      );
      const s = data.sleepHours != null ? sleepHoursToScore(data.sleepHours) : 3;
      const f = fatigueScore != null ? fatigueScoreToSlider(fatigueScore) : 3;
      setHealthFilledFields(prev => {
        const next = new Set(prev);
        if (data.sleepHours != null) next.add('sleep');
        if (fatigueScore != null) next.add('fatigue');
        return next;
      });
      const raw = calcReadiness({
        sleep: s, fatigue: f, soreness: 3, stress: 3,
        sleepScore100: sleepScore, fatigueScore100: fatigueScore ?? undefined,
      });
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      onSave({
        date: localDate,
        sleep: s, fatigue: f, soreness: 3, stress: 3,
        ...(data.sleepHours != null ? { sleepHours: data.sleepHours } : {}),
        ...(data.hrvMs      != null ? { hrvMs: data.hrvMs }           : {}),
        ...(data.restingHr  != null ? { restingHr: data.restingHr }  : {}),
        ...(sleepScore      != null ? { sleepScore }                  : {}),
        ...(fatigueScore    != null ? { fatigueScore }                : {}),
        score: raw.score,
        level: raw.level,
        completedAt: Date.now(),
      });
    } finally {
      setQuickSyncing(false);
    }
  };

  // Auto-pull from Apple Health on open once the athlete has connected once.
  // • No existing entry → fetch + auto-save (handleQuickSync).
  // • Already logged today → load the Apple Health baseline so the backfill
  //   effect below can repair old entries without a manual Edit → Save.
  // Try the background read if the "connected" flag exists, or if the entry
  // already has Health metrics from a previous install/cloud restore.
  useEffect(() => {
    if (!isHealthKitSupported()) return;
    const hasConnectedBefore = localStorage.getItem('vf_health_connected') === '1';
    const hasHealthMetrics = existing?.sleepHours != null || existing?.hrvMs != null || existing?.restingHr != null;
    if (!hasConnectedBefore && !hasHealthMetrics) return;
    if (!existing) {
      if (hasConnectedBefore) void handleQuickSync();
    } else {
      fetchRecovery().then(data => { if (data) setHealthData(data); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync sliders if existing changes after mount (e.g. cloud restore)
  useEffect(() => {
    if (!existing) return;
    setSleep(existing.sleep);
    setFatigue(existing.fatigue);
    setSoreness(existing.soreness);
    setStress(existing.stress);
    setSleepHours(existing.sleepHours?.toString() ?? '');
    setHrvMs(existing.hrvMs?.toString() ?? '');
    setRestingHr(existing.restingHr?.toString() ?? '');
  }, [existing]);

  // Backfill today's existing entry if it was saved before the /100 scoring fields
  // existed. This makes Sleep/Fatigue badges and the readiness level update as soon
  // as Apple Health data arrives — no Edit → Save tap required.
  useEffect(() => {
    if (!existing) return;

    // Only derive a /100 sleep score from REAL logged sleep hours. Never fabricate
    // one from a default — for a slider-only entry that would override the user's
    // manual Sleep slider in calcReadiness below.
    const sleepScore = existing.sleepHours != null
      ? calcSleepScore(
          existing.sleepHours,
          undefined, undefined, undefined,
          healthData?.avgSleepHours,
          healthData?.sleepBaselineDays,
        )
      : existing.sleepScore;
    const fatigueScore = healthData != null
      ? calcFatigueScore(
          existing.hrvMs,
          existing.restingHr,
          healthData.avgHrvMs,
          healthData.avgRestingHr,
          healthData.hrvBaselineDays,
          healthData.restingHrBaselineDays,
        ) ?? undefined
      : existing.fatigueScore;

    const sleepChanged = sleepScore !== existing.sleepScore;
    const fatigueChanged = fatigueScore !== existing.fatigueScore;
    if (!sleepChanged && !fatigueChanged) return;

    const key = `${existing.date}:${sleepScore ?? ''}:${fatigueScore ?? ''}`;
    if (backfilledEntryKey.current === key) return;
    backfilledEntryKey.current = key;

    const raw = calcReadiness({
      sleep: existing.sleep,
      fatigue: existing.fatigue,
      soreness: existing.soreness,
      stress: existing.stress,
      sleepScore100: sleepScore,
      fatigueScore100: fatigueScore,
    });

    onSave({
      ...existing,
      sleepScore: sleepScore ?? undefined,
      fatigueScore: fatigueScore ?? undefined,
      score: raw.score,
      level: raw.level,
    });
  }, [existing, healthData, onSave]);

  const handleSave = () => {
    const parsedSleepHours = parseOptionalMetric(sleepHours);
    const parsedHrvMs = parseOptionalMetric(hrvMs);
    const parsedRestingHr = parseOptionalMetric(restingHr);
    const sleepScore = parsedSleepHours != null
      ? calcSleepScore(parsedSleepHours, undefined, undefined, undefined, healthData?.avgSleepHours, healthData?.sleepBaselineDays)
      : undefined;
    // Fatigue /100 needs the Apple Health baseline; null (→ undefined) when there's
    // no baseline, in which case the 1–5 fatigue slider drives readiness instead.
    const fatigueScore = calcFatigueScore(
      parsedHrvMs,
      parsedRestingHr,
      healthData?.avgHrvMs,
      healthData?.avgRestingHr,
      healthData?.hrvBaselineDays,
      healthData?.restingHrBaselineDays,
    ) ?? undefined;
    const raw = calcReadiness({
      sleep, fatigue, soreness, stress,
      sleepScore100: sleepScore, fatigueScore100: fatigueScore,
    });
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const entry: DailyReadiness = {
      date: localDate,
      sleep, fatigue, soreness, stress,
      ...(parsedSleepHours !== undefined ? { sleepHours: parsedSleepHours } : {}),
      ...(parsedHrvMs      !== undefined ? { hrvMs: parsedHrvMs }           : {}),
      ...(parsedRestingHr  !== undefined ? { restingHr: parsedRestingHr }   : {}),
      ...(sleepScore       !== undefined ? { sleepScore }                   : {}),
      ...(fatigueScore     !== undefined ? { fatigueScore }                 : {}),
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
    // Compute scores on-the-fly if not stored (entries saved before scoring was added).
    // Sleep only needs sleepHours; fatigue needs the Apple Health baseline (loads async).
    const displaySleepScore = calcSleepScore(
      existing.sleepHours ?? 7.5,
      undefined, undefined, undefined,
      healthData?.avgSleepHours,
      healthData?.sleepBaselineDays,
    );
    const displayFatigueScore = healthData != null
      ? calcFatigueScore(
          existing.hrvMs,
          existing.restingHr,
          healthData.avgHrvMs,
          healthData.avgRestingHr,
          healthData.hrvBaselineDays,
          healthData.restingHrBaselineDays,
        )
      : existing.fatigueScore ?? null;
    return (
      <div className={`w-full mb-5 p-4 rounded-2xl border ${cfg.light}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg}`}>
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label} Readiness · {existing.score.toFixed(1)}/5</p>
              <p className="text-xs text-gray-500">Today's check-in complete</p>
              {(existing.sleepHours != null || existing.hrvMs != null || existing.restingHr != null) && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {existing.sleepHours != null && `${existing.sleepHours.toFixed(1)}h sleep`}
                  {existing.hrvMs != null && `${existing.sleepHours != null ? ' · ' : ''}${Math.round(existing.hrvMs)}ms HRV`}
                  {existing.restingHr != null && `${existing.sleepHours != null || existing.hrvMs != null ? ' · ' : ''}${Math.round(existing.restingHr)} bpm RHR`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs text-gray-400 underline"
          >
            Edit
          </button>
        </div>
        {(displaySleepScore != null || displayFatigueScore != null) && (
          <div className="flex justify-center gap-8 mt-3 pt-3 border-t border-gray-100">
            {displaySleepScore != null && (
              <ScoreRing score={displaySleepScore} label="Sleep" colorClass="violet" size={56} />
            )}
            {displayFatigueScore != null && (
              <ScoreRing score={displayFatigueScore} label="Fatigue" colorClass="teal" size={56} />
            )}
          </div>
        )}
        {open && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <ReadinessForm
              sleep={sleep} fatigue={fatigue} soreness={soreness} stress={stress}
              setSleep={setSleep} setFatigue={setFatigue} setSoreness={setSoreness} setStress={setStress}
              sleepHours={sleepHours} hrvMs={hrvMs} restingHr={restingHr}
              setSleepHours={setSleepHours} setHrvMs={setHrvMs} setRestingHr={setRestingHr}
              healthData={healthData}
              onHealthData={setHealthData}
              onSave={handleSave}
              healthFilledFields={healthFilledFields}
              onHealthFilledChange={setHealthFilledFields}
            />
          </div>
        )}
      </div>
    );
  }

  // Not yet logged — collapsed CTA with Start + optional one-tap Health import
  if (!open) {
    return (
      <>
        {showQuickHealthInfo && (
          <HealthPermissionInfo
            onContinue={() => {
              setShowQuickHealthInfo(false);
              void handleQuickSync();
            }}
          />
        )}
        <div className="w-full mb-5 rounded-2xl border-2 border-dashed border-gray-200 bg-white overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">Daily Readiness</p>
              {/* Apple Health is clearly identified on the entry point (App Store guideline 2.5.1) */}
              {isHealthKitSupported()
                ? <p className="text-xs text-brand-600 font-semibold flex items-center gap-1"><Activity size={12} /> Syncs with Apple Health</p>
                : <p className="text-xs text-gray-400">Log how you feel in 30 seconds</p>
              }
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isHealthKitSupported() && (
                <button
                  onClick={() => setShowQuickHealthInfo(true)}
                  disabled={quickSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 border border-brand-200 text-brand-700 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors"
                  title="Continue to Apple Health"
                >
                  {quickSyncing
                    ? <Loader2 size={14} className="animate-spin" />
                    : <RefreshCw size={14} />
                  }
                  {quickSyncing ? 'Continuing…' : 'Continue'}
                </button>
              )}
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors"
              >
                <PlayCircle size={15} />
                Start
              </button>
            </div>
          </div>
        </div>
      </>
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
        sleepHours={sleepHours} hrvMs={hrvMs} restingHr={restingHr}
        setSleepHours={setSleepHours} setHrvMs={setHrvMs} setRestingHr={setRestingHr}
        healthData={healthData}
        onHealthData={setHealthData}
        onSave={handleSave}
        healthFilledFields={healthFilledFields}
        onHealthFilledChange={setHealthFilledFields}
      />
    </div>
  );
}

function parseOptionalMetric(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function ReadinessForm({
  sleep, fatigue, soreness, stress,
  setSleep, setFatigue, setSoreness, setStress,
  sleepHours, hrvMs, restingHr,
  setSleepHours, setHrvMs, setRestingHr,
  healthData,
  onHealthData,
  onSave,
  healthFilledFields,
  onHealthFilledChange,
}: {
  sleep: number; fatigue: number; soreness: number; stress: number;
  setSleep: (v: number) => void; setFatigue: (v: number) => void;
  setSoreness: (v: number) => void; setStress: (v: number) => void;
  sleepHours: string; hrvMs: string; restingHr: string;
  setSleepHours: (v: string) => void; setHrvMs: (v: string) => void; setRestingHr: (v: string) => void;
  healthData: RecoveryData | null;
  onHealthData: (data: RecoveryData) => void;
  onSave: () => void;
  healthFilledFields: Set<'sleep' | 'fatigue'>;
  onHealthFilledChange: (v: Set<'sleep' | 'fatigue'>) => void;
}) {
  const [hkBusy, setHkBusy] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [hkError, setHkError] = useState(false);
  const [showHealthInfo, setShowHealthInfo] = useState(false);

  // Web-preview flag: HealthKit is iOS-only. The localStorage 'vf_health_preview'
  // toggle reveals the UI on web with SAMPLE data to preview layout — but ONLY in
  // development builds, so it can't be enabled by editing localStorage in prod.
  const healthPreview = (() => {
    if (!import.meta.env.DEV) return false;
    try { return localStorage.getItem('vf_health_preview') === '1'; } catch { return false; }
  })();
  const showHealth = isHealthKitSupported() || healthPreview;
  const effectiveRecovery = recovery ?? healthData;
  const parsedHrvMs = parseOptionalMetric(hrvMs);
  const parsedRestingHr = parseOptionalMetric(restingHr);
  const liveFatigueScore = calcFatigueScore(
    parsedHrvMs,
    parsedRestingHr,
    effectiveRecovery?.avgHrvMs,
    effectiveRecovery?.avgRestingHr,
    effectiveRecovery?.hrvBaselineDays,
    effectiveRecovery?.restingHrBaselineDays,
  );
  const fatigueBaselineDays = Math.max(
    effectiveRecovery?.hrvBaselineDays ?? 0,
    effectiveRecovery?.restingHrBaselineDays ?? 0,
  );

  // iOS-only: pull last night's recovery from Apple Health and auto-fill the
  // sleep slider. HRV / resting HR are shown as context. Scoring is unchanged —
  // the user can still adjust every slider before saving.
  const autofillFromHealth = async () => {
    setHkBusy(true);
    setHkError(false);
    try {
      if (!isHealthKitSupported()) {
        // Web preview only — HealthKit can't exist on web, so show sample data
        // (incl. 30-day baselines so the fatigue score can be previewed).
        const demo: RecoveryData = {
          sleepHours: 7.4,
          hrvMs: 62,
          restingHr: 51,
          avgSleepHours: 7.1,
          avgHrvMs: 58,
          avgRestingHr: 53,
          sleepBaselineDays: MIN_RECOVERY_BASELINE_DAYS,
          hrvBaselineDays: MIN_RECOVERY_BASELINE_DAYS,
          restingHrBaselineDays: MIN_RECOVERY_BASELINE_DAYS,
        };
        setRecovery(demo);
        onHealthData(demo);
        setSleepHours(demo.sleepHours!.toString());
        setHrvMs(demo.hrvMs!.toString());
        setRestingHr(demo.restingHr!.toString());
        setSleep(sleepHoursToScore(demo.sleepHours!));
        const fScore = calcFatigueScore(
          demo.hrvMs,
          demo.restingHr,
          demo.avgHrvMs,
          demo.avgRestingHr,
          demo.hrvBaselineDays,
          demo.restingHrBaselineDays,
        );
        const next = new Set(healthFilledFields);
        next.add('sleep');
        if (fScore != null) { setFatigue(fatigueScoreToSlider(fScore)); next.add('fatigue'); }
        onHealthFilledChange(next);
        return;
      }
      const granted = await connectHealth();
      if (!granted) { setHkError(true); return; }
      localStorage.setItem('vf_health_connected', '1');
      const data = await fetchRecovery();
      if (!data) { setHkError(true); return; }
      setRecovery(data);
      onHealthData(data);
      // Auto-fill every slider we have data for — user can still adjust before saving.
      const next = new Set(healthFilledFields);
      if (data.sleepHours != null) {
        setSleepHours(data.sleepHours.toFixed(1));
        setSleep(sleepHoursToScore(data.sleepHours));
        next.add('sleep');
      }
      if (data.hrvMs != null) setHrvMs(String(Math.round(data.hrvMs)));
      if (data.restingHr != null) setRestingHr(String(Math.round(data.restingHr)));
      const fatigueScore = calcFatigueScore(
        data.hrvMs,
        data.restingHr,
        data.avgHrvMs,
        data.avgRestingHr,
        data.hrvBaselineDays,
        data.restingHrBaselineDays,
      );
      if (fatigueScore != null) { setFatigue(fatigueScoreToSlider(fatigueScore)); next.add('fatigue'); }
      onHealthFilledChange(next);
      // stress stays manual — HR does not auto-set it
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
            onClick={() => {
              if (isHealthKitSupported()) {
                setShowHealthInfo(true);
                return;
              }
              void autofillFromHealth();
            }}
            disabled={hkBusy}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-brand-700 disabled:opacity-60"
          >
            {hkBusy ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />}
            {hkBusy ? 'Continuing…' : 'Continue'}
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
      <div className="grid grid-cols-3 gap-2">
        <MetricInput
          label="Sleep"
          suffix="h"
          value={sleepHours}
          onChange={(next) => {
            setSleepHours(next);
            const parsed = parseOptionalMetric(next);
            if (parsed !== undefined) setSleep(sleepHoursToScore(parsed));
          }}
          placeholder="7.5"
          step="0.1"
        />
        <MetricInput
          label="HRV"
          suffix="ms"
          value={hrvMs}
          onChange={(next) => {
            setHrvMs(next);
            const f = calcFatigueScore(
              parseOptionalMetric(next),
              parseOptionalMetric(restingHr),
              effectiveRecovery?.avgHrvMs,
              effectiveRecovery?.avgRestingHr,
              effectiveRecovery?.hrvBaselineDays,
              effectiveRecovery?.restingHrBaselineDays,
            );
            if (f != null) setFatigue(fatigueScoreToSlider(f));
          }}
          placeholder="62"
        />
        <MetricInput
          label="Rest HR"
          suffix="bpm"
          value={restingHr}
          onChange={(next) => {
            setRestingHr(next);
            const f = calcFatigueScore(
              parseOptionalMetric(hrvMs),
              parseOptionalMetric(next),
              effectiveRecovery?.avgHrvMs,
              effectiveRecovery?.avgRestingHr,
              effectiveRecovery?.hrvBaselineDays,
              effectiveRecovery?.restingHrBaselineDays,
            );
            if (f != null) setFatigue(fatigueScoreToSlider(f));
          }}
          placeholder="51"
        />
      </div>
      {parsedHrvMs != null && parsedRestingHr != null && liveFatigueScore == null && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
          Fatigue score unlocks on day 6 after {MIN_RECOVERY_BASELINE_DAYS} Apple Health baseline days
          {fatigueBaselineDays > 0 ? ` (${Math.min(fatigueBaselineDays, MIN_RECOVERY_BASELINE_DAYS)}/${MIN_RECOVERY_BASELINE_DAYS} days collected).` : '. Tap Continue.'}
        </p>
      )}
      <p className="text-[11px] text-gray-400 text-center">
        Optional recovery metrics feed the graph below. Apple Health can fill these automatically.
      </p>
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        <Activity size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700 leading-snug">
          Sleep quality and Fatigue are pre-filled from your health data — override these manually if they don't feel right.
        </p>
      </div>
      <QuickSlider label="Sleep quality" value={sleep} onChange={setSleep} healthFilled={healthFilledFields.has('sleep')} />
      <QuickSlider label="Fatigue" value={fatigue} onChange={setFatigue} inverted healthFilled={healthFilledFields.has('fatigue')} />
      <QuickSlider label="Soreness" value={soreness} onChange={setSoreness} inverted />
      <QuickSlider label="Stress" value={stress} onChange={setStress} inverted />
      <button
        onClick={onSave}
        className="w-full mt-1 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-600 transition-colors"
      >
        <Check size={16} />
        Save Readiness
      </button>
      {showHealthInfo && (
        <HealthPermissionInfo
          onContinue={() => {
            setShowHealthInfo(false);
            void autofillFromHealth();
          }}
        />
      )}
    </div>
  );
}

function HealthPermissionInfo({
  onContinue,
}: {
  onContinue: () => void;
}) {
  // App Store guideline 5.1.1(iv): this explanatory message must NOT offer a way
  // to exit/delay the permission request. The user always proceeds to the system
  // Apple Health permission sheet after the message (where they can allow or deny
  // each data type). So there is intentionally no Cancel/close/backdrop-dismiss here.
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50">
          <Activity size={20} className="text-brand-600" />
        </div>
        <h3 className="mb-2 text-center text-lg font-extrabold text-gray-900">Use Apple Health?</h3>
        <p className="mb-5 text-center text-sm leading-relaxed text-gray-500">
          Vector Football can read sleep, HRV, and resting heart rate from Apple Health to fill your readiness check-in. You can edit the values before saving. We do not write data to Apple Health.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function MetricInput({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  step = '1',
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      <div className="relative">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ fontSize: '16px' }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">
          {suffix}
        </span>
      </div>
    </label>
  );
}
