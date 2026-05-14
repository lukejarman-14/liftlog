import { Dumbbell, BookOpen, Clock, History, LayoutDashboard, Map } from 'lucide-react';
import { Screen } from '../types';

interface NavigationProps {
  current: Screen;
  onNavigate: (screen: Screen) => void;
}

const navItems = [
  { screen: 'dashboard' as Screen, label: 'Home', icon: LayoutDashboard },
  { screen: 'plans' as Screen, label: 'Plans', icon: Map },
  { screen: 'workout-builder' as Screen, label: 'Quick Workout', icon: Dumbbell },
  { screen: 'exercise-library' as Screen, label: 'Exercises', icon: BookOpen },
  { screen: 'history' as Screen, label: 'History & Tests', icon: History },
];

export function Navigation({ current, onNavigate }: NavigationProps) {
  const isActive = (screen: Screen) =>
    current === screen ||
    (screen === 'workout-builder' && current === 'active-workout') ||
    (screen === 'exercise-library' && current === 'exercise-detail') ||
    (screen === 'plans' && current === 'plan-detail');

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-pb z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(({ screen, label, icon: Icon }) => (
          <button
            key={screen}
            onClick={() => onNavigate(screen)}
            aria-label={label}
            aria-current={isActive(screen) ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              isActive(screen)
                ? 'text-brand-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={22} strokeWidth={isActive(screen) ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function TimerBadge({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-50 flex items-center gap-1.5 bg-brand-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg animate-pulse"
    >
      <Clock size={14} />
      {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
    </button>
  );
}
