import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Save, RotateCcw, Copy } from 'lucide-react';
import type { SquadPlayer } from './CoachDashboard';

// ─── Formation definitions ────────────────────────────────────────────────────
interface PitchPosition {
  id: string;
  label: string;
  x: number; // 0-100 % from left
  y: number; // 0-100 % from top (GK near bottom ~88)
}

const FORMATIONS: Record<string, { name: string; positions: PitchPosition[] }> = {
  '4-4-2': {
    name: '4-4-2',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RB', label: 'RB', x: 82, y: 72 }, { id: 'CB-R', label: 'CB', x: 60, y: 72 }, { id: 'CB-L', label: 'CB', x: 40, y: 72 }, { id: 'LB', label: 'LB', x: 18, y: 72 },
      { id: 'RM', label: 'RM', x: 82, y: 50 }, { id: 'CM-R', label: 'CM', x: 60, y: 50 }, { id: 'CM-L', label: 'CM', x: 40, y: 50 }, { id: 'LM', label: 'LM', x: 18, y: 50 },
      { id: 'ST-R', label: 'ST', x: 62, y: 18 }, { id: 'ST-L', label: 'ST', x: 38, y: 18 },
    ],
  },
  '4-4-2 DM': {
    name: '4-4-2 ◆',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RB', label: 'RB', x: 82, y: 72 }, { id: 'CB-R', label: 'CB', x: 60, y: 72 }, { id: 'CB-L', label: 'CB', x: 40, y: 72 }, { id: 'LB', label: 'LB', x: 18, y: 72 },
      { id: 'DM', label: 'DM', x: 50, y: 58 },
      { id: 'CM-R', label: 'CM', x: 72, y: 48 }, { id: 'CM-L', label: 'CM', x: 28, y: 48 },
      { id: 'AM', label: 'AM', x: 50, y: 36 },
      { id: 'ST-R', label: 'ST', x: 62, y: 18 }, { id: 'ST-L', label: 'ST', x: 38, y: 18 },
    ],
  },
  '4-3-3': {
    name: '4-3-3',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RB', label: 'RB', x: 82, y: 72 }, { id: 'CB-R', label: 'CB', x: 60, y: 72 }, { id: 'CB-L', label: 'CB', x: 40, y: 72 }, { id: 'LB', label: 'LB', x: 18, y: 72 },
      { id: 'CM-R', label: 'CM', x: 70, y: 50 }, { id: 'CM-C', label: 'CM', x: 50, y: 48 }, { id: 'CM-L', label: 'CM', x: 30, y: 50 },
      { id: 'RW', label: 'RW', x: 82, y: 20 }, { id: 'ST', label: 'ST', x: 50, y: 13 }, { id: 'LW', label: 'LW', x: 18, y: 20 },
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RB', label: 'RB', x: 82, y: 72 }, { id: 'CB-R', label: 'CB', x: 60, y: 72 }, { id: 'CB-L', label: 'CB', x: 40, y: 72 }, { id: 'LB', label: 'LB', x: 18, y: 72 },
      { id: 'DM-R', label: 'DM', x: 63, y: 60 }, { id: 'DM-L', label: 'DM', x: 37, y: 60 },
      { id: 'RAM', label: 'AM', x: 78, y: 40 }, { id: 'CAM', label: 'AM', x: 50, y: 37 }, { id: 'LAM', label: 'AM', x: 22, y: 40 },
      { id: 'ST', label: 'ST', x: 50, y: 14 },
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'CB-R', label: 'CB', x: 70, y: 74 }, { id: 'CB-C', label: 'CB', x: 50, y: 74 }, { id: 'CB-L', label: 'CB', x: 30, y: 74 },
      { id: 'RWB', label: 'RWB', x: 88, y: 55 }, { id: 'CM-R', label: 'CM', x: 67, y: 50 }, { id: 'CM-C', label: 'CM', x: 50, y: 48 }, { id: 'CM-L', label: 'CM', x: 33, y: 50 }, { id: 'LWB', label: 'LWB', x: 12, y: 55 },
      { id: 'ST-R', label: 'ST', x: 62, y: 18 }, { id: 'ST-L', label: 'ST', x: 38, y: 18 },
    ],
  },
  '5-3-2': {
    name: '5-3-2',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RWB', label: 'RWB', x: 88, y: 72 }, { id: 'CB-R', label: 'CB', x: 70, y: 74 }, { id: 'CB-C', label: 'CB', x: 50, y: 76 }, { id: 'CB-L', label: 'CB', x: 30, y: 74 }, { id: 'LWB', label: 'LWB', x: 12, y: 72 },
      { id: 'CM-R', label: 'CM', x: 68, y: 50 }, { id: 'CM-C', label: 'CM', x: 50, y: 48 }, { id: 'CM-L', label: 'CM', x: 32, y: 50 },
      { id: 'ST-R', label: 'ST', x: 62, y: 18 }, { id: 'ST-L', label: 'ST', x: 38, y: 18 },
    ],
  },
  '4-1-4-1': {
    name: '4-1-4-1',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RB', label: 'RB', x: 82, y: 74 }, { id: 'CB-R', label: 'CB', x: 60, y: 74 }, { id: 'CB-L', label: 'CB', x: 40, y: 74 }, { id: 'LB', label: 'LB', x: 18, y: 74 },
      { id: 'DM', label: 'DM', x: 50, y: 62 },
      { id: 'RM', label: 'RM', x: 83, y: 46 }, { id: 'CM-R', label: 'CM', x: 62, y: 46 }, { id: 'CM-L', label: 'CM', x: 38, y: 46 }, { id: 'LM', label: 'LM', x: 17, y: 46 },
      { id: 'ST', label: 'ST', x: 50, y: 14 },
    ],
  },
  '3-4-3': {
    name: '3-4-3',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'CB-R', label: 'CB', x: 70, y: 74 }, { id: 'CB-C', label: 'CB', x: 50, y: 74 }, { id: 'CB-L', label: 'CB', x: 30, y: 74 },
      { id: 'RM', label: 'RM', x: 82, y: 52 }, { id: 'CM-R', label: 'CM', x: 60, y: 52 }, { id: 'CM-L', label: 'CM', x: 40, y: 52 }, { id: 'LM', label: 'LM', x: 18, y: 52 },
      { id: 'RW', label: 'RW', x: 80, y: 20 }, { id: 'ST', label: 'ST', x: 50, y: 14 }, { id: 'LW', label: 'LW', x: 20, y: 20 },
    ],
  },
  '4-5-1': {
    name: '4-5-1',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RB', label: 'RB', x: 82, y: 74 }, { id: 'CB-R', label: 'CB', x: 60, y: 74 }, { id: 'CB-L', label: 'CB', x: 40, y: 74 }, { id: 'LB', label: 'LB', x: 18, y: 74 },
      { id: 'RM', label: 'RM', x: 85, y: 50 }, { id: 'CM-R', label: 'CM', x: 65, y: 50 }, { id: 'CM-C', label: 'CM', x: 50, y: 48 }, { id: 'CM-L', label: 'CM', x: 35, y: 50 }, { id: 'LM', label: 'LM', x: 15, y: 50 },
      { id: 'ST', label: 'ST', x: 50, y: 14 },
    ],
  },
  '5-4-1': {
    name: '5-4-1',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'RWB', label: 'RWB', x: 87, y: 72 }, { id: 'CB-R', label: 'CB', x: 68, y: 75 }, { id: 'CB-C', label: 'CB', x: 50, y: 76 }, { id: 'CB-L', label: 'CB', x: 32, y: 75 }, { id: 'LWB', label: 'LWB', x: 13, y: 72 },
      { id: 'RM', label: 'RM', x: 80, y: 50 }, { id: 'CM-R', label: 'CM', x: 60, y: 50 }, { id: 'CM-L', label: 'CM', x: 40, y: 50 }, { id: 'LM', label: 'LM', x: 20, y: 50 },
      { id: 'ST', label: 'ST', x: 50, y: 14 },
    ],
  },
  '3-4-2-1': {
    name: '3-4-2-1',
    positions: [
      { id: 'GK', label: 'GK', x: 50, y: 88 },
      { id: 'CB-R', label: 'CB', x: 70, y: 74 }, { id: 'CB-C', label: 'CB', x: 50, y: 74 }, { id: 'CB-L', label: 'CB', x: 30, y: 74 },
      { id: 'RM', label: 'RM', x: 82, y: 56 }, { id: 'CM-R', label: 'CM', x: 62, y: 56 }, { id: 'CM-L', label: 'CM', x: 38, y: 56 }, { id: 'LM', label: 'LM', x: 18, y: 56 },
      { id: 'SS-R', label: 'SS', x: 65, y: 30 }, { id: 'SS-L', label: 'SS', x: 35, y: 30 },
      { id: 'ST', label: 'ST', x: 50, y: 13 },
    ],
  },
};

