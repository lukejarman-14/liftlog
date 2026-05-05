import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Search, GripVertical, ChevronDown, ChevronUp, BookMarked, User } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Exercise, WorkoutExercise, WorkoutTemplate, ExerciseCategory,
} from '../../types';
import { CATEGORY_COLORS } from '../../data/exercises';
import { BUILT_IN_PROGRAMS, FOOTBALL_PROGRAMS, BuiltInTemplate, Program } from '../../data/programs';

const CATEGORIES: ExerciseCategory[] = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body',
  'Isometric', 'Plyometrics',
  'Speed', 'Agility', 'Eccentric', 'Conditioning', 'Testing',
];

interface WorkoutBuilderProps {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  initialTemplateId?: string;
  onStart: (name: string, items: WorkoutExercise[]) => void;
  onSaveTemplate: (t: WorkoutTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

// ── Exercise picker sheet ──────────────────────────────────────────────────

function ExercisePicker({
  exercises,
  selected,
  onAdd,
  onClose,
}: {
  exercises: Exercise[];
  selected: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ExerciseCategory | 'All'>('All');

  const filtered = exercises.filter(ex => {
    const q = query.toLowerCase();
    return (
      (cat === 'All' || ex.category === cat) &&
      (ex.name.toLowerCase().includes(q) || ex.muscleGroups.some(m => m.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 pb-20">
      <div className="bg-white rounded-t-2xl w-full max-w-lg h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Add Exercise</h2>
          <button onClick={onClose} className="text-sm text-brand-500 font-medium">Done</button>
        </div>
        <div className="p-4 pb-2">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              placeholder="Search exercises or muscles..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['All', ...CATEGORIES] as const).map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  cat === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {filtered.map(ex => {
            const isAdded = selected.includes(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => onAdd(ex.id)}
                className={`w-full text-left flex items-center justify-between p-3 rounded-xl mb-1.5 transition-colors ${
                  isAdded ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{ex.name}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[ex.category]}`}>
                    {ex.category}
                  </span>
                </div>
                {isAdded
                  ? <span className="text-xs text-brand-500 font-semibold">Added ✓</span>
                  : <Plus size={16} className="text-gray-300" />
                }
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Rest picker (scroll-wheel drum) ───────────────────────────────────────

const MIN_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SEC_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const ITEM_H = 40;

function DrumColumn({
  options, value, onChange,
}: { options: number[]; value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const isMounting = useRef(true);

  useEffect(() => {
    const idx = options.indexOf(value);
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * ITEM_H;
    }
    const t = setTimeout(() => { isMounting.current = false; }, 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    ref.current.scrollTop = clamped * ITEM_H;
    onChange(options[clamped]);
  };

  const handleScroll = () => {
    if (isMounting.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(commit, 120);
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      style={{
        height: ITEM_H * 3,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as React.CSSProperties}
      className="[&::-webkit-scrollbar]:hidden"
    >
      <div style={{ height: ITEM_H }} />
      {options.map(o => (
        <div
          key={o}
          style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
          className={`flex items-center justify-center text-xl font-bold cursor-pointer select-none ${
            o === value ? 'text-brand-600' : 'text-gray-300'
          }`}
          onClick={() => {
            onChange(o);
            const idx = options.indexOf(o);
            if (ref.current) ref.current.scrollTop = idx * ITEM_H;
          }}
        >
          {String(o).padStart(2, '0')}
        </div>
      ))}
      <div style={{ height: ITEM_H }} />
    </div>
  );
}

function RestPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const mins = Math.floor(value / 60);
  const rawSecs = value % 60;
  const secs = SEC_OPTIONS.includes(rawSecs) ? rawSecs : Math.round(rawSecs / 5) * 5 % 60;

  // Highlight sits on the middle slot: slots are 0→ITEM_H, ITEM_H→2*ITEM_H, 2*ITEM_H→3*ITEM_H
  const highlightTop = ITEM_H; // second slot (index 1)

  return (
    <div className="col-span-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Rest</label>
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 pt-2 pb-2">
        {/* Relative wrapper so highlight is positioned against the drum area */}
        <div className="relative flex items-start justify-center">
          {/* Highlight bar — spans full width at the centre drum slot */}
          <div
            className="absolute left-0 right-0 bg-brand-50 border-y border-brand-200 rounded-lg pointer-events-none z-10"
            style={{ top: highlightTop, height: ITEM_H }}
          />

          {/* Min column */}
          <div className="flex flex-col items-center flex-1 z-20">
            <DrumColumn options={MIN_OPTIONS} value={mins} onChange={m => onChange(m * 60 + secs)} />
            <span className="text-xs text-gray-400 font-medium mt-1">min</span>
          </div>

          {/* Colon — height matches drum area so items-center lands at the right row */}
          <div
            className="flex items-center justify-center flex-shrink-0 z-20"
            style={{ height: ITEM_H * 3, width: 24 }}
          >
            <span className="text-2xl font-bold text-gray-300">:</span>
          </div>

          {/* Sec column */}
          <div className="flex flex-col items-center flex-1 z-20">
            <DrumColumn options={SEC_OPTIONS} value={secs} onChange={s => onChange(mins * 60 + s)} />
            <span className="text-xs text-gray-400 font-medium mt-1">sec</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single exercise row in the builder ────────────────────────────────────

function ExerciseRow({
  item,
  exercise,
  onChange,
  onRemove,
}: {
  item: WorkoutExercise;
  exercise: Exercise;
  onChange: (updated: WorkoutExercise) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Local string state so fields can be blank while typing (same as weight)
  const [setsStr,   setSetsStr]   = useState(item.targetSets   > 0 ? String(item.targetSets)   : '');
  const [repsStr,   setRepsStr]   = useState(item.targetReps   > 0 ? String(item.targetReps)   : '');
  const [weightStr, setWeightStr] = useState(item.targetWeight > 0 ? String(item.targetWeight) : '');

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-gray-900">{exercise.name}</span>
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[exercise.category]}`}>
            {exercise.category}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </div>

      {open && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-3 border-t border-gray-50 pt-3">
          <Input
            label="Sets"
            type="number" min="1" max="20"
            value={setsStr}
            placeholder="3"
            onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
            onChange={e => setSetsStr(e.target.value)}
            onBlur={() => {
              const v = parseInt(setsStr) || 3;
              setSetsStr(String(v));
              onChange({ ...item, targetSets: v });
            }}
          />
          <Input
            label="Reps"
            type="number" min="1" max="100"
            value={repsStr}
            placeholder="10"
            onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
            onChange={e => setRepsStr(e.target.value)}
            onBlur={() => {
              const v = parseInt(repsStr) || 10;
              setRepsStr(String(v));
              onChange({ ...item, targetReps: v });
            }}
          />
          <Input
            label="Weight (kg)"
            type="number" min="0" step="0.5"
            value={weightStr}
            placeholder="0"
            onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
            onChange={e => setWeightStr(e.target.value)}
            onBlur={() => {
              const v = parseFloat(weightStr) || 0;
              setWeightStr(v > 0 ? String(v) : '');
              onChange({ ...item, targetWeight: v });
            }}
          />
          <RestPicker
            value={item.restSeconds}
            onChange={secs => onChange({ ...item, restSeconds: secs })}
          />
        </div>
      )}
    </Card>
  );
}

// ── Programs browser ───────────────────────────────────────────────────────

function ProgramGroup({
  programs,
  openProgram,
  setOpenProgram,
  onLoad,
}: {
  programs: Program[];
  openProgram: string | null;
  setOpenProgram: (name: string | null) => void;
  onLoad: (t: BuiltInTemplate) => void;
}) {
  return (
    <>
      {programs.map(program => (
        <Card key={program.name} className="overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setOpenProgram(openProgram === program.name ? null : program.name)}
          >
            <div className="text-left min-w-0 pr-2">
              <div className="font-semibold text-gray-900 text-sm">{program.name}</div>
              <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{program.description}</div>
            </div>
            {openProgram === program.name
              ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
            }
          </button>

          {openProgram === program.name && (
            <div className="border-t border-gray-50 px-4 pb-4 pt-3 flex flex-col gap-2">
              {program.templates.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {t.description} · {t.exercises.length} exercises
                    </div>
                  </div>
                  <Button size="sm" className="ml-3 flex-shrink-0" onClick={() => onLoad(t)}>
                    Use
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

type ProgramTab = 'football' | 'general';

function ProgramsBrowser({ onLoad }: { onLoad: (t: BuiltInTemplate) => void }) {
  const [programTab, setProgramTab] = useState<ProgramTab>('football');
  const [openProgram, setOpenProgram] = useState<string | null>(null);

  const handleTabChange = (tab: ProgramTab) => {
    setProgramTab(tab);
    setOpenProgram(null);
  };

  return (
    <div>
      {/* Football / General sub-tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
        <button
          onClick={() => handleTabChange('football')}
          className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
            programTab === 'football' ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Football
        </button>
        <button
          onClick={() => handleTabChange('general')}
          className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
            programTab === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          General
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {programTab === 'football' && (
          <ProgramGroup
            programs={FOOTBALL_PROGRAMS}
            openProgram={openProgram}
            setOpenProgram={setOpenProgram}
            onLoad={onLoad}
          />
        )}
        {programTab === 'general' && (
          <ProgramGroup
            programs={BUILT_IN_PROGRAMS}
            openProgram={openProgram}
            setOpenProgram={setOpenProgram}
            onLoad={onLoad}
          />
        )}
      </div>
    </div>
  );
}

// ── My Templates browser ───────────────────────────────────────────────────

function MyTemplates({
  templates,
  onLoad,
  onDelete,
}: {
  templates: WorkoutTemplate[];
  onLoad: (t: WorkoutTemplate) => void;
  onDelete: (id: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        <BookMarked size={28} className="mx-auto mb-2 text-gray-300" />
        No saved templates yet. Build a workout and hit the save icon to store it here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {templates.map(t => (
        <Card key={t.id} className="flex items-center justify-between p-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-gray-900">{t.name}</div>
            <div className="text-xs text-gray-400">{t.exercises.length} exercises</div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <Button size="sm" onClick={() => onLoad(t)}>Load</Button>
            <button
              onClick={() => onDelete(t.id)}
              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Main WorkoutBuilder ────────────────────────────────────────────────────

type Tab = 'programs' | 'mine' | 'build';

export function WorkoutBuilder({
  exercises,
  templates,
  initialTemplateId,
  onStart,
  onSaveTemplate,
  onDeleteTemplate,
}: WorkoutBuilderProps) {
  const initial = initialTemplateId
    ? templates.find(t => t.id === initialTemplateId)
    : null;

  const [tab, setTab] = useState<Tab>(initial ? 'build' : 'programs');
  const [name, setName] = useState(initial?.name ?? '');
  const [items, setItems] = useState<WorkoutExercise[]>(initial?.exercises ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  // Tracks the ID of the template currently being edited (set when loading from My Templates)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(initial?.id ?? null);

  // Track saved state: items are "dirty" if they exist and differ from last save
  const savedItemsRef = useRef<string>(JSON.stringify(initial?.exercises ?? []));
  const isDirty = items.length > 0 && JSON.stringify(items) !== savedItemsRef.current;

  const selectedIds = items.map(i => i.exerciseId);

  const loadTemplate = (t: { id?: string; name: string; exercises: WorkoutExercise[] }) => {
    setName(t.name);
    setItems(t.exercises);
    setEditingTemplateId(t.id ?? null);
    savedItemsRef.current = JSON.stringify(t.exercises);
    setTab('build');
  };

  const addExercise = (exerciseId: string) => {
    if (selectedIds.includes(exerciseId)) return;
    const ex = exercises.find(e => e.id === exerciseId);
    if (!ex) return;
    setItems(prev => [...prev, {
      exerciseId,
      targetSets: 3,
      targetReps: 10,
      targetWeight: 0,
      restSeconds: ex.defaultRestSeconds,
    }]);
  };

  const updateItem = (idx: number, updated: WorkoutExercise) => {
    setItems(prev => prev.map((item, i) => (i === idx ? updated : item)));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Overwrite the template currently being edited (same ID)
  const handleSave = () => {
    const templateName = name.trim() || 'My Workout';
    const existingTemplate = editingTemplateId ? templates.find(t => t.id === editingTemplateId) : null;
    onSaveTemplate({
      id: editingTemplateId ?? `template-${Date.now()}`,
      name: templateName,
      exercises: items,
      createdAt: existingTemplate?.createdAt ?? Date.now(),
    });
    savedItemsRef.current = JSON.stringify(items);
  };

  // Save as a brand-new template (always new ID)
  const handleSaveAs = () => {
    const templateName = saveNameInput.trim() || name.trim() || 'My Workout';
    const newId = `template-${Date.now()}`;
    onSaveTemplate({
      id: newId,
      name: templateName,
      exercises: items,
      createdAt: Date.now(),
    });
    setEditingTemplateId(newId);
    savedItemsRef.current = JSON.stringify(items);
    setShowSave(false);
    setSaveNameInput('');
  };

  // Intercept tab change when dirty
  const handleTabChange = (nextTab: Tab) => {
    if (tab === 'build' && isDirty && nextTab !== 'build') {
      setPendingTab(nextTab);
      setShowUnsavedPrompt(true);
    } else {
      setTab(nextTab);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof BookMarked }[] = [
    { id: 'programs', label: 'Programs', icon: BookMarked },
    { id: 'mine', label: 'My Templates', icon: User },
  ];

  return (
    <Layout
      title="Workout"
      rightAction={
        tab === 'build' && items.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {editingTemplateId && (
              <button
                onClick={() => setShowSave(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Save As
              </button>
            )}
            <button
              onClick={() => {
                if (editingTemplateId) {
                  handleSave();
                } else {
                  setShowSave(true);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                isDirty
                  ? 'bg-brand-500 text-white hover:bg-brand-600'
                  : 'text-gray-400 hover:text-gray-600 border border-gray-200'
              }`}
            >
              Save
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Tab bar — only shown when not in build mode */}
      {tab !== 'build' && (
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Programs tab */}
      {tab === 'programs' && <ProgramsBrowser onLoad={loadTemplate} />}

      {/* My Templates tab */}
      {tab === 'mine' && (
        <>
          <MyTemplates
            templates={templates}
            onLoad={loadTemplate}
            onDelete={onDeleteTemplate}
          />
          <div className="mt-4">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => { setName(''); setItems([]); setTab('build'); }}
            >
              <Plus size={16} /> Build from Scratch
            </Button>
          </div>
        </>
      )}

      {/* Build tab */}
      {tab === 'build' && (
        <>
          {/* Back link */}
          <button
            onClick={() => handleTabChange('programs')}
            className="text-sm text-brand-500 font-medium mb-4 flex items-center gap-1"
          >
            ← Back to programs
          </button>

          {/* Workout name */}
          <div className="mb-4">
            <Input
              placeholder="Workout name (e.g. Push Day)"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
            />
          </div>

          {/* Exercise list */}
          <div className="flex flex-col gap-3 mb-4">
            {items.map((item, idx) => {
              const exercise = exercises.find(e => e.id === item.exerciseId);
              if (!exercise) return null;
              return (
                <ExerciseRow
                  key={item.exerciseId}
                  item={item}
                  exercise={exercise}
                  onChange={updated => updateItem(idx, updated)}
                  onRemove={() => removeItem(idx)}
                />
              );
            })}
          </div>

          {/* Add exercise */}
          <Button variant="secondary" fullWidth onClick={() => setShowPicker(true)} className="mb-6">
            <Plus size={16} /> Add Exercise
          </Button>

          {/* Start button */}
          {items.length > 0 && (
            <Button fullWidth size="lg" onClick={() => {
              handleSave();
              onStart(name.trim() || 'My Workout', items);
            }}>
              Save &amp; Start
            </Button>
          )}
        </>
      )}

      {/* Exercise picker sheet */}
      {showPicker && (
        <ExercisePicker
          exercises={exercises}
          selected={selectedIds}
          onAdd={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Save template modal */}
      {showSave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-1">Save As New Template</h2>
            <p className="text-xs text-gray-400 mb-4">Creates a new template — existing one is unchanged.</p>
            <Input
              placeholder="New template name"
              value={saveNameInput || name}
              onChange={e => setSaveNameInput(e.target.value)}
              autoFocus
              onFocus={e => { const t = e.target; setTimeout(() => t.select(), 0); }}
            />
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" fullWidth onClick={() => { setShowSave(false); setSaveNameInput(''); }}>Cancel</Button>
              <Button fullWidth onClick={handleSaveAs}>Save As</Button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes prompt */}
      {showUnsavedPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-2">Unsaved workout</h2>
            <p className="text-sm text-gray-500 mb-5">
              You have {items.length} exercise{items.length !== 1 ? 's' : ''} in your current workout. Save it as a template first?
            </p>
            <div className="flex flex-col gap-2">
              <Button fullWidth onClick={() => {
                setShowUnsavedPrompt(false);
                setShowSave(true);
              }}>
                Save template
              </Button>
              <Button variant="secondary" fullWidth onClick={() => {
                setShowUnsavedPrompt(false);
                if (pendingTab) { setTab(pendingTab); setPendingTab(null); }
              }}>
                Discard &amp; leave
              </Button>
              <button
                onClick={() => { setShowUnsavedPrompt(false); setPendingTab(null); }}
                className="text-sm text-gray-400 py-1"
              >
                Stay here
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
