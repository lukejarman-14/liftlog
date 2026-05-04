/**
 * ProgrammeBuilder v2 — 5-step wizard collecting inputs for the AI programme generator.
 * Pre-fills position, experience, gym access from UserProfile. FV always balanced.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap, Target, Activity, Brain, Check, User } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  ProgrammeInputs, PrimaryGoal, MatchDayPref, Weakness, InjuryArea,
  PlayStyle, UserProfile,
} from '../../types';

interface Props {
  userProfile: UserProfile;
  onGenerate: (inputs: ProgrammeInputs) => void;
  onBack: () => void;
}

const STEPS = ['Schedule', 'Position', 'Goals', 'Injuries', 'Readiness'];

type Opt<T extends string> = { value: T; label: string; description?: string };

// ── Option data ────────────────────────────────────────────────────────────

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

const POSITION_OPTS: Opt<string>[] = [
  { value: 'GK', label: '🧤 Goalkeeper' },
  { value: 'CB', label: '🛡️ Centre Back' },
  { value: 'FB', label: '↔️ Full Back' },
  { value: 'CM', label: '⚙️ Midfielder' },
  { value: 'W', label: '⚡ Winger' },
  { value: 'ST', label: '🎯 Striker' },
];

const PLAY_STYLE_OPTS: Opt<PlayStyle>[] = [
  { value: 'box-to-box', label: '🔄 Box-to-Box', description: 'High work rate, covers both thirds' },
  { value: 'direct', label: '⬆️ Direct', description: 'Quick vertical transitions' },
  { value: 'technical', label: '🎨 Technical', description: 'Ball retention, tight spaces' },
  { value: 'physical', label: '💪 Physical', description: 'Dominant in duels and aerial' },
  { value: 'press-heavy', label: '🔥 Press-Heavy', description: 'High-press, high-intensity demands' },
  { value: 'counter-attack', label: '🚀 Counter-Attack', description: 'Explosive transition speed' },
];


const GOAL_OPTS: Opt<PrimaryGoal>[] = [
  { value: 'speed', label: '⚡ Speed', description: 'Max velocity & acceleration' },
  { value: 'strength', label: '💪 Strength', description: 'Force production & power base' },
  { value: 'power', label: '🚀 Power', description: 'Explosive athleticism' },
  { value: 'endurance', label: '🫀 Endurance', description: 'Repeated-effort capacity' },
  { value: 'injury_prevention', label: '🛡️ Injury Prevention', description: 'Resilience & prehab focus' },
];

const SECONDARY_GOAL_OPTS: { value: string; label: string }[] = [
  { value: 'speed', label: 'Speed' }, { value: 'strength', label: 'Strength' },
  { value: 'power', label: 'Power' }, { value: 'endurance', label: 'Endurance' },
  { value: 'agility', label: 'Agility' }, { value: 'mobility', label: 'Mobility' },
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

// ── Sub-components ─────────────────────────────────────────────────────────

function ReadinessSlider({
  label, description, value, onChange, inverted,
}: {
  label: string; description: string; value: number;
  onChange: (v: number) => void; inverted?: boolean;
}) {
  const dots = Array.from({ length: 5 }, (_, i) => i + 1);
  const colour = inverted
    ? value <= 2 ? 'bg-green-500' : value <= 3 ? 'bg-yellow-500' : 'bg-red-500'
    : value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <span className={`text-lg font-bold w-8 text-center rounded-full ${colour} text-white py-0.5`}>{value}</span>
      </div>
      <div className="flex gap-1.5 mt-2">
        {dots.map(d => (
          <button key={d} onClick={() => onChange(d)}
            className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
              d === value ? `${colour} text-white shadow-md scale-110` : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}>{d}</button>
        ))}
      </div>
    </div>
  );
}

function ChipSelector<T extends string>({
  options, selected, onToggle, multi,
}: {
  options: { value: T; label: string; description?: string }[];
  selected: T | T[]; onToggle: (v: T) => void; multi?: boolean;
}) {
  const isSelected = (v: T) => multi ? (selected as T[]).includes(v) : selected === v;
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onToggle(opt.value)}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
            isSelected(opt.value)
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}>
          <div className="font-semibold text-sm">{opt.label}</div>
          {opt.description && <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>}
        </button>
      ))}
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────

export function ProgrammeBuilder({ userProfile, onGenerate, onBack }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  // Step 0 — Schedule
  const [sessionsPerWeek, setSessionsPerWeek] = useState<2 | 3 | 4>(3);
  const [matchDay, setMatchDay] = useState<MatchDayPref>('saturday');
  const [hasSecondMatchDay, setHasSecondMatchDay] = useState(false);
  const [secondMatchDay, setSecondMatchDay] = useState<MatchDayPref>('midweek');
  // Step 1 — Position & play style
  const [primaryPos, setPrimaryPos] = useState<string>(userProfile.position);
  const [secondaryPos, setSecondaryPos] = useState<string>('');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('box-to-box');
  // Step 2 — Goals
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>('speed');
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [biggestWeakness, setBiggestWeakness] = useState<Weakness>('speed');
  // Step 3 — Injuries
  const [injuryHistory, setInjuryHistory] = useState<InjuryArea[]>([]);
  // Step 4 — Readiness
  const [readiness, setReadiness] = useState({ sleep: 4, fatigue: 2, soreness: 2, stress: 2 });

  const toggleSecondary = (v: string) => {
    if (v === primaryGoal) return;
    setSecondaryGoals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v].slice(0, 3));
  };
  const toggleInjury = (v: InjuryArea) => {
    setInjuryHistory(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const handleGenerate = () => {
    const inputs: ProgrammeInputs = {
      position: primaryPos as ProgrammeInputs['position'],
      secondaryPosition: secondaryPos ? secondaryPos as ProgrammeInputs['secondaryPosition'] : undefined,
      playStyle,
      experienceYears: userProfile.experienceYears,
      sessionsPerWeek,
      primaryGoal,
      secondaryGoals,
      matchDay,
      secondMatchDay: hasSecondMatchDay ? secondMatchDay : undefined,
      biggestWeakness,
      injuryHistory,
      readiness,
      gymAccess: userProfile.gymAccess,
      fvEmphasis: 'balanced',
    };
    onGenerate(inputs);
  };

  const totalSteps = STEPS.length;
  const stepIcons = [Activity, User, Target, Brain, Zap];
  const StepIcon = stepIcons[step] ?? Check;

  const expWeeks: Record<string, string> = { '<1': '6', '1-3': '8', '3-5': '10', '5+': '12' };

  return (
    <Layout
      title="Build My Program"
      leftAction={
        <button onClick={step === 0 ? onBack : () => setStep(s => s - 1)} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft size={24} />
        </button>
      }
    >
      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand-500' : 'bg-gray-200'}`} />
            <span className={`text-center text-[10px] leading-tight ${i === step ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step header */}
      <div className="flex items-center gap-2 mb-5 text-brand-600">
        <StepIcon size={22} />
        <h2 className="text-lg font-bold text-gray-900">
          {step === 0 && 'Training Schedule'}
          {step === 1 && 'Position & Play Style'}
          {step === 2 && 'Goals & Weakness'}
          {step === 3 && 'Injury History'}
          {step === 4 && "Today's Readiness"}
        </h2>
      </div>

      {/* ── Step 0: Schedule ── */}
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
            <ChipSelector options={MATCH_DAY_OPTS} selected={matchDay} onToggle={setMatchDay} />
          </div>
          <div>
            <button
              onClick={() => setHasSecondMatchDay(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                hasSecondMatchDay
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-semibold">We sometimes play twice a week</span>
              <span className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                hasSecondMatchDay ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
              }`}>
                {hasSecondMatchDay && <Check size={12} className="text-white" />}
              </span>
            </button>
            {hasSecondMatchDay && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Second match day</p>
                <ChipSelector
                  options={MATCH_DAY_OPTS.filter(o => o.value !== matchDay)}
                  selected={secondMatchDay !== matchDay ? secondMatchDay : MATCH_DAY_OPTS.find(o => o.value !== matchDay)?.value ?? 'midweek'}
                  onToggle={setSecondMatchDay}
                />
              </div>
            )}
          </div>
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-xs text-blue-700 font-medium">Using your profile</p>
            <p className="text-xs text-blue-600 mt-1">
              Experience: <strong>{userProfile.experienceYears} yrs</strong> · Gym: <strong>{userProfile.gymAccess}</strong> · Duration: <strong>{expWeeks[userProfile.experienceYears] ?? '8'} weeks</strong>
            </p>
          </Card>
        </div>
      )}

      {/* ── Step 1: Position & Play Style ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Primary position</p>
            <p className="text-xs text-gray-500 mb-2">Pre-filled from your profile — change if needed</p>
            <div className="grid grid-cols-3 gap-2">
              {POSITION_OPTS.map(o => (
                <button key={o.value} onClick={() => setPrimaryPos(o.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    primaryPos === o.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Secondary position <span className="text-gray-400 font-normal">(optional)</span></p>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: '', label: '— None' }, ...POSITION_OPTS].map(o => (
                <button key={o.value} onClick={() => setSecondaryPos(o.value === primaryPos ? '' : o.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    secondaryPos === o.value && o.value !== '' ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : o.value === primaryPos && o.value !== '' ? 'opacity-30 border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : o.value === '' ? secondaryPos === '' ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-200 bg-white text-gray-500'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          {primaryPos !== 'GK' && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Play style</p>
              <ChipSelector options={PLAY_STYLE_OPTS} selected={playStyle} onToggle={setPlayStyle} />
            </div>
          )}
          {primaryPos === 'GK' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-700 font-medium">Goalkeeper-specific training selected. Play style not applicable — GK programme uses dedicated shot-stopping, distribution and footwork blocks.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Goals ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Primary goal</p>
            <p className="text-xs text-gray-500 mb-2">Gets majority of programme focus</p>
            <ChipSelector options={GOAL_OPTS} selected={primaryGoal} onToggle={setPrimaryGoal} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Secondary goals <span className="text-gray-400 font-normal">(up to 3)</span></p>
            <p className="text-xs text-gray-500 mb-2">Maintained at minimum effective dose</p>
            <div className="flex flex-wrap gap-2">
              {SECONDARY_GOAL_OPTS.filter(o => o.value !== primaryGoal).map(o => (
                <button key={o.value} onClick={() => toggleSecondary(o.value)}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    secondaryGoals.includes(o.value)
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-brand-400'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Biggest physical weakness</p>
            <ChipSelector options={WEAKNESS_OPTS} selected={biggestWeakness} onToggle={setBiggestWeakness} />
          </div>
        </div>
      )}

      {/* ── Step 3: Injury history ── */}
      {step === 3 && (
        <div>
          <p className="text-sm text-gray-600 mb-4">Select any areas with a history of injury. Targeted prehab will be built into every session.</p>
          <div className="grid grid-cols-2 gap-3">
            {INJURY_OPTS.map(o => (
              <button key={o.value} onClick={() => toggleInjury(o.value)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  injuryHistory.includes(o.value)
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}>
                <div className="text-2xl mb-1">{o.emoji}</div>
                <div className="text-sm font-semibold">{o.label}</div>
              </button>
            ))}
          </div>
          {injuryHistory.length === 0 && (
            <Card className="mt-4 p-4 bg-green-50 border-green-200">
              <p className="text-xs text-green-700">No injury history — a general prehab protocol (hamstring + groin) will be included in every session.</p>
            </Card>
          )}
        </div>
      )}

      {/* ── Step 4: Readiness + Generate ── */}
      {step === 4 && (
        <div>
          <p className="text-sm text-gray-600 mb-5">Rate how you feel right now. These scores calibrate your programme's starting intensity band.</p>
          <ReadinessSlider label="Sleep Quality" description="How well did you sleep last night?" value={readiness.sleep} onChange={v => setReadiness(r => ({ ...r, sleep: v }))} />
          <ReadinessSlider label="Fatigue Level" description="How tired/fatigued do you feel today?" value={readiness.fatigue} onChange={v => setReadiness(r => ({ ...r, fatigue: v }))} inverted />
          <ReadinessSlider label="Muscle Soreness" description="Any soreness from previous training?" value={readiness.soreness} onChange={v => setReadiness(r => ({ ...r, soreness: v }))} inverted />
          <ReadinessSlider label="Stress Level" description="Life stress, work, or mental load today?" value={readiness.stress} onChange={v => setReadiness(r => ({ ...r, stress: v }))} inverted />
          <Card className="p-4 bg-gray-50 mt-2 mb-6">
            <div className="flex gap-3 flex-wrap">
              {[
                { label: '4.5–5 Elite', colour: 'text-emerald-600' },
                { label: '3.5–4.4 High', colour: 'text-green-600' },
                { label: '2.5–3.4 Moderate', colour: 'text-yellow-600' },
                { label: '1–2.4 Low', colour: 'text-red-500' },
              ].map(b => <span key={b.label} className={`text-xs font-semibold ${b.colour}`}>{b.label}</span>)}
            </div>
          </Card>
          <Button fullWidth size="lg" onClick={handleGenerate}>
            <Zap size={18} />
            Generate My Program
          </Button>
          <p className="text-center text-xs text-gray-400 mt-2 pb-6">
            {expWeeks[userProfile.experienceYears] ?? '8'} weeks · {sessionsPerWeek} sessions/week
          </p>
        </div>
      )}

      {step < totalSteps - 1 && (
        <div className="mt-8 pb-8">
          <Button fullWidth size="lg" onClick={() => setStep(s => s + 1)}>
            Next <ChevronRight size={18} />
          </Button>
        </div>
      )}
    </Layout>
  );
}