const FORMATION_KEYS = Object.keys(FORMATIONS);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shortName(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}. ${parts[parts.length - 1]}`;
  return name.slice(0, 8);
}
function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface FormationData {
  formation: string;
  assignments: Record<string, string>; // positionId -> playerId
  bench: string[]; // playerIds
}

interface FormationBuilderProps {
  players: SquadPlayer[];
  matchDate?: string;
  initialData?: FormationData;
  onSave: (data: FormationData, formationData: FormationData) => Promise<void>;
  onNotify?: (message: string) => Promise<void>;
  onFetchPreviousFormation?: () => Promise<FormationData | null>;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FormationBuilder({ players, matchDate, initialData, onSave, onNotify, onFetchPreviousFormation, onClose }: FormationBuilderProps) {
  const [formation, setFormation] = useState(initialData?.formation ?? '4-3-3');
  const [assignments, setAssignments] = useState<Record<string, string>>(initialData?.assignments ?? {});
  const [bench, setBench] = useState<Set<string>>(new Set(initialData?.bench ?? []));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Notify dialog (shown after save when onNotify is available)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [notifyIncludeLineup, setNotifyIncludeLineup] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [savedAssignments, setSavedAssignments] = useState<Record<string, string>>({});

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const pitchRef = useRef<HTMLDivElement>(null);

  const currentFormation = FORMATIONS[formation];

  // Derived sets
  const assignedIds = new Set(Object.values(assignments));
  const unassigned = players.filter(p => !assignedIds.has(p.id) && !bench.has(p.id));
  const benchPlayers = players.filter(p => bench.has(p.id));
  const getPlayer = (id: string) => players.find(p => p.id === id);

  // ── Drag handlers ───────────────────────────────────────────────────────
  const startDrag = useCallback((playerId: string, e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDraggingId(playerId);
    void (e.clientX - rect.left - rect.width / 2); // offset calc reserved for future snap refinement
    setDragPos({ x: e.clientX, y: e.clientY });
    // Close drawer when dragging starts
    setDrawerOpen(false);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingId) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [draggingId]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingId) return;
    const pitch = pitchRef.current;
    if (pitch) {
      const rect = pitch.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;

      // Find nearest position within threshold
      let nearest: PitchPosition | null = null;
      let minDist = 12;
      for (const pos of currentFormation.positions) {
        const dist = Math.sqrt(Math.pow(relX - pos.x, 2) + Math.pow(relY - pos.y, 2));
        if (dist < minDist) { nearest = pos; minDist = dist; }
      }
      if (nearest) {
        setAssignments(prev => {
          const next = { ...prev };
          // Remove from any existing position
          for (const k of Object.keys(next)) { if (next[k] === draggingId) delete next[k]; }
          // Remove existing occupant back to unassigned (don't delete, just leave unassigned)
          next[nearest!.id] = draggingId;
          return next;
        });
        // Remove from bench if dragged onto pitch
        setBench(prev => { const s = new Set(prev); s.delete(draggingId); return s; });
      } else {
        // Check if dropped on bench strip (right side, x > 85% of screen)
        const screenW = window.innerWidth;
        if (e.clientX > screenW * 0.82) {
          setBench(prev => { const s = new Set(prev); s.add(draggingId); return s; });
          setAssignments(prev => {
            const next = { ...prev };
            for (const k of Object.keys(next)) { if (next[k] === draggingId) delete next[k]; }
            return next;
          });
        }
      }
    }
    setDraggingId(null);
  }, [draggingId, currentFormation]);

  // When formation changes, clear assignments
  const handleFormationChange = (f: string) => {
    setFormation(f);
    setAssignments({});
  };

  // Remove player from position (tap X)
  const removeFromPosition = (posId: string) => {
    setAssignments(prev => { const n = { ...prev }; delete n[posId]; return n; });
  };

  const handleSave = async () => {
    setSaving(true);
    const formationData = { formation, assignments, bench: [...bench] };
    await onSave(formationData, formationData);
    // Also save as template
    try { localStorage.setItem('vf_formation_template', JSON.stringify(formationData)); } catch { /* ignore */ }
    setSaving(false);
    if (onNotify) {
      setSavedAssignments({ ...assignments });
      setShowNotifyDialog(true);
    } else {
      onClose();
    }
  };

  // Load previous match's formation
  const loadPreviousFormation = async () => {
    if (!onFetchPreviousFormation) return;
    const prevFormation = await onFetchPreviousFormation();
    if (prevFormation) {
      setFormation(prevFormation.formation ?? '4-3-3');
      setAssignments(prevFormation.assignments ?? {});
      setBench(new Set(prevFormation.bench ?? []));
    }
  };

  const handleNotify = async (includeLineup: boolean) => {
    if (!onNotify) return;
    setNotifySending(true);
    const currentFormationDef = FORMATIONS[formation];
    if (includeLineup) {
      const starters = currentFormationDef.positions
        .map(pos => {
          const pid = savedAssignments[pos.id];
          const player = players.find(p => p.id === pid);
          return player ? `${pos.label} ${player.name}` : null;
        })
        .filter(Boolean);
      const benchList = [...bench].map(id => players.find(p => p.id === id)?.name).filter(Boolean);
      const matchLabel = matchDate ? ` for ${matchDate}` : '';
      let msg = `📋 Squad selected${matchLabel} — ${formation}\n\nStarting XI:\n${starters.join('\n')}`;
      if (benchList.length) msg += `\n\nBench: ${benchList.join(', ')}`;
      await onNotify(msg);
    } else {
      const matchLabel = matchDate ? ` for ${matchDate}` : '';
      await onNotify(`📋 Squad selected${matchLabel} — check with your coach for the details.`);
    }
    setNotifySending(false);
    setShowNotifyDialog(false);
    onClose();
  };

  // Load template
  const loadTemplate = () => {
    try {
      const raw = localStorage.getItem('vf_formation_template');
      if (raw) {
        const t = JSON.parse(raw) as FormationData;
        setFormation(t.formation ?? formation);
        setAssignments(t.assignments ?? {});
        setBench(new Set(t.bench ?? []));
      }
    } catch { /* ignore */ }
  };

  // Keyboard escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#2d6a2d] flex flex-col select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{matchDate ? `Match · ${matchDate}` : 'Formation Builder'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadTemplate} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" title="Load saved template">
            <RotateCcw size={16} className="text-white" />
          </button>
          {onFetchPreviousFormation && (
            <button onClick={loadPreviousFormation} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" title="Load previous match formation">
              <Copy size={16} className="text-white" />
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="px-4 h-9 rounded-full bg-white text-[#2d6a2d] text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
            <Save size={14} />{saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Formation selector ── */}
      <div className="flex-shrink-0 px-2 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FORMATION_KEYS.map(k => (
            <button
              key={k}
              onClick={() => handleFormationChange(k)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${formation === k ? 'bg-white text-[#2d6a2d]' : 'bg-white/20 text-white'}`}
            >{FORMATIONS[k].name}</button>
          ))}
        </div>
      </div>

      {/* ── Main area: left arrow + pitch + bench ── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* Left pull-out drawer */}
        <div className={`absolute left-0 top-0 bottom-0 z-20 flex transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-[calc(100%-28px)]'}`}>
          {/* Drawer panel */}
          <div className="w-44 bg-white/95 backdrop-blur rounded-r-2xl flex flex-col shadow-xl">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-3 pt-3 pb-2">Squad ({unassigned.length})</p>
            <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1.5">
              {unassigned.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">All players placed</p>
              )}
              {unassigned.map(p => (
                <div
                  key={p.id}
                  onPointerDown={e => startDrag(p.id, e)}
                  className={`flex items-center gap-2 bg-white rounded-xl px-2.5 py-2 border border-gray-100 cursor-grab active:cursor-grabbing shadow-sm ${draggingId === p.id ? 'opacity-40' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{initials(p.name)}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{shortName(p.name)}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p.position}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Toggle arrow tab */}
          <button
            onClick={() => setDrawerOpen(o => !o)}
            className="w-7 self-center bg-white/90 rounded-r-xl h-16 flex items-center justify-center shadow-md"
          >
            {drawerOpen ? <ChevronLeft size={16} className="text-gray-600" /> : <ChevronRight size={16} className="text-gray-600" />}
          </button>
        </div>

        {/* Pitch */}
        <div
          ref={pitchRef}
          className="flex-1 relative mx-10 my-1"
          style={{ userSelect: 'none' }}
        >
          {/* Pitch markings */}
          <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-white/30">
            {/* Center line */}
            <div className="absolute left-0 right-0 border-t border-white/30" style={{ top: '50%' }} />
            {/* Center circle */}
            <div className="absolute rounded-full border border-white/30" style={{ width: '30%', height: '17%', top: '41.5%', left: '35%' }} />
            {/* Center dot */}
            <div className="absolute rounded-full bg-white/40" style={{ width: 6, height: 6, top: 'calc(50% - 3px)', left: 'calc(50% - 3px)' }} />
            {/* Top penalty area */}
            <div className="absolute border border-white/30" style={{ width: '55%', height: '18%', top: 0, left: '22.5%' }} />
            {/* Top goal area */}
            <div className="absolute border border-white/30" style={{ width: '28%', height: '8%', top: 0, left: '36%' }} />
            {/* Bottom penalty area */}
            <div className="absolute border border-white/30" style={{ width: '55%', height: '18%', bottom: 0, left: '22.5%' }} />
            {/* Bottom goal area */}
            <div className="absolute border border-white/30" style={{ width: '28%', height: '8%', bottom: 0, left: '36%' }} />
          </div>

          {/* Position dots */}
          {currentFormation.positions.map(pos => {
            const playerId = assignments[pos.id];
            const player = playerId ? getPlayer(playerId) : null;
            return (
              <div
                key={pos.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                {player ? (
                  <div
                    onPointerDown={e => startDrag(player.id, e)}
                    className={`relative flex flex-col items-center cursor-grab ${draggingId === player.id ? 'opacity-40' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-xs font-bold text-[#2d6a2d] border-2 border-brand-500">
                      {initials(player.name)}
                    </div>
                    <div className="mt-0.5 bg-black/60 rounded px-1.5 py-0.5 max-w-[64px]">
                      <p className="text-[9px] text-white font-semibold text-center leading-tight truncate">{shortName(player.name)}</p>
                    </div>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => removeFromPosition(pos.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                    >✕</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full border-2 border-dashed border-white/60 flex items-center justify-center">
                      <span className="text-[9px] text-white/70 font-bold">{pos.label}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right bench strip */}
        <div className="w-14 flex flex-col bg-black/20 rounded-l-2xl my-1 py-2 px-1 gap-1.5 overflow-y-auto">
          <p className="text-[9px] text-white/60 font-bold uppercase text-center mb-1">Bench</p>
          {benchPlayers.map(p => (
            <div
              key={p.id}
              onPointerDown={e => startDrag(p.id, e)}
              className={`flex flex-col items-center cursor-grab ${draggingId === p.id ? 'opacity-40' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                {initials(p.name)}
              </div>
              <p className="text-[8px] text-white/80 text-center mt-0.5 leading-tight w-full truncate px-0.5">{shortName(p.name).split(' ').pop()}</p>
            </div>
          ))}
          {benchPlayers.length < 7 && (
            <p className="text-[8px] text-white/30 text-center mt-1 leading-tight">drag here</p>
          )}
        </div>
      </div>

      {/* ── Player count footer ── */}
      <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2 text-xs text-white/60">
        <span>⚽ {Object.keys(assignments).length}/11 placed</span>
        <span>·</span>
        <span>🟡 {benchPlayers.length} on bench</span>
        <span>·</span>
        <span>👤 {unassigned.length} unassigned</span>
      </div>

      {/* ── Ghost drag element ── */}
      {draggingId && (() => {
        const p = getPlayer(draggingId);
        if (!p) return null;
        return (
          <div
            className="fixed pointer-events-none z-[200] flex flex-col items-center"
            style={{ left: dragPos.x - 20, top: dragPos.y - 20, transform: 'translate(-10px, -10px)' }}
          >
            <div className="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-xs font-bold text-[#2d6a2d] border-2 border-brand-500 opacity-90">
              {initials(p.name)}
            </div>
            <div className="mt-0.5 bg-black/70 rounded px-1.5 py-0.5">
              <p className="text-[9px] text-white font-semibold">{shortName(p.name)}</p>
            </div>
          </div>
        );
      })()}

      {/* ── Notify players dialog ── */}
      {showNotifyDialog && (
        <div className="fixed inset-0 z-[300] flex items-end">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full bg-white rounded-t-3xl p-6 pb-12">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="text-center mb-5">
              <p className="text-2xl mb-1">📋</p>
              <p className="font-bold text-gray-900 text-base">Squad saved!</p>
              <p className="text-sm text-gray-500 mt-1">Notify your players?</p>
            </div>

            {/* Include lineup toggle */}
            <button
              onClick={() => setNotifyIncludeLineup(v => !v)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border mb-4 transition-colors ${notifyIncludeLineup ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Include full lineup</p>
                <p className="text-xs text-gray-400 mt-0.5">Share player names & positions with the squad</p>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${notifyIncludeLineup ? 'bg-brand-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notifyIncludeLineup ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </button>

            <p className="text-xs text-gray-400 mb-4 px-1">
              {notifyIncludeLineup
                ? '📢 Players will see formation, positions and names.'
                : '🔔 Players will see "Squad selected" — no lineup details.'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowNotifyDialog(false); onClose(); }}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
              >Save Quietly</button>
              <button
                disabled={notifySending}
                onClick={() => handleNotify(notifyIncludeLineup)}
                className="flex-1 bg-brand-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-40 text-sm"
              >{notifySending ? 'Sending…' : '📣 Announce'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
