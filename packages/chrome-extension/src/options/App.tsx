import { useState, useEffect, useCallback } from 'react';
import type { Exercise, ReliefEntry, UserSettings, View } from '@stretchly/shared';
import { DEFAULT_SETTINGS } from '@stretchly/shared';
import { chromeStorageAdapter } from '../storage/chromeStorage';
import { Dashboard } from './components/Dashboard';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { RoutinePlayer } from './components/RoutinePlayer';
import { ProgressTracker } from './components/ProgressTracker';
import { Settings } from './components/Settings';
import { Activity, Library, TrendingUp, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { LogoImg } from '../components/LogoImg';
import { applyTheme } from '../utils/themes';

const storage = chromeStorageAdapter;

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [activeExercises, setActiveExercises] = useState<Exercise[]>([]);
  const [activePainArea, setActivePainArea] = useState<string>('');
  const [beforePainLevel, setBeforePainLevel] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reliefData, setReliefData] = useState<ReliefEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [relief, s] = await Promise.all([
        storage.getRelief(),
        storage.getSettings(),
      ]);
      setReliefData(relief);
      setSettings(s);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading) return;
    storage.setRelief(reliefData).catch((err) => {
      console.error('Error saving relief data:', err);
    });
  }, [reliefData, loading]);

  useEffect(() => {
    if (loading) return;
    storage.setSettings(settings).catch((err) => {
      console.error('Error saving settings:', err);
    });
  }, [settings, loading]);

  // Apply theme when settings change or on initial load
  useEffect(() => {
    if (loading) return;
    applyTheme(settings.theme);
  }, [settings.theme, loading]);

  // Hash routing: initial view from #dashboard, #library, etc.
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.slice(1).toLowerCase().replace(/^#/, '');
    const views: View[] = ['dashboard', 'library', 'progress', 'settings'];
    if (hash && views.includes(hash as View)) setCurrentView(hash as View);
  }, [loading]);

  // Prevent automatic scrolling when hash changes
  useEffect(() => {
    const handleHashChange = () => {
      // Prevent scroll to top when hash changes
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = useCallback((v: View) => {
    setCurrentView(v);
    // Use replaceState to prevent scroll restoration
    const url = new URL(window.location.href);
    url.hash = v;
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Keyboard navigation: Alt+1–4 and Arrow Left/Right
  useEffect(() => {
    if (loading || isPlaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const views: View[] = ['dashboard', 'library', 'progress', 'settings'];
      const currentIndex = views.indexOf(currentView);

      if (e.altKey && !e.ctrlKey && !e.metaKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < views.length) navigateTo(views[idx]);
        return;
      }
      if (e.ctrlKey || e.metaKey) return;

      if (e.key === 'ArrowRight' && currentIndex < views.length - 1) {
        e.preventDefault();
        navigateTo(views[currentIndex + 1]);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        navigateTo(views[currentIndex - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, loading, isPlaying, navigateTo]);

  const startRoutine = useCallback(
    (exercises: Exercise[], painArea: string, painLevel: number) => {
      setActiveExercises(exercises);
      setActivePainArea(painArea);
      setBeforePainLevel(painLevel);
      setIsPlaying(true);
    },
    []
  );

  const completeRoutine = useCallback(
    (afterPainLevel: number) => {
      const today = new Date().toISOString().split('T')[0];
      const newEntry: ReliefEntry = {
        date: today,
        painArea: activePainArea,
        beforePain: beforePainLevel,
        afterPain: afterPainLevel,
        exerciseIds: activeExercises.map((ex) => ex.id),
      };
      setReliefData((prev) => [...prev, newEntry]);
      setIsPlaying(false);
      setCurrentView('dashboard');
    },
    [activePainArea, beforePainLevel, activeExercises]
  );

  const cancelRoutine = useCallback(() => {
    setIsPlaying(false);
    setActiveExercises([]);
    setActivePainArea('');
    setBeforePainLevel(0);
  }, []);

  const handleClearRelief = useCallback(async () => {
    await storage.clearRelief();
    setReliefData([]);
    window.location.reload();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-muted-foreground font-medium">Loading…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => { setLoading(true); void loadData(); }}
              className="px-6 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent transition-colors font-medium"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-primary/10 transition-colors font-medium border border-border"
            >
              Refresh page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <RoutinePlayer
        exercises={activeExercises}
        painArea={activePainArea}
        beforePainLevel={beforePainLevel}
        onComplete={completeRoutine}
        onCancel={cancelRoutine}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="max-w-5xl mx-auto px-3 md:px-4 py-3 md:py-4 h-screen flex flex-col overflow-hidden">
        <header className="mb-2 md:mb-3 flex-shrink-0">
          <LogoImg height={28} maxWidth={160} className="mb-1" />
          <p className="text-muted-foreground text-xs font-medium hidden md:block">
            Instant relief for desk workers — in under 2 minutes
          </p>
        </header>

        <nav 
          className="bg-card rounded-lg shadow-sm border border-border mb-3 md:mb-4 px-1 py-1 flex gap-1 flex-shrink-0" 
          role="tablist" 
          aria-label="Main navigation"
        >
          <button
            id="dashboard-tab"
            onClick={() => navigateTo('dashboard')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateTo('dashboard');
              }
            }}
            role="tab"
            tabIndex={currentView === 'dashboard' ? 0 : -1}
            aria-selected={currentView === 'dashboard'}
            aria-controls="dashboard-panel"
            className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 rounded-lg transition-all duration-200 ease-in-out flex-1 relative min-h-[44px] cursor-pointer ${
              currentView === 'dashboard'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
            } focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            aria-label="Relief Now"
            title="Relief Now (Alt+1)"
          >
            <Activity className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium hidden sm:inline uppercase">Relief</span>
          </button>
          <button
            id="library-tab"
            onClick={() => navigateTo('library')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateTo('library');
              }
            }}
            role="tab"
            tabIndex={currentView === 'library' ? 0 : -1}
            aria-selected={currentView === 'library'}
            aria-controls="library-panel"
            className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 rounded-lg transition-all duration-200 ease-in-out flex-1 relative min-h-[44px] cursor-pointer ${
              currentView === 'library'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
            } focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            aria-label="Exercise Library"
            title="Exercise Library (Alt+2)"
          >
            <Library className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium hidden sm:inline uppercase">Library</span>
          </button>
          <button
            id="progress-tab"
            onClick={() => navigateTo('progress')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateTo('progress');
              }
            }}
            role="tab"
            tabIndex={currentView === 'progress' ? 0 : -1}
            aria-selected={currentView === 'progress'}
            aria-controls="progress-panel"
            className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 rounded-lg transition-all duration-200 ease-in-out flex-1 relative min-h-[44px] cursor-pointer ${
              currentView === 'progress'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
            } focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            aria-label="Relief Stats"
            title="Relief Stats (Alt+3)"
          >
            <TrendingUp className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium hidden sm:inline uppercase">Stats</span>
          </button>
          <button
            id="settings-tab"
            onClick={() => navigateTo('settings')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateTo('settings');
              }
            }}
            role="tab"
            tabIndex={currentView === 'settings' ? 0 : -1}
            aria-selected={currentView === 'settings'}
            aria-controls="settings-panel"
            className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 rounded-lg transition-all duration-200 ease-in-out flex-1 relative min-h-[44px] cursor-pointer ${
              currentView === 'settings'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
            } focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            aria-label="Settings"
            title="Settings (Alt+4)"
          >
            <SettingsIcon className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium hidden sm:inline uppercase">Settings</span>
          </button>
        </nav>

        <main 
          className="flex-1 min-h-0 px-1 overflow-y-auto" 
          role="tabpanel"
          id={`${currentView}-panel`}
          aria-labelledby={`${currentView}-tab`}
        >
          {currentView === 'dashboard' && (
            <Dashboard
              onStartRoutine={startRoutine}
              reliefData={reliefData}
              settings={settings}
            />
          )}
          {currentView === 'library' && (
            <ExerciseLibrary onStartRoutine={startRoutine} />
          )}
          {currentView === 'progress' && (
            <ProgressTracker
              reliefData={reliefData}
              onNavigateToDashboard={() => navigateTo('dashboard')}
            />
          )}
          {currentView === 'settings' && (
            <Settings
              settings={settings}
              onUpdateSettings={setSettings}
              onClearRelief={handleClearRelief}
            />
          )}
        </main>
      </div>
    </div>
  );
}
