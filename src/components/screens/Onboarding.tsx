import { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Dumbbell, Zap, Activity } from 'lucide-react';
import { UserProfile } from '../../types';
import { POSITION_PLANS } from '../../data/positionPlans';

interface OnboardingProps {
  onComplete: (profile: UserProfile, recommendedPlanId: string) => void;
  onStartBattery: (profile: UserProfile, recommendedPlanId: string) => void;
}

// ── Position options ───────────────────────────────────────────────────────
const POSITIONS = [
  { id: 'GK', label: 'Goalkeeper', emoji: '🧤', description: 'Shot-stopping & aerial dominance' },
  { id: 'CB', label: 'Centre Back', emoji: '🛡️', description: 'Aerial power & defensive strength' },
  { id: 'FB', label: 'Full Back', emoji: '⚡', description: 'Lateral speed & endurance' },
  { id: 'CM', label: 'Midfielder', emoji: '⚙️', description: 'Repeated sprint ability' },
  { id: 'W',  label: 'Winger', emoji: '💨', description: 'Top-end speed & acceleration' },
  { id: 'ST', label: 'Striker', emoji: '🎯', description: 'Explosive power & hold-up strength' },
] as const;

// ── Experience options ─────────────────────────────────────────────────────
const EXPERIENCE = [
  { id: '<1',  label: 'Less than 1 year', sub: 'Just getting started' },
  { id: '1-3', label: '1–3 years', sub: 'Building a base' },
  { id: '3-5', label: '3–5 years', sub: 'Competitive player' },
  { id: '5+',  label: '5+ years', sub: 'Experienced athlete' },
] as const;

// ── Gym frequency options ──────────────────────────────────────────────────
const FREQUENCY = [
  { id: '0',   label: 'Just starting', sub: '0 gym sessions/week' },
  { id: '1-2', label: '1–2 sessions', sub: 'Getting into a routine' },
  { id: '3-4', label: '3–4 sessions', sub: 'Consistent trainer' },
  { id: '5+',  label: '5+ sessions', sub: 'Dedicated athlete' },
] as const;

// ── Goal options ───────────────────────────────────────────────────────────
const GOALS = [
  { id: 'speed',      label: '⚡ Speed & Acceleration' },
  { id: 'strength',   label: '💪 Strength & Power' },
  { id: 'endurance',  label: '🫀 Endurance & Fitness' },
  { id: 'injury',     label: '🛡️ Injury Prevention' },
  { id: 'jump',       label: '🦘 Vertical Jump' },
  { id: 'agility',    label: '🔀 Agility & Change of Direction' },
];

// ── Gym access options ─────────────────────────────────────────────────────
const GYM_ACCESS = [
  { id: 'full',  label: 'Full gym', sub: 'Barbells, racks, machines' },
  { id: 'basic', label: 'Basic gym', sub: 'Dumbbells & cables' },
  { id: 'none',  label: 'Home / Outdoor', sub: 'Bodyweight & minimal kit' },
] as const;

// ── Position → Plan mapping ────────────────────────────────────────────────
const POSITION_PLAN_MAP: Record<string, string> = {
  GK: 'plan-goalkeeper',
  CB: 'plan-centre-back',
  FB: 'plan-full-back',
  CM: 'plan-midfielder',
  W:  'plan-winger',
  ST: 'plan-striker',
};

// ── Recommendation blurb based on experience ──────────────────────────────
function experienceBlurb(exp: string, freq: string): string {
  if (exp === '<1' || freq === '0') {
    return 'We\'ve set the Foundation phase intensity to match your level. Take your time with each session — the plan progresses gradually over 8 weeks.';
  }
  if (exp === '1-3' || freq === '1-2') {
    return 'You\'re building solid habits. The 8-week plan takes you from a Foundation base into Power-phase work, progressing week by week.';
  }
  if (exp === '3-5' || freq === '3-4') {
    return 'You\'ve got a solid base. The plan pushes you through Strength into Peak phases — expect to see real athletic gains by week 6.';
  }
  return 'Elite commitment. The programme moves fast — you\'ll be in Power and Peak phases within 6 weeks. Stay on top of recovery.';
}

const TOTAL_STEPS = 6; // 0=welcome, 1=details, 2=position, 3=experience, 4=goals+gym, 5=recommendation, 6=battery offer

