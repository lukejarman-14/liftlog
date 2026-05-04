/**
 * ProgrammeHub — the Plans tab.
 * Primary entry: Build My Program (AI generator).
 * Secondary: history of generated programs.
 */

import { useState } from 'react';
import { Zap, Clock, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { GeneratedProgramme, NavState, UserProfile } from '../../types';

interface Props {
  userProfile: UserProfile;
  generatedProgrammes: GeneratedProgramme[];
  activeProgrammeId: string | null;
  onNavigate: (nav: NavState) => void;
  onViewProgramme: (programme: GeneratedProgramme) => void;
  onDeleteProgramme: (id: string) => void;
}

function timeSince(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

const LEVEL_COLOURS: Record<string, { bg: string; text: string }> = {
  elite:    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  high:     { bg: 'bg-green-100',   text: 'text-green-700' },
  moderate: { bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  low:      { bg: 'bg-red-100',     text: 'text-red-700' },
};

export function ProgrammeHub({ userProfile, generatedProgrammes, activeProgrammeId, onNavigate, onViewProgramme, onDeleteProgramme }: Props) {
  const expWeeks: Record<string, string> = { '<1': '6', '1-3': '8', '3-5': '10', '5+': '12' };
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <Layout title="My Program">
      {/* ── Primary CTA ── */}
      <button
        onClick={() => onNavigate({ screen: 'programme-builder' })}
        className="w-full mb-6 p-5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-left shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-yellow-300" />
            <span className="font-bold text-lg">Build My Program</span>
          </div>
          <ChevronRight size={20} className="text-white/70" />
        </div>
        <p className="text-sm text-white/80 leading-snug">
          Personalised {expWeeks[userProfile.experienceYears] ?? '8'}-week football S&C plan. Built around your position, goals, match day, and today's readiness.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {['Position-specific', 'F-V aligned', 'MD periodisation', 'Prehab included'].map(tag => (
            <span key={tag} className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">{tag}</span>
          ))}
        </div>
      </button>

      {/* ── Previous programs ── */}
      {generatedProgrammes.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Previous Programs</p>
          <div className="flex flex-col gap-3">
            {generatedProgrammes.map(prog => {
              const levelStyle = LEVEL_COLOURS[prog.readinessLevel] ?? LEVEL_COLOURS.high;
              const isActive = prog.id === activeProgrammeId;
              const pendingDelete = confirmDeleteId === prog.id;
              return (
                <Card key={prog.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{prog.title}</p>
                        {isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 flex-shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{prog.summary.split('.')[0]}.</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${levelStyle.bg} ${levelStyle.text}`}>
                          {prog.readinessLevel.charAt(0).toUpperCase() + prog.readinessLevel.slice(1)} readiness
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={10} /> {timeSince(prog.createdAt)}
                        </span>
                        <span className="text-xs text-gray-400">{prog.durationWeeks}wk · {prog.inputs.sessionsPerWeek}/wk</span>
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => onViewProgramme(prog)}
                        className="p-2 text-brand-500 hover:bg-brand-50 rounded-xl transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(pendingDelete ? null : prog.id)}
                        className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Inline delete confirmation */}
                  {pendingDelete && (
                    <div className="mt-3 pt-3 border-t border-red-100 flex items-center justify-between gap-2">
                      <p className="text-xs text-red-600 font-medium">Remove this programme?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => { onDeleteProgramme(prog.id); setConfirmDeleteId(null); }}
                          className="px-3 py-1.5 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="p-5 text-center">
          <RefreshCw size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-600">No programs yet</p>
          <p className="text-xs text-gray-400 mt-1">Build your first program above — it takes about 60 seconds.</p>
        </Card>
      )}

      <div className="h-6" />
    </Layout>
  );
}
