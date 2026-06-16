import { Dumbbell, History, LayoutDashboard, Map, User } from 'lucide-react';
import { Screen } from '../types';

interface NavigationProps {
  current: Screen;
  onNavigate: (screen: Screen) => void;
}

const navItems = [
  { screen: 'dashboard' as Screen, label: 'Home', icon: LayoutDashboard },
  { screen: 'plans' as Screen, label: 'Plans', icon: Map },
  { screen: 'workout-builder' as Screen, label: 'Workouts', icon: Dumbbell },
  { screen: 'history' as Screen, label: 'History', icon: History },
  { screen: 'profile' as Screen, label: 'Profile', icon: User },
];

export function Navigation({ current, onNavigate }: NavigationProps) {
  const isActive = (screen: Screen) =>
    current === screen ||
    (screen === 'workout-builder' && current === 'active-workout') ||
    (screen === 'workout-builder' && current === 'exercise-detail') ||
    (screen === 'plans' && current === 'plan-detail');

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 safe-area-pb z-50">
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
                : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
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
