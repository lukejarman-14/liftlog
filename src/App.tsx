import { useState, useCallback } from 'react';
import { useStore } from './hooks/useStore';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/screens/Dashboard';
import { ExerciseLibrary } from './components/screens/ExerciseLibrary';
import { ExerciseDetail } from './components/screens/ExerciseDetail';
import { WorkoutBuilder } from './components/screens/WorkoutBuilder';
import { ActiveWorkout } from './components/screens/ActiveWorkout';
import { History } from './components/screens/History';
import { PlanBrowser } from './components/screens/PlanBrowser';
import { PlanDetail } from './components/screens/PlanDetail';
import { Onboarding } from './components/screens/Onboarding';
import { NavState, WorkoutExercise, WorkoutSession, UserProfile } from './types';

export default function App() {
  const store = useStore();
  const [nav, setNav] = useState<NavState>({ screen: 'dashboard' });
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);

  const navigate = useCallback((next: NavState) => setNav(next), []);

  const handleStartWorkout = (name: string, items: WorkoutExercise[]) => {
    const session: WorkoutSession = {
      id: `session-${Date.now()}`,
      name: name || 'Workout',
      exercises: items.map(item => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeight: item.targetWeight,
        restSeconds: item.restSeconds,
        sets: [],
      })),
      startTime: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };
    setActiveSession(session);
    setNav({ screen: 'active-workout' });
  };

  const handleUpdateSession = (session: WorkoutSession) => {
    setActiveSession(session);
  };

  const handleFinishWorkout = (session: WorkoutSession) => {
    store.saveSession(session);
    setActiveSession(null);
    setNav({ screen: 'dashboard' });
  };

  const handleOnboardingComplete = (profile: UserProfile, recommendedPlanId: string) => {
    store.setUserProfile(profile);
    if (recommendedPlanId) {
      const today = new Date();
      const day = today.getDay(); // 0=Sun, 1=Mon...
      const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
      const startDate = new Date(today);
      if (daysToMonday > 0) startDate.setDate(today.getDate() + daysToMonday);
      store.setActivePlan({ planId: recommendedPlanId, startDate: startDate.toISOString().split('T')[0] });
    }
    navigate({ screen: 'dashboard' });
  };

  // Show onboarding for new users who haven't completed it yet
  if (!store.userProfile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const { screen } = nav;

  return (
    <div className="min-h-screen bg-gray-50">
      {screen === 'dashboard' && (
        <Dashboard
          sessions={store.sessions}
          templates={store.templates}
          activePlan={store.activePlan}
          onNavigate={navigate}
        />
      )}

      {screen === 'exercise-library' && (
        <ExerciseLibrary
          exercises={store.exercises}
          onAddCustom={store.addCustomExercise}
          onDeleteCustom={store.deleteCustomExercise}
          onNavigate={navigate}
        />
      )}

      {screen === 'exercise-detail' && nav.exerciseId && (() => {
        const exercise = store.getExercise(nav.exerciseId);
        if (!exercise) return null;
        return (
          <ExerciseDetail
            exercise={exercise}
            sessions={store.sessions}
            onNavigate={navigate}
            onBack={() => setNav({ screen: 'exercise-library' })}
          />
        );
      })()}

      {screen === 'workout-builder' && (
        <WorkoutBuilder
          exercises={store.exercises}
          templates={store.templates}
          initialTemplateId={nav.templateId}
          onStart={handleStartWorkout}
          onSaveTemplate={store.saveTemplate}
          onDeleteTemplate={store.deleteTemplate}
        />
      )}

      {screen === 'active-workout' && activeSession && (
        <ActiveWorkout
          session={activeSession}
          onUpdateSession={handleUpdateSession}
          onFinish={handleFinishWorkout}
          onNavigate={navigate}
        />
      )}

      {screen === 'history' && (
        <History
          sessions={store.sessions}
          onNavigate={navigate}
          onDeleteSession={store.deleteSession}
        />
      )}

      {screen === 'plans' && (
        <PlanBrowser
          activePlan={store.activePlan}
          onSetActivePlan={store.setActivePlan}
          onNavigate={navigate}
        />
      )}

      {screen === 'plan-detail' && nav.planId && (
        <PlanDetail
          planId={nav.planId}
          activePlan={store.activePlan}
          onSetActivePlan={store.setActivePlan}
          onNavigate={navigate}
          onBack={() => navigate({ screen: 'plans' })}
        />
      )}

      <Navigation current={screen} onNavigate={s => navigate({ screen: s })} />
    </div>
  );
}
