import { useState } from 'react';
import { ChevronRight, ChevronLeft, Dumbbell } from 'lucide-react';
import { UserProfile } from '../../types';

interface OnboardingProps {
  onComplete: (profile: UserProfile, recommendedPlanId: string) => void;
}

const GENDERS = [
  { id: 'male',   label: 'Male'   },
  { id: 'female', label: 'Female' },
  { id: 'other',  label: 'Other'  },
] as const;

function inputClass(hasError = false) {
  return `w-full px-4 py-3 rounded-xl border ${hasError ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'} bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400`;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
      {children}
    </label>
  );
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [heightStr, setHeightStr] = useState('');
  const [weightStr, setWeightStr] = useState('');
  const [gender,    setGender]    = useState<'male' | 'female' | 'other' | ''>('');

  const canProceed = firstName.trim() !== '' && lastName.trim() !== '' && email.includes('@');

  const buildProfile = (): UserProfile => ({
    firstName:       firstName.trim(),
    lastName:        lastName.trim(),
    email:           email.trim(),
    // Sensible defaults for fields no longer collected in onboarding
    position:        'CM',
    experienceYears: '1-3',
    gymFrequency:    '1-2',
    goals:           [],
    gymAccess:       'full',
    completedAt:     Date.now(),
    heightCm:        heightStr ? parseFloat(heightStr) : undefined,
    weightKg:        weightStr ? parseFloat(weightStr) : undefined,
    gender:          gender || undefined,
  });

  const handleEnterApp = () => onComplete(buildProfile(), '');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress indicator */}
      {step === 1 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
          <div className="h-full bg-brand-500 transition-all duration-300 w-1/2" />
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-5">

        {/* ── STEP 0: Welcome ── */}
        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center items-center text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-brand-500 flex items-center justify-center mb-6 shadow-lg">
              <Dumbbell size={36} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">VectorFootball</h1>
            <p className="text-gray-500 text-base mb-8 max-w-xs leading-relaxed">
              Elite football strength and conditioning, personalised to your match schedule and readiness.
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full max-w-xs flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg"
            >
              Get Started <ChevronRight size={18} />
            </button>
            <p className="text-xs text-gray-400 mt-4">Takes less than a minute</p>
          </div>
        )}

        {/* ── STEP 1: Your details ── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your profile</h2>
            <p className="text-gray-500 text-sm mb-8">Just the basics to get you started.</p>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g. Marcus"
                    className={inputClass(!firstName.trim() && firstName !== '')}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="e.g. Rashford"
                    className={inputClass()}
                  />
                </div>
              </div>

              <div>
                <Label>Email Address</Label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className={inputClass()}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Height (cm) <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                  <input
                    value={heightStr}
                    onChange={e => setHeightStr(e.target.value)}
                    type="number"
                    min="100"
                    max="230"
                    placeholder="e.g. 180"
                    className={inputClass()}
                  />
                </div>
                <div>
                  <Label>Weight (kg) <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                  <input
                    value={weightStr}
                    onChange={e => setWeightStr(e.target.value)}
                    type="number"
                    min="30"
                    max="200"
                    placeholder="e.g. 75"
                    className={inputClass()}
                  />
                </div>
              </div>

              <div>
                <Label>Gender <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                <div className="flex gap-2">
                  {GENDERS.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGender(g.id)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        gender === g.id
                          ? 'border-brand-500 bg-brand-50 text-brand-600'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Nav buttons ── */}
        {step === 1 && (
          <div className="flex gap-3 py-6">
            <button
              onClick={() => setStep(0)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={handleEnterApp}
              disabled={!canProceed}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                canProceed
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Enter App
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
