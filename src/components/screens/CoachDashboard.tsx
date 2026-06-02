import { useState } from 'react';
import { Users, Copy, Check, UserPlus, Calendar, ClipboardList, ChevronRight } from 'lucide-react';

export interface SquadPlayer {
  id: string;
  name: string;
  readiness: 'ready' | 'moderate' | 'low' | 'unknown';
  lastSessionLabel?: string;
}

interface CoachDashboardProps {
  coachName: string;
  /** Stable seed (e.g. user id or email) used to derive the invite code. */
  inviteSeed: string;
  players?: SquadPlayer[];
  maxPlayers?: number;
  onOpenProfile?: () => void;
}

/** Deterministically derive a short, shareable invite code from a seed string. */
function deriveInviteCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  let n = hash;
  for (let i = 0; i < 5; i++) {
    code += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return `VF-${code}`;
}

const READINESS_DOT: Record<SquadPlayer['readiness'], string> = {
  ready: 'bg-green-500',
  moderate: 'bg-amber-400',
  low: 'bg-red-500',
  unknown: 'bg-gray-300',
};

const READINESS_LABEL: Record<SquadPlayer['readiness'], string> = {
  ready: 'Ready today',
  moderate: 'Moderate',
  low: 'Low readiness',
  unknown: 'No data yet',
};

export function CoachDashboard({
  coachName,
  inviteSeed,
  players = [],
  maxPlayers = 30,
  onOpenProfile,
}: CoachDashboardProps) {
  const [copied, setCopied] = useState(false);
  const inviteCode = deriveInviteCode(inviteSeed);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div
        className="bg-gradient-to-b from-brand-600 to-brand-500 text-white px-5 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Coach</p>
            <h1 className="text-2xl font-extrabold">{coachName || 'Your Squad'}</h1>
          </div>
          <button
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Profile"
          >
            <Users size={18} />
          </button>
        </div>

        {/* Squad count */}
        <div className="flex items-center gap-2 text-white/90 text-sm">
          <Users size={15} />
          <span className="font-semibold">{players.length} / {maxPlayers}</span>
          <span className="text-white/60">players in your squad</span>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-5 -mt-4">
        {/* Invite code card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your invite code</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-brand-50 border-2 border-dashed border-brand-200 rounded-xl py-3 text-center">
              <span className="text-xl font-extrabold text-brand-600 tracking-widest font-mono">{inviteCode}</span>
            </div>
            <button
              onClick={copyCode}
              className="w-12 h-12 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors flex-shrink-0"
              aria-label="Copy code"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Share this code with your players. When they enter it during sign-up, they join your squad and get full Premium access — at no extra cost to them.
          </p>
        </div>

        {/* Squad list / empty state */}
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">Players</p>

        {players.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={26} className="text-brand-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">No players yet</h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              Share your invite code above to add your first player. They'll appear here once they join.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {players.map(p => (
              <button
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 text-left hover:border-brand-200 transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${READINESS_DOT[p.readiness]}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">
                    {READINESS_LABEL[p.readiness]}{p.lastSessionLabel ? ` · ${p.lastSessionLabel}` : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Coach quick actions (placeholders for now) */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2 opacity-60">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
              <ClipboardList size={18} className="text-brand-500" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">Assign programmes</p>
            <p className="text-xs text-gray-400">Coming soon</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2 opacity-60">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
              <Calendar size={18} className="text-brand-500" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">Squad schedule</p>
            <p className="text-xs text-gray-400">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
