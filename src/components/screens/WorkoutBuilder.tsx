import { useState } from 'react';
import { Plus, Trash2, Search, GripVertical, ChevronDown, ChevronUp, Save, BookMarked, User } from 'lucide-react';
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
  'Olympic', 'Isometric', 'Plyometrics',
  'Speed & Agility', 'Eccentric', 'Conditioning', 'Testing',
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
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
        <div className="flex-1 overflow-y-auto px-4 pb-4">
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
  const [open, setOpen] = useState(true);

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
            value={item.targetSets}
            onChange={e => onChange({ ...item, targetSets: parseInt(e.target.value) || 1 })}
          />
          <Input
            label="Reps"
            type="number" min="1" max="100"
            value={item.targetReps}
            onChange={e => onChange({ ...item, targetReps: parseInt(e.target.value) || 1 })}
          />
          <Input
            label="Weight (kg)"
            type="number" min="0" step="0.5"
            value={item.targetWeight}
            onChange={e => onChange({ ...item, targetWeight: parseFloat(e.target.value) || 0 })}
          />
          <Input
            label="Rest (seconds)"
            type="number" min="0" step="5"
            value={item.restSeconds}
            onChange={e => onChange({ ...item, restSeconds: parseInt(e.target.value) || 0 })}
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
  const [openProgram, setOpenProgram] = useState<string | null>(FOOTBALL_PROGRAMS[0]?.name ?? null);

  const handleTabChange = (tab: ProgramTab) => {
    setProgramTab(tab);
    setOpenProgram(tab === 'football'
      ? FOOTBALL_PROGRAMS[0]?.name ?? null
      : BUILT_IN_PROGRAMS[0]?.name ?? null
    );
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

  const selectedIds = items.map(i => i.exerciseId);

  const loadTemplate = (t: { name: string; exercises: WorkoutExercise[] }) => {
    setName(t.name);
    setItems(t.exercises);
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

  const handleSaveTemplate = () => {
    const templateName = saveNameInput.trim() || name.trim() || 'My Workout';
    onSaveTemplate({
      id: initial?.id ?? `template-${Date.now()}`,
      name: templateName,
      exercises: items,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    setShowSave(false);
    setSaveNameInput('');
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
          <button
            onClick={() => setShowSave(true)}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Save as template"
          >
            <Save size={18} />
          </button>
        ) : undefined
      }
    >
      {/* Tab bar — only shown when not in build mode */}
      {tab !== 'build' && (
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
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
            onClick={() => setTab('programs')}
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
            <Button fullWidth size="lg" onClick={() => onStart(name.trim() || 'Workout', items)}>
              Start Workout
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-4">Save to My Templates</h2>
            <Input
              placeholder="Template name"
              value={saveNameInput || name}
              onChange={e => setSaveNameInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" fullWidth onClick={() => setShowSave(false)}>Cancel</Button>
              <Button fullWidth onClick={handleSaveTemplate}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
