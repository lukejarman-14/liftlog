import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X } from 'lucide-react';
import { WorkoutSession } from '../types';

interface ShareStatsCardProps {
  sessions: WorkoutSession[];
  streak: number;
  playerName: string;
  onClose: () => void;
}

export function ShareStatsCard({ sessions, streak, playerName, onClose }: ShareStatsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const totalSessions = sessions.length;
  const totalVolume = sessions.reduce((acc, s) =>
    acc + s.exercises.reduce((ea, ex) =>
      ea + ex.sets.reduce((es, set) => es + set.reps * set.weight, 0), 0), 0);
  const thisWeek = (() => {
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return sessions.filter(s => new Date(s.date) >= monday).length;
  })();

  const tier = streak >= 12 ? 'red' : streak >= 8 ? 'orange' : streak >= 4 ? 'amber' : 'green';
  const emoji = tier === 'red' ? '💥' : tier === 'orange' || tier === 'amber' ? '🔥' : '🌱';
  const gradients: Record<string, string> = {
    green:  'from-emerald-500 to-emerald-600',
    amber:  'from-amber-500 to-orange-500',
    orange: 'from-orange-500 to-red-500',
    red:    'from-red-500 to-red-700',
  };
  const gradient = gradients[tier];

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'vector-football-stats.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Vector Football Stats',
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'vector-football-stats.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 100);
        }
      }, 'image/png');
    } catch {
      // share cancelled or unsupported — fail silently
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
      >
        <X size={18} className="text-white" />
      </button>

      {/* The card that gets captured */}
      <div
        ref={cardRef}
        className={`w-72 rounded-3xl bg-gradient-to-br ${gradient} p-6 shadow-2xl`}
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-sm font-black text-white">VF</span>
          </div>
          <span className="text-white/80 text-xs font-semibold">Vector Football</span>
        </div>

        <p className="text-white/70 text-sm font-medium mb-1">{playerName}</p>
        <div className="flex items-end gap-2 mb-6">
          <span className="text-5xl font-black text-white leading-none">{streak}</span>
          <div className="pb-1">
            <p className="text-white text-sm font-bold leading-tight">week streak</p>
            <p className="text-white/70 text-xs">{emoji} {tier === 'red' ? 'Elite' : tier === 'orange' ? 'Serious' : tier === 'amber' ? 'Building' : 'Started'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white font-black text-lg leading-none">{totalSessions}</p>
            <p className="text-white/70 text-xs mt-0.5">sessions</p>
          </div>
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white font-black text-lg leading-none">{thisWeek}</p>
            <p className="text-white/70 text-xs mt-0.5">this week</p>
          </div>
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white font-black text-lg leading-none">{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(0)}k` : totalVolume}</p>
            <p className="text-white/70 text-xs mt-0.5">kg lifted</p>
          </div>
        </div>

        <p className="text-white/50 text-[10px] text-center mt-4">vectorfootball.co.uk</p>
      </div>

      <button
        onClick={handleShare}
        disabled={sharing}
        className="mt-6 px-8 py-3.5 rounded-2xl bg-white text-gray-900 font-extrabold text-base shadow-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {sharing ? 'Preparing...' : 'Share Stats'}
      </button>
      <p className="text-white/50 text-xs mt-2">Saves as image to share anywhere</p>
    </div>
  );
}
