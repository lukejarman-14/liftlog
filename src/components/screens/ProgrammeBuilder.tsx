/**
 * ProgrammeBuilder — 5-step wizard that collects inputs for the AI programme generator.
 * Pre-fills position, experience, and gym access from the user's saved profile.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Zap, Target, Activity, Brain, Check } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  ProgrammeInputs,
  PrimaryGoal, MatchDayPref, Weakness, InjuryArea,
  UserProfile,
} from '../../types';

interface Props {
  userProfile: UserProfile;
  onGenerate: (inputs: ProgrammeInputs) => void;
  onBack: () => void;
}

// ── Step labels ────────────────────────────────────────────────────────────

const STEPS = ['Schedule', 'Goals', 'Injuries', 'Readiness', 'Review'];

// ── Option helpers ─────────────────────────────────────────────────────────

type Opt<T extends string> = { value: T; label: string; description?: string };

const SESSIONS_OPTS: Opt<string>[] = [
  { value: '2', label: '2 sessions', description: 'Minimum effective dose' },
  { value: '3', label: '3 sessions', description: 'Recommended for most players' },
  { value: '4', label: '4 sessions', description: 'High commitment, maximum results' },
];

const MATCH_DAY_OPTS: Opt<MatchDayPref>[] = [
  { value: 'saturday', label: 'Saturday', description: 'Most common match day' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'midweek', label: 'Midweek (Wed/Thu)' },
];

const GOAL_OPTS: Opt<PrimaryGoal>[] = [
  { value: 'speed', label: '⚡ Speed', description: 'Max velocity & acceleration' },
  { value: 'strength', label: '💪 Strength', description: 'Force production & power base' },
  { value: 'power', label: '🚀 Power', description: 'Explosive athleticism' },
  { value: 'endurance', label: '🫀 Endurance', description: 'Repeated-effort capacity' },
  { value: 'injury_prevention', label: '🛡️ Injury Prevention', description: 'Resilience & prehab focus' },
];

const SECONDARY_GOAL_OPTS: { value: string; label: string }[] = [
  { value: 'speed', label: 'Speed' },
  { value: 'strength', label: 'Strength' },
  { value: 'power', label: 'Power' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'agility', label: 'Agility' },
  { value: 'mobility', label: 'Mobility' },
];

const WEAKNESS_OPTS: Opt<Weakness>[] = [
  { value: 'speed', label: '⚡ Speed', description: 'First step or max velocity' },
  { value: 'strength', label: '💪 Strength', description: 'Lacking force base' },
  { value: 'endurance', label: '🫀 Endurance', description: 'Fade late in games' },
  { value: 'power', label: '🚀 Power', description: 'Explosive actions are weak' },
  { value: 'agility', label: '🔄 Agility', description: 'Change of direction' },
  { value: 'injury_prone', label: '🩹 Injury-prone', description: 'Recurring injuries' },
];

const INJURY_OPTS: { value: InjuryArea; label: string; emoji: string }[] = [
  { value: 'hamstring', label: 'Hamstring', emoji: '🦵' },
  { value: 'ankle', label: 'Ankle', emoji: '🦶' },
  { value: 'knee', label: 'Knee', emoji: '🦵' },
  { value: 'groin', label: 'Groin', emoji: '🩹' },
  { value: 'calf', label: 'Calf', emoji: '🦵' },
  { value: 'back', label: 'Lower Back', emoji: '🔙' },
  { value: 'shoulder', label: 'Shoulder', emoji: '💪' },
];

// ── Readiness slider ───────────────────────────────────────────────────────

function ReadinessSlider({
  label,
  description,
  value,
  onChange,
  inverted,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  inverted?: boolean;
}) {
  const dots = Array.from({ length: 10 }, (_, i) => i + 1);
  const colour = inverted
    ? value <= 3 ? 'bg-green-500' : value <= 6 ? 'bg-yellow-500' : 'bg-red-500'
    : value >= 8 ? 'bg-green-500' : value >= 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <span className={`text-lg font-bold w-8 text-center rounded-full ${colour} text-white py-0.5`}>
          {value}
        </span>
      </div>
      <div className="flex gap-1.5 mt-2">
        {dots.map(d => (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
              d === value
                ? `${colour} text-white shadow-md scale-110`
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Chip selector ──────────────────────────────────────────────────────────

function ChipSelector<T extends string>({
  options,
  selected,
  onToggle,
  multi,
}: {
  options: { value: T; label: string; description?: string }[];
  selected: T | T[];
  onToggle: (v: T) => void;
  multi?: boolean;
}) {
  const isSelected = (v: T) =>
    multi ? (selected as T[]).includes(v) : selected === v;

  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onToggle(opt.value)}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
            isSelected(opt.value)
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="font-semibold text-sm">{opt.label}</div>
          {opt.description && (
            <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ProgrammeBuilder({ userProfile, onGenerate, onBack }: Props) {
  const [step, setStep] = useState(0);

  const [sessionsPerWeek, setSessionsPerWeek] = useState<2 | 3 | 4>(3);
  const [matchDay, setMatchDay] = useState<MatchDayPref>('saturday');
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>('speed');
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [biggestWeakness, setBiggestWeakness] = useState<Weakness>('speed');
  const [injuryHistory, setInjuryHistory] = useState<InjuryArea[]>([]);
  const [readiness, setReadiness] = useState({ sleep: 7, fatigue: 4, soreness: 4, stress: 4 });

  const toggleSecondary = (v: string) => {
    if (v === primaryGoal) return; // can't pick primary as secondary
    setSecondaryGoals(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v].slice(0, 3),
    );
  };

  const toggleInjury = (v: InjuryArea) => {
    setInjuryHistory(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v],
    );
  };

  const handleGenerate = () => {
    const inputs: ProgrammeInputs = {
      position: userProfile.position,
      experienceYears: userProfile.experienceYears,
      sessionsPerWeek,
      primaryGoal,
      secondaryGoals,
      matchDay,
      biggestWeakness,
      injuryHistory,
      readiness,
      gymAccess: userProfile.gymAccess,
    };
    onGenerate(inputs);
  };

  const canNext = (): boolean => {
    return true; // all steps have valid defaults
  };

  const stepIcons = [Activity, Target, Brain, Zap, Check];
  const StepIcon = stepIcons[step];

  const stepColours = [
    'text-blue-600', 'text-purple-600', 'text-orange-600', 'text-green-600', 'text-brand-600',
  ];

  return (
    <Layout
      title="Build My Programme"
      leftAction={
        <button onClick={step === 0 ? onBack : () => setStep(s => s - 1)} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft size={24} />
        </button>
      }
    >
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div
              className={`h-1.5 rounded-full transition-all ${
                i <= step ? 'bg-brand-500' : 'bg-gray-200'
              }`}
            />
            <span className={`text-center text-xs ${i === step ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step header */}
      <div className={`flex items-center gap-2 mb-5 ${stepColours[step]}`}>
        <StepIcon size={22} />
        <h2 className="text-lg font-bold text-gray-900">
          {step === 0 && 'Training Schedule'}
          {step === 1 && 'Goals & Weakness'}
          {step === 2 && 'Injury History'}
          {step === 3 && "Today's Readiness"}
          {step === 4 && 'Review & Generate'}
        </h2>
      </div>

      {/* ── Step 0: Schedule ──────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Sessions per week</p>
            <ChipSelector
              options={SESSIONS_OPTS as Opt<string>[]}
              selected={String(sessionsPerWeek)}
              onToggle={v => setSessionsPerWeek(Number(v) as 2 | 3 | 4)}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Match day</p>
            <ChipSelector
              options={MATCH_DAY_OPTS}
              selected={matchDay}
              onToggle={setMatchDay}
            />
          </div>
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-xs text-blue-700 font-medium">Using your profile</p>
            <p className="text-xs text-blue-600 mt-1">
              Position: <strong>{userProfile.position}</strong> · Experience: <strong>{userProfile.experienceYears} yrs</strong> · Gym: <strong>{userProfile.gymAccess}</strong>
            </p>
          </Card>
        </div>
      )}

      {/* ── Step 1: Goals ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Primary goal <span className="text-gray-400 font-normal">(choose one — gets majority focus)</span></p>
            <ChipSelector
              options={GOAL_OPTS}
              selected={primaryGoal}
              onToggle={setPrimaryGoal}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Secondary goals <span className="text-gray-400 font-normal">(up to 3 — minimum effective dose)</span></p>
            <div className="flex flex-wrap gap-2">
              {SECONDARY_GOAL_OPTS.filter(o => o.value !== primaryGoal).map(o => (
                <button
                  key={o.value}
                  onClick={() => toggleSecondary(o.value)}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    secondaryGoals.includes(o.value)
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-brand-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Biggest weakness</p>
            <ChipSelector
              options={WEAKNESS_OPTS}
              selected={biggestWeakness}
              onToggle={setBiggestWeakness}
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Injury history ─────────────────────────────────── */}
      {step === 2 && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Select any areas where you have a history of injury or recurring pain. Prehab exercises will be built into every session.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {INJURY_OPTS.map(o => (
              <button
                key={o.value}
                onClick={() => toggleInjury(o.value)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  injuryHistory.includes(o.value)
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{o.emoji}</div>
                <div className="text-sm font-semibold">{o.label}</div>
              </button>
            ))}
          </div>
          {injuryHistory.length === 0 && (
            <Card className="mt-4 p-4 bg-green-50 border-green-200">
              <p className="text-xs text-green-700">No injury history selected — a general prehab protocol (hamstring + groin) will be included in every session.</p>
            </Card>
          )}
        </div>
      )}

      {/* ── Step 3: Readiness ─────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <p className="text-sm text-gray-600 mb-5">
            How are you feeling right now? These scores calibrate intensity for your programme's first week.
          </p>
          <ReadinessSlider
            label="Sleep Quality"
            description="How well did you sleep last night?"
            value={readiness.sleep}
            onChange={v => setReadiness(r => ({ ...r, sleep: v }))}
          />
          <ReadinessSlider
            label="Fatigue Level"
            description="How tired/fatigued do you feel today?"
            value={readiness.fatigue}
            onChange={v => setReadiness(r => ({ ...r, fatigue: v }))}
            inverted
          />
          <ReadinessSlider
            label="Muscle Soreness"
            description="Any soreness from previous training?"
            value={readiness.soreness}
            onChange={v => setReadiness(r => ({ ...r, soreness: v }))}
            inverted
          />
          <ReadinessSlider
            label="Stress Level"
            description="Life stress, work, or mental load today?"
            value={readiness.stress}
            onChange={v => setReadiness(r => ({ ...r, stress: v }))}
            inverted
          />
          <Card className="p-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              High sleep + low fatigue/soreness/stress = maximum training intensity. Sessions are never skipped — only adjusted.
            </p>
          </Card>
        </div>
      )}

      {/* ── Step 4: Review ────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Programme Summary</p>
            <div className="space-y-2">
              <ReviewRow label="Position" value={userProfile.position} />
              <ReviewRow label="Experience" value={`${userProfile.experienceYears} years`} />
              <ReviewRow label="Sessions/week" value={`${sessionsPerWeek} sessions`} />
              <ReviewRow label="Match day" value={matchDay.charAt(0).toUpperCase() + matchDay.slice(1)} />
              <ReviewRow label="Gym access" value={userProfile.gymAccess} />
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Goals</p>
            <div className="space-y-2">
              <ReviewRow label="Primary goal" value={GOAL_OPTS.find(o => o.value === primaryGoal)?.label ?? primaryGoal} />
              {secondaryGoals.length > 0 && (
                <ReviewRow label="Secondary" value={secondaryGoals.join(', ')} />
              )}
              <ReviewRow label="Biggest weakness" value={WEAKNESS_OPTS.find(o => o.value === biggestWeakness)?.label ?? biggestWeakness} />
            </div>
          </Card>

          {injuryHistory.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Injury Prehab</p>
              <div className="flex flex-wrap gap-2">
                {injuryHistory.map(area => (
                  <span key={area} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                    {INJURY_OPTS.find(o => o.value === area)?.label ?? area}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Today's Readiness</p>
            <div className="grid grid-cols-2 gap-2">
              <ReadinessDisplay label="Sleep" value={readiness.sleep} high={v => v >= 7} />
              <ReadinessDisplay label="Fatigue" value={readiness.fatigue} high={v => v <= 4} />
              <ReadinessDisplay label="Soreness" value={readiness.soreness} high={v => v <= 4} />
              <ReadinessDisplay label="Stress" value={readiness.stress} high={v => v <= 4} />
            </div>
          </Card>

          <Button fullWidth size="lg" onClick={handleGenerate} className="mt-2">
            <Zap size={18} />
            Generate My Programme
          </Button>
          <p className="text-center text-xs text-gray-400">
            Generates a personalised {userProfile.experienceYears === '<1' ? 6 : userProfile.experienceYears === '1-3' ? 8 : userProfile.experienceYears === '3-5' ? 10 : 12}-week plan
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="mt-8">
          <Button
            fullWidth
            size="lg"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
          >
            Next
            <ChevronRight size={18} />
          </Button>
        </div>
      )}
    </Layout>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900 capitalize">{value}</span>
    </div>
  );
}

function ReadinessDisplay({ label, value, high }: { label: string; value: number; high: (v: number) => boolean }) {
  const isHigh = high(value);
  return (
    <div className={`rounded-lg p-3 text-center ${isHigh ? 'bg-green-100' : 'bg-orange-100'}`}>
      <div className={`text-xl font-bold ${isHigh ? 'text-green-700' : 'text-orange-700'}`}>{value}</div>
      <div className={`text-xs font-medium ${isHigh ? 'text-green-600' : 'text-orange-600'}`}>{label}</div>
    </div>
  );
}