export function Onboarding({ onComplete, onStartBattery }: OnboardingProps) {
  const [step, setStep] = useState(0);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [position, setPosition]   = useState<string>('');
  const [experience, setExperience] = useState<string>('');
  const [frequency, setFrequency]   = useState<string>('');
  const [goals, setGoals]           = useState<string[]>([]);
  const [gymAccess, setGymAccess]   = useState<string>('');

  const toggleGoal = (id: string) =>
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const canNext = () => {
    if (step === 1) return firstName.trim() !== '' && lastName.trim() !== '' && email.includes('@');
    if (step === 2) return position !== '';
    if (step === 3) return experience !== '';
    if (step === 4) return goals.length > 0 && gymAccess !== '';
    return true;
  };

  const recommendedPlanId = POSITION_PLAN_MAP[position] ?? 'plan-midfielder';
  const recommendedPlan   = POSITION_PLANS.find(p => p.id === recommendedPlanId);

  const buildProfile = (): UserProfile => ({
    firstName,
    lastName,
    email,
    position: position as UserProfile['position'],
    experienceYears: experience as UserProfile['experienceYears'],
    gymFrequency: frequency as UserProfile['gymFrequency'],
    goals,
    gymAccess: gymAccess as UserProfile['gymAccess'],
    completedAt: Date.now(),
  });

  const handleFinish = () => onComplete(buildProfile(), recommendedPlanId);
  const handleSkipPlan = () => onComplete(buildProfile(), '');
  const handleGoToBattery = () => onStartBattery(buildProfile(), recommendedPlanId);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      {step > 0 && step < TOTAL_STEPS - 1 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${((step) / (TOTAL_STEPS - 2)) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-5">

        {/* ── STEP 0: Welcome ──────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center items-center text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-brand-500 flex items-center justify-center mb-6 shadow-lg">
              <Dumbbell size={36} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">VectorFootball</h1>
            <p className="text-gray-500 text-base mb-8 max-w-xs leading-relaxed">
              Elite football S&C — personalised to your position, match schedule, and readiness.
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full max-w-xs flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg"
            >
              Get Started <ChevronRight size={18} />
            </button>
            <p className="text-xs text-gray-400 mt-4">Takes about 2 minutes</p>
          </div>
        )}

        {/* ── STEP 1: Your details ────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell us about you</h2>
            <p className="text-gray-500 text-sm mb-8">We'll personalise your training plan.</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">First Name</label>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="e.g. Marcus"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Last Name</label>
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="e.g. Rashford"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Email Address</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Position ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">What position do you play?</h2>
            <p className="text-gray-500 text-sm mb-6">We'll match you to a position-specific 8-week programme.</p>

            <div className="grid grid-cols-2 gap-3">
              {POSITIONS.map(pos => (
                <button
                  key={pos.id}
                  onClick={() => setPosition(pos.id)}
                  className={`flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all ${
                    position === pos.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <span className="text-2xl mb-2">{pos.emoji}</span>
                  <span className={`text-sm font-bold ${position === pos.id ? 'text-brand-600' : 'text-gray-900'}`}>
                    {pos.label}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">{pos.description}</span>
                  {position === pos.id && (
                    <div className="mt-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center self-end">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Experience ──────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Your training background</h2>
            <p className="text-gray-500 text-sm mb-6">Help us calibrate the programme intensity.</p>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How long have you been playing football competitively?</h3>
            <div className="flex flex-col gap-2 mb-7">
              {EXPERIENCE.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setExperience(opt.id)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${
                    experience === opt.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div>
                    <div className={`text-sm font-semibold ${experience === opt.id ? 'text-brand-600' : 'text-gray-900'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400">{opt.sub}</div>
                  </div>
                  {experience === opt.id && (
                    <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How many gym sessions do you currently do per week?</h3>
            <div className="flex flex-col gap-2">
              {FREQUENCY.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFrequency(opt.id)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${
                    frequency === opt.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div>
                    <div className={`text-sm font-semibold ${frequency === opt.id ? 'text-brand-600' : 'text-gray-900'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400">{opt.sub}</div>
                  </div>
                  {frequency === opt.id && (
                    <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: Goals + Gym access ──────────────────────────────── */}
        {step === 4 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Goals & equipment</h2>
            <p className="text-gray-500 text-sm mb-6">Select everything that applies.</p>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What are your main goals? <span className="text-gray-400 normal-case">(pick all that apply)</span></h3>
            <div className="flex flex-wrap gap-2 mb-7">
              {GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => toggleGoal(g.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                    goals.includes(g.id)
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What equipment do you have access to?</h3>
            <div className="flex flex-col gap-2">
              {GYM_ACCESS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setGymAccess(opt.id)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${
                    gymAccess === opt.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div>
                    <div className={`text-sm font-semibold ${gymAccess === opt.id ? 'text-brand-600' : 'text-gray-900'}`}>{opt.label}</div>
                    <div className="text-xs text-gray-400">{opt.sub}</div>
                  </div>
                  {gymAccess === opt.id && (
                    <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: Recommendation ──────────────────────────────────── */}
        {step === 5 && recommendedPlan && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={16} className="text-green-600" />
              </div>
              <span className="text-sm font-semibold text-green-700">Profile complete!</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Hi {firstName}, here's your plan 👋
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Based on your answers, we recommend:
            </p>

            {/* Plan card */}
            <div className="rounded-2xl border-2 border-brand-400 bg-brand-50 p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">
                  {{ GK:'🧤', CB:'🛡️', FB:'⚡', CM:'⚙️', W:'💨', ST:'🎯' }[position] ?? '⚽'}
                </span>
                <div>
                  <div className="text-lg font-bold text-gray-900">{recommendedPlan.position} Plan</div>
                  <div className="text-xs text-gray-500">8 weeks · 3 sessions/wk · Mon/Wed/Fri</div>
                </div>
                <span className="ml-auto text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-semibold">Recommended</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">{recommendedPlan.description}</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {experienceBlurb(experience, frequency)}
              </p>
            </div>

            {/* Goal highlights */}
            {goals.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your goals are addressed by this plan:</p>
                <div className="flex flex-wrap gap-1.5">
                  {goals.map(g => {
                    const goal = GOALS.find(x => x.id === g);
                    return goal ? (
                      <span key={g} className="text-xs bg-white border border-brand-200 text-brand-700 px-2.5 py-1 rounded-full font-medium">
                        {goal.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Phase progression */}
            <div className="flex gap-1.5 mb-6">
              {['Foundation', 'Build', 'Strength', 'Peak'].map((phase, i) => (
                <div key={phase} className="flex-1 text-center">
                  <div className="text-xs font-semibold text-gray-400 mb-1">Wk {i * 2 + 1}-{i * 2 + 2}</div>
                  <div className={`py-1 rounded-lg text-xs font-bold ${
                    i === 0 ? 'bg-blue-100 text-blue-700' :
                    i === 1 ? 'bg-purple-100 text-purple-700' :
                    i === 2 ? 'bg-brand-100 text-brand-700' :
                              'bg-red-100 text-red-700'
                  }`}>{phase}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(6)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg mb-3"
            >
              <Zap size={18} />
              Start My Plan
            </button>
            <button
              onClick={handleSkipPlan}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              Skip — I'll browse plans myself
            </button>
          </div>
        )}

        {/* ── STEP 6: Testing Battery offer ───────────────────────────── */}
        {step === 6 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={16} className="text-green-600" />
              </div>
              <span className="text-sm font-semibold text-green-700">You're all set!</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">One more thing 💪</h2>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Would you like to do a <span className="font-semibold text-gray-700">Fitness Testing Battery</span>? It takes ~15 minutes and gives you a scientifically-grounded energy system profile — aerobic vs anaerobic score, Fatigue Index, and position-specific benchmarks.
            </p>

            {/* What you get */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { icon: '⚡', label: 'Sprint times', sub: '10m & 30m splits' },
                { icon: '🦘', label: 'Jump height', sub: 'CMJ explosive power' },
                { icon: '🔄', label: 'Fatigue Index', sub: '6-sprint RSA test' },
                { icon: '🫀', label: 'Aerobic score', sub: 'Yo-Yo IR1 level' },
              ].map(item => (
                <div key={item.label} className="bg-brand-50 border border-brand-100 rounded-2xl p-3">
                  <div className="text-lg mb-0.5">{item.icon}</div>
                  <div className="text-xs font-bold text-brand-700">{item.label}</div>
                  <div className="text-xs text-brand-500">{item.sub}</div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-6">
              <p className="text-xs text-gray-500 leading-relaxed">
                Based on protocols validated by Girard et al. (2011), Bangsbo et al. (2008), and Stølen et al. (2005). You'll need a 30m flat space, cones, and a stopwatch.
              </p>
            </div>

            <button
              onClick={handleGoToBattery}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg mb-3"
            >
              <Activity size={18} />
              Take the Fitness Test
            </button>
            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              Skip — go to my dashboard
            </button>
          </div>
        )}

        {/* ── Nav buttons ─────────────────────────────────────────────── */}
        {step > 0 && step < 5 && (
          <div className="flex gap-3 py-6">
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                canNext()
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {step === 4 ? 'See My Recommendation' : 'Continue'}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
