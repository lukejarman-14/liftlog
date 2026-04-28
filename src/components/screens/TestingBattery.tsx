import { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronLeft, Zap, Activity, Award,
  SkipForward, Check, Wind, TrendingUp, Info,
} from 'lucide-react';
import { BaselineTest, BaselineResults } from '../../types';
import {
  calcBaselineResults, GRADE_LABELS, GRADE_COLOURS,
  POSITION_ENERGY_PROFILE, TEST_PROTOCOLS, calcFatigueIndex,
} from '../../data/testingBattery';
import { Card } from '../ui/Card';

interface TestingBatteryProps {
  position: string;
  onComplete: (test: BaselineTest, results: BaselineResults) => void;
  onSkip: () => void;
}

// ── Small helpers ──────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade?: 1 | 2 | 3 | 4 }) {
  if (!grade) return <span className="text-xs text-gray-400 font-medium">Not tested</span>;
  const c = GRADE_COLOURS[grade];
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {GRADE_LABELS[grade]}
    </span>
  );
}

function ProtocolSteps({ items }: { items: string[] }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Info size={13} className="text-blue-500" />
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Protocol</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-blue-800 leading-relaxed">
            <span className="flex-shrink-0 font-bold">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function NumInput({
  label, value, onChange, unit, placeholder,
}: {
  label?: string; value: string; onChange: (v: string) => void; unit?: string; placeholder?: string;
}) {
  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0.00'}
          className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
        />
        {unit && <span className="text-sm font-semibold text-gray-500 w-8">{unit}</span>}
      </div>
    </div>
  );
}

