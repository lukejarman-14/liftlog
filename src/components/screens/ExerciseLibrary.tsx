import { useState } from 'react';
import { Search, Plus, Trash2, ChevronRight } from 'lucide-react';
import { Layout } from '../Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Exercise, ExerciseCategory, NavState } from '../../types';
import { CATEGORY_COLORS, DEFAULT_EXERCISES } from '../../data/exercises';

const CATEGORIES: ExerciseCategory[] = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body',
  'Isometric', 'Plyometrics',
  'Speed', 'Agility', 'Eccentric', 'Conditioning', 'Testing',
];

interface ExerciseLibraryProps {
  exercises: Exercise[];
  onAddCustom: (ex: Exercise) => void;
  onDeleteCustom: (id: string) => void;
  onNavigate: (nav: NavState) => void;
}

function AddExerciseModal({ onAdd, onClose }: {
  onAdd: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('Chest');
  const [rest, setRest] = useState('90');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      category,
      defaultRestSeconds: parseInt(rest) || 90,
      muscleGroups: [],
      isCustom: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add Custom Exercise</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Exercise Name"
            placeholder="e.g. Cable Lateral Raise"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as ExerciseCategory)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body', 'Isometric', 'Plyometrics', 'Speed', 'Agility', 'Eccentric', 'Conditioning', 'Testing'] as ExerciseCategory[]).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <Input
            label="Default Rest (seconds)"
            type="number"
            min="0"
            max="600"
            value={rest}
            onChange={e => setRest(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose} type="button">Cancel</Button>
            <Button fullWidth type="submit">Add Exercise</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExerciseLibrary({ exercises, onAddCustom, onDeleteCustom, onNavigate }: ExerciseLibraryProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | 'All'>('All');
  const [showAdd, setShowAdd] = useState(false);

  const defaultIds = new Set(DEFAULT_EXERCISES.map(e => e.id));

  const filtered = exercises.filter(ex => {
    const matchesQuery = ex.name.toLowerCase().includes(query.toLowerCase()) ||
      ex.muscleGroups.some(m => m.toLowerCase().includes(query.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || ex.category === activeCategory || ex.secondaryCategory === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <Layout
      title="Exercise Library"
      rightAction={
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add
        </Button>
      }
    >
      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search exercises or muscles..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {(['All', ...CATEGORIES] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No exercises found.</div>
        )}
        {filtered.map(ex => (
          <Card
            key={ex.id}
            className="p-3 flex items-center gap-3"
            onClick={() => onNavigate({ screen: 'exercise-detail', exerciseId: ex.id })}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{ex.name}</span>
                {ex.isCustom && (
                  <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">Custom</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[ex.category]}`}>
                  {ex.category}
                </span>
                {ex.secondaryCategory && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[ex.secondaryCategory]}`}>
                    {ex.secondaryCategory}
                  </span>
                )}
                {ex.suggestedRir !== undefined && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium flex-shrink-0">
                    {ex.suggestedRir} RIR
                  </span>
                )}
                {ex.muscleGroups.length > 0 && (
                  <span className="text-xs text-gray-400 truncate">{ex.muscleGroups.slice(0, 2).join(', ')}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ex.isCustom && !defaultIds.has(ex.id) && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteCustom(ex.id); }}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </Card>
        ))}
      </div>

      {showAdd && (
        <AddExerciseModal onAdd={onAddCustom} onClose={() => setShowAdd(false)} />
      )}
    </Layout>
  );
}