function NormTable({ rows }: {
  rows: { label: string; m: string; f: string; col: string }[];
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">Performance norms:</p>
      <div className="flex flex-col gap-1">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${row.col}`}>{row.label}</span>
            <span className="text-gray-500">♂ {row.m} · ♀ {row.f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RSA_REST_SECONDS = 20;

// ── Main component ─────────────────────────────────────────────────────────

export function TestingBattery({ position, onComplete, onSkip }: TestingBatteryProps) {
  const [step, setStep] = useState(0); // 0=welcome 1=sex 2=10m 3=30m 4=cmj 5=rsa 6=yoyo 7=results

  // ── Form state ──────────────────────────────────────────────────────
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [sprint10m, setSprint10m] = useState('');
  const [sprint30m, setSprint30m] = useState('');
  const [cmjAttempts, setCmjAttempts] = useState(['', '', '']);
  const [rsaSprints, setRsaSprints] = useState<string[]>(['', '', '', '', '', '']);
  const [rsaSubStep, setRsaSubStep] = useState(0);   // which sprint 0–5
  const [rsaCountdown, setRsaCountdown] = useState<number | null>(null);
  const [rsaDone, setRsaDone] = useState(false);
  const [yoyoLevel, setYoyoLevel] = useState('');

  // ── Results ─────────────────────────────────────────────────────────
  const [results, setResults] = useState<BaselineResults | null>(null);
  const [completedTest, setCompletedTest] = useState<BaselineTest | null>(null);

  const posProfile = POSITION_ENERGY_PROFILE[position] ?? POSITION_ENERGY_PROFILE['CM'];

  // ── RSA countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (rsaCountdown === null || rsaCountdown <= 0) return;
    const t = setTimeout(() => setRsaCountdown(c => Math.max((c ?? 1) - 1, 0)), 1000);
    return () => clearTimeout(t);
  }, [rsaCountdown]);

  // Auto-dismiss countdown when it hits 0
  useEffect(() => {
    if (rsaCountdown === 0) {
      const t = setTimeout(() => setRsaCountdown(null), 600);
      return () => clearTimeout(t);
    }
  }, [rsaCountdown]);

  const isResting = rsaCountdown !== null && rsaCountdown > 0;

  const recordRsaSprint = () => {
    if (rsaSubStep < 5) {
      setRsaSubStep(s => s + 1);
      setRsaCountdown(RSA_REST_SECONDS);
    } else {
      setRsaDone(true);
    }
  };

  const resetRsa = () => {
    setRsaSubStep(0);
    setRsaSprints(['', '', '', '', '', '']);
    setRsaCountdown(null);
    setRsaDone(false);
  };

  // ── Best CMJ ────────────────────────────────────────────────────────
  const cmjBest = (): number => {
    const vals = cmjAttempts.map(a => parseFloat(a) || 0).filter(v => v > 0);
    return vals.length ? Math.max(...vals) : 0;
  };

  // ── Build test object ───────────────────────────────────────────────
  const buildTest = (): BaselineTest => ({
    sprint10m: parseFloat(sprint10m) > 0 ? parseFloat(sprint10m) : undefined,
    sprint30m: parseFloat(sprint30m) > 0 ? parseFloat(sprint30m) : undefined,
    cmjBest: cmjBest() > 0 ? cmjBest() : undefined,
    rsaSprints: rsaSprints.some(s => parseFloat(s) > 0)
      ? rsaSprints.map(s => parseFloat(s) || 0)
      : undefined,
    yoyoLevel: parseFloat(yoyoLevel) > 0 ? parseFloat(yoyoLevel) : undefined,
    sex,
    completedAt: Date.now(),
  });

  // ── Navigation ──────────────────────────────────────────────────────
  const canNext = (): boolean => {
    switch (step) {
      case 2: return parseFloat(sprint10m) > 0;
      case 3: return parseFloat(sprint30m) > 0;
      case 4: return cmjBest() > 0;
      case 5: return rsaDone;
      default: return true; // welcome, sex, yoyo (optional) are always continuable
    }
  };

  const goNext = () => {
    if (step === 6) {
      // Compute results and move to results screen
      const test = buildTest();
      const r = calcBaselineResults(test);
      setCompletedTest(test);
      setResults(r);
      setStep(7);
    } else {
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (step === 5) resetRsa();
    setStep(s => s - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Progress bar (steps 1–6) */}
      {step > 0 && step < 7 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-5">

        {/* ── STEP 0: Welcome ───────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-5 shadow-lg">
              <Activity size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Fitness Testing Battery</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              A sport-science validated assessment of your energy systems, sprint capacity, and explosive power — benchmarked against football-specific norms for your position.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { icon: '⚡', title: 'Anaerobic Power', desc: '10m/30m sprint + CMJ' },
                { icon: '🫀', title: 'Aerobic Capacity', desc: 'Yo-Yo IR1 test' },
                { icon: '🔄', title: 'Fatigue Index', desc: '6 × 30m repeated sprints' },
                { icon: '📊', title: 'Energy Profile', desc: 'Aerobic vs. anaerobic score' },
              ].map(item => (
                <div key={item.title} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                  <div className="text-xl mb-1">{item.icon}</div>
                  <div className="text-xs font-bold text-gray-800">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
              <p className="text-xs font-semibold text-amber-700 mb-1.5">What you'll need</p>
              <ul className="text-xs text-amber-800 flex flex-col gap-1 leading-relaxed">
                <li>• Flat 30m space (pitch, park, track)</li>
                <li>• Cones or markers at 0m, 10m &amp; 30m</li>
                <li>• Stopwatch or phone timer</li>
                <li>• Wall + tape measure for CMJ (or jump-height app)</li>
                <li>• Allow ~15–20 minutes</li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-6">
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-600">Scientific basis: </span>
                Protocols validated for football by Girard et al. (2011), Bangsbo et al. (2008), Haugen et al. (2012), Linthorne (2001) &amp; Stølen et al. (2005).
              </p>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg mb-3"
            >
              <Zap size={18} />
              Begin Assessment
            </button>
            <button
              onClick={onSkip}
              className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now — I'll do this later
            </button>
          </div>
        )}

        {/* ── STEP 1: Sex ───────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Biological sex</h2>
            <p className="text-gray-500 text-sm mb-6">Used only to compare your scores against the correct norm table.</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {(['male', 'female'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={`flex flex-col items-center py-8 rounded-2xl border-2 font-bold text-base capitalize transition-all ${
                    sex === s
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                  }`}
                >
                  <span className="text-3xl mb-2">{s === 'male' ? '♂' : '♀'}</span>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  {sex === s && (
                    <div className="mt-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                Elite norm tables for sprinting and jumping differ significantly between male and female footballers. Your sex determines which benchmarks are used (Haugen et al., 2012; Cometti et al., 2001).
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2: 10m Sprint ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} className="text-brand-500" />
              <h2 className="text-2xl font-bold text-gray-900">10m Sprint</h2>
            </div>
            <p className="text-xs text-gray-500 mb-1">First-step acceleration — phosphocreatine energy system</p>
            <p className="text-xs text-gray-400 italic mb-5">Cometti et al. (2001) Int J Sports Med</p>

            <ProtocolSteps items={TEST_PROTOCOLS.sprint10m.protocol} />

            <div className="mb-5">
              <NumInput
                label="Your 10m sprint time"
                value={sprint10m}
                onChange={setSprint10m}
                unit="s"
                placeholder="1.80"
              />
            </div>

            <NormTable rows={[
              { label: 'Excellent', m: '< 1.65s', f: '< 1.75s', col: 'text-green-600' },
              { label: 'Good',      m: '< 1.75s', f: '< 1.85s', col: 'text-blue-600' },
              { label: 'Average',   m: '< 1.85s', f: '< 1.95s', col: 'text-yellow-600' },
              { label: 'Below avg', m: '≥ 1.85s', f: '≥ 1.95s', col: 'text-red-500' },
            ]} />
          </div>
        )}

        {/* ── STEP 3: 30m Sprint ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} className="text-brand-500" />
              <h2 className="text-2xl font-bold text-gray-900">30m Sprint</h2>
            </div>
            <p className="text-xs text-gray-500 mb-1">Maximum velocity + glycolytic energy</p>
            <p className="text-xs text-gray-400 italic mb-5">Haugen et al. (2012) Int J Sports Physiol Perform</p>

            <ProtocolSteps items={TEST_PROTOCOLS.sprint30m.protocol} />

            <div className="mb-5">
              <NumInput
                label="Your 30m sprint time"
                value={sprint30m}
                onChange={setSprint30m}
                unit="s"
                placeholder="4.20"
              />
            </div>

            <NormTable rows={[
              { label: 'Excellent', m: '< 3.90s', f: '< 4.30s', col: 'text-green-600' },
              { label: 'Good',      m: '< 4.10s', f: '< 4.50s', col: 'text-blue-600' },
              { label: 'Average',   m: '< 4.30s', f: '< 4.70s', col: 'text-yellow-600' },
              { label: 'Below avg', m: '≥ 4.30s', f: '≥ 4.70s', col: 'text-red-500' },
            ]} />

            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                <span className="font-semibold">Football pitch context:</span> 30m is roughly the distance from the goal line to the edge of the penalty area extended. A typical wide sprint or a striker's run in behind covers this distance.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 4: CMJ ───────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={18} className="text-brand-500" />
              <h2 className="text-2xl font-bold text-gray-900">Countermovement Jump</h2>
            </div>
            <p className="text-xs text-gray-500 mb-1">Explosive power &amp; stretch-shortening cycle efficiency</p>
            <p className="text-xs text-gray-400 italic mb-5">Linthorne (2001) Am J Phys; Bosco et al.</p>

            <ProtocolSteps items={TEST_PROTOCOLS.cmj.protocol} />

            <div className="flex flex-col gap-3 mb-4">
              {cmjAttempts.map((val, i) => {
                const parsed = parseFloat(val) || 0;
                const best = cmjBest();
                const isBest = parsed > 0 && parsed === best && best > 0;
                return (
                  <NumInput
                    key={i}
                    label={`Attempt ${i + 1}${isBest ? ' 🏆 Best' : ''}`}
                    value={val}
                    onChange={v => {
                      const next = [...cmjAttempts];
                      next[i] = v;
                      setCmjAttempts(next);
                    }}
                    unit="cm"
                    placeholder="35"
                  />
                );
              })}
            </div>

            <NormTable rows={[
              { label: 'Excellent', m: '> 45cm', f: '> 35cm', col: 'text-green-600' },
              { label: 'Good',      m: '> 35cm', f: '> 27cm', col: 'text-blue-600' },
              { label: 'Average',   m: '> 25cm', f: '> 20cm', col: 'text-yellow-600' },
              { label: 'Below avg', m: '< 25cm', f: '< 20cm', col: 'text-red-500' },
            ]} />
          </div>
        )}

        {/* ── STEP 5: RSA 6 × 30m ──────────────────────────────────────── */}
        {step === 5 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-1">
              <Wind size={18} className="text-brand-500" />
              <h2 className="text-2xl font-bold text-gray-900">Repeated Sprint Ability</h2>
            </div>
            <p className="text-xs text-gray-500 mb-1">6 × 30m · 20s passive rest between sprints</p>
            <p className="text-xs text-gray-400 italic mb-5">Girard, Mendez-Villanueva &amp; Bishop (2011) Sports Med</p>

            {/* Sprint dots */}
            <div className="flex gap-1.5 mb-6">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                    parseFloat(rsaSprints[i]) > 0
                      ? 'bg-brand-500'
                      : i === rsaSubStep && !isResting && !rsaDone
                      ? 'bg-brand-200'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {rsaDone ? (
              /* ── All 6 done — summary ── */
              <div>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">All 6 sprints recorded</p>
                    <p className="text-xs text-green-700">RSA complete — tap Continue</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {rsaSprints.map((s, i) => {
                    const best = Math.min(...rsaSprints.map(x => parseFloat(x) || 99));
                    const val = parseFloat(s);
                    return (
                      <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                        <span className="text-sm text-gray-600 font-medium">Sprint {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{s}s</span>
                          {val === best && (
                            <span className="text-xs text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-full">Best</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const fi = calcFatigueIndex(rsaSprints.map(s => parseFloat(s) || 0));
                  return fi !== null ? (
                    <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-brand-700 mb-1">Fatigue Index Preview</p>
                      <p className="text-3xl font-extrabold text-brand-600">{fi.toFixed(1)}%</p>
                      <p className="text-xs text-gray-500 mt-1">Full breakdown on your results page</p>
                    </div>
                  ) : null;
                })()}
              </div>

            ) : isResting ? (
              /* ── Rest countdown ── */
              <div className="flex flex-col items-center py-6">
                <div className="relative w-36 h-36 mb-5">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="44" fill="none"
                      stroke="#f97316" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      strokeDashoffset={`${2 * Math.PI * 44 * (1 - (rsaCountdown ?? 0) / RSA_REST_SECONDS)}`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold text-brand-500">{rsaCountdown}</span>
                    <span className="text-xs text-gray-400">seconds</span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-gray-700 mb-1">
                  Rest — Sprint {rsaSubStep + 1} of 6 next
                </p>
                <p className="text-xs text-gray-400 mb-5">Stand still (passive rest only)</p>

                <button
                  onClick={() => setRsaCountdown(0)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <SkipForward size={14} />
                  Skip rest
                </button>
              </div>

            ) : (
              /* ── Sprint input ── */
              <div>
                {rsaSubStep === 0 && (
                  <ProtocolSteps items={[
                    'Sprint 30m at FULL effort. Record your time.',
                    '20-second rest countdown starts automatically after each sprint.',
                    'Complete all 6 sprints. The app calculates your Fatigue Index.',
                  ]} />
                )}

                <div className="text-center mb-4">
                  <span className="inline-block text-sm font-semibold text-gray-500 bg-gray-100 px-4 py-1.5 rounded-full">
                    Sprint {rsaSubStep + 1} of 6
                  </span>
                </div>

                <NumInput
                  label={`Sprint ${rsaSubStep + 1} time`}
                  value={rsaSprints[rsaSubStep]}
                  onChange={v => {
                    const next = [...rsaSprints];
                    next[rsaSubStep] = v;
                    setRsaSprints(next);
                  }}
                  unit="s"
                  placeholder="4.20"
                />

                <button
                  onClick={recordRsaSprint}
                  disabled={!rsaSprints[rsaSubStep] || parseFloat(rsaSprints[rsaSubStep]) <= 0}
                  className={`w-full mt-4 py-4 rounded-2xl font-bold text-base transition-all ${
                    rsaSprints[rsaSubStep] && parseFloat(rsaSprints[rsaSubStep]) > 0
                      ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {rsaSubStep < 5 ? `Record Sprint ${rsaSubStep + 1} →` : 'Finish RSA ✓'}
                </button>

                {rsaSprints.some((s, i) => i < rsaSubStep && parseFloat(s) > 0) && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recorded</p>
                    <div className="flex flex-wrap gap-2">
                      {rsaSprints.slice(0, rsaSubStep).map((s, i) => (
                        <span key={i} className="text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full font-semibold">
                          #{i + 1}: {s}s
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 6: Yo-Yo IR1 (Optional) ─────────────────────────────── */}
        {step === 6 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={18} className="text-brand-500" />
              <h2 className="text-2xl font-bold text-gray-900">Yo-Yo IR1 Test</h2>
            </div>
            <p className="text-xs text-gray-500 mb-1">Best aerobic predictor for football</p>
            <p className="text-xs text-gray-400 italic mb-2">Bangsbo, Iaia &amp; Krustrup (2008) Sports Med</p>
            <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium mb-5 w-max">
              Optional — skip if you haven't done this test
            </span>

            <ProtocolSteps items={TEST_PROTOCOLS.yoyo.protocol} />

            <div className="mb-5">
              <NumInput
                label="Level reached (e.g. 17.5 = Level 17, Shuttle 5)"
                value={yoyoLevel}
                onChange={setYoyoLevel}
                placeholder="17.5"
              />
            </div>

            <NormTable rows={[
              { label: 'Excellent', m: '≥ Level 20', f: '≥ Level 17', col: 'text-green-600' },
              { label: 'Good',      m: '≥ Level 17', f: '≥ Level 14', col: 'text-blue-600' },
              { label: 'Average',   m: '≥ Level 14', f: '≥ Level 11', col: 'text-yellow-600' },
              { label: 'Below avg', m: '< Level 14', f: '< Level 11', col: 'text-red-500' },
            ]} />

            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                The Yo-Yo IR1 has the highest correlation with match running distance and high-intensity distance covered of any field test (Rampinini et al., 2007). It is the criterion aerobic test for professional football.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 7: Results ───────────────────────────────────────────── */}
        {step === 7 && results && completedTest && (
          <div className="flex-1 flex flex-col py-8">
            <div className="flex items-center gap-2 mb-1">
              <Award size={20} className="text-brand-500" />
              <h2 className="text-2xl font-bold text-gray-900">Your Energy Profile</h2>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Benchmarked against football-specific norms for {sex === 'male' ? 'male' : 'female'} players
            </p>

            {/* ── Fatigue Index hero ── */}
            {results.fatigueIndex !== undefined && (
              <Card className="p-5 mb-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fatigue Index</p>
                  <GradeBadge grade={results.fiGrade} />
                </div>
                <div className="text-4xl font-extrabold text-brand-500 mb-2">
                  {results.fatigueIndex.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  <span className="font-semibold">Formula (Girard et al., 2011):</span> FI = [(Total time − n × Best time) / (n × Best time)] × 100
                </p>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    A lower FI means your aerobic system effectively resynthesises phosphocreatine between sprints. A FI below 3% is typical of elite footballers; above 8% suggests limited aerobic recovery capacity.
                  </p>
                </div>
              </Card>
            )}

            {/* ── Aerobic / Anaerobic scores ── */}
            {(results.aerobicScore !== undefined || results.anaerobicScore !== undefined) && (
              <Card className="p-5 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Energy System Scores</p>

                {results.aerobicScore !== undefined && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                      <span className="font-semibold">🫀 Aerobic capacity</span>
                      <span className="font-bold text-blue-600">{results.aerobicScore} / 100</span>
                    </div>
                    <div className="h-3 rounded-full bg-blue-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 transition-all duration-700"
                        style={{ width: `${results.aerobicScore}%` }}
                      />
                    </div>
                  </div>
                )}

                {results.anaerobicScore !== undefined && (
                  <div className="mb-5">
                    <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                      <span className="font-semibold">⚡ Anaerobic power</span>
                      <span className="font-bold text-orange-500">{results.anaerobicScore} / 100</span>
                    </div>
                    <div className="h-3 rounded-full bg-orange-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-400 transition-all duration-700"
                        style={{ width: `${results.anaerobicScore}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Position demand context */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Your position demands ({position}) — Stølen et al. (2005)
                  </p>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-blue-600 font-medium">Aerobic {posProfile.aerobic}%</span>
                    <span className="text-orange-500 font-medium">Anaerobic {posProfile.anaerobic}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-orange-100 overflow-hidden mb-3">
                    <div className="h-full rounded-full bg-blue-300" style={{ width: `${posProfile.aerobic}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    <span className="font-medium">Key demand:</span> {posProfile.keyDemand}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Typical sprint load: {posProfile.sprintCount} per match</p>
                </div>
              </Card>
            )}

            {/* ── Individual grades ── */}
            <Card className="p-5 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Test Breakdown</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: '10m Sprint',  value: completedTest.sprint10m  ? `${completedTest.sprint10m}s`           : null, grade: results.sprint10mGrade },
                  { label: '30m Sprint',  value: completedTest.sprint30m  ? `${completedTest.sprint30m}s`           : null, grade: results.sprint30mGrade },
                  { label: 'CMJ (best)',  value: completedTest.cmjBest    ? `${completedTest.cmjBest}cm`            : null, grade: results.cmjGrade       },
                  { label: 'RSA Mean',    value: results.rsaMeanTime      ? `${results.rsaMeanTime.toFixed(2)}s`    : null, grade: results.rsaGrade       },
                  { label: 'RSA Best',    value: results.rsaBestTime      ? `${results.rsaBestTime.toFixed(2)}s`    : null, grade: undefined              },
                  { label: 'Fatigue Index', value: results.fatigueIndex   ? `${results.fatigueIndex.toFixed(1)}%`  : null, grade: results.fiGrade        },
                  { label: 'Yo-Yo IR1',   value: completedTest.yoyoLevel  ? `Level ${completedTest.yoyoLevel}`     : null, grade: results.yoyoGrade      },
                ]
                  .filter(row => row.value !== null)
                  .map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 flex-1">{row.label}</span>
                      <span className="text-sm font-bold text-gray-900">{row.value}</span>
                      <GradeBadge grade={row.grade} />
                    </div>
                  ))}
              </div>
            </Card>

            {/* ── Science context ── */}
            <Card className="p-4 mb-5 border-gray-200 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Why this matters for your game</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Football is ~88–90% aerobic in total energy supply (Stølen et al., 2005), yet every sprint, jump and duel is almost entirely anaerobic. Your Fatigue Index captures how well your aerobic base supports recovery <em>between</em> explosive efforts — because phosphocreatine resynthesis is an aerobic process (Girard et al., 2011; Glaister, 2005). A strong aerobic engine keeps you explosive for the full 90 minutes.
              </p>
            </Card>

            <button
              onClick={() => onComplete(completedTest, results)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg mb-8"
            >
              <Check size={18} />
              Save Results &amp; Continue
            </button>
          </div>
        )}

        {/* ── Nav buttons (steps 1–6) ──────────────────────────────────── */}
        {step > 0 && step < 7 && (
          <div className="flex gap-3 py-6">
            {/* Back — always visible in non-RSA steps; in RSA only when done */}
            {(step !== 5 || rsaDone) && (
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}

            {/* Continue — hidden on RSA step while sprints are in progress */}
            {step !== 5 && (
              <button
                onClick={goNext}
                disabled={!canNext()}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                  canNext()
                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step === 6 ? 'See My Results' : 'Continue'}
                <ChevronRight size={16} />
              </button>
            )}

            {/* RSA done → show Continue */}
            {step === 5 && rsaDone && (
              <button
                onClick={goNext}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 shadow-sm"
              >
                Continue <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
