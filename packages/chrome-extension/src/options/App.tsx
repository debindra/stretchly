import { useState, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Exercise, ReliefEntry, SavedRoutine, UserSettings, View } from '@stretchly/shared';
import { DEFAULT_SETTINGS } from '@stretchly/shared';
import { chromeStorageAdapter, getSavedRoutines, setSavedRoutines } from '../storage/chromeStorage';
import { Dashboard } from './components/Dashboard';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { RoutinePlayer } from './components/RoutinePlayer';
import { ProgressTracker } from './components/ProgressTracker';
import { Settings } from './components/Settings';
import { LogoImg } from '../components/LogoImg';
import { applyTheme, onSystemModeChange } from '../utils/themes';
import { toDateKey } from './utils/formatDate';
import { parseOptionsHash } from '../utils/painAreas';
import { localeFromSetting, setLocale, t, type MessageKey } from '../i18n';
import { LocaleContext } from '../i18n/react';

const storage = chromeStorageAdapter;

const NAV: { view: View; label: MessageKey }[] = [
  { view: 'dashboard', label: 'nav.relief' },
  { view: 'library', label: 'nav.library' },
  { view: 'progress', label: 'nav.progress' },
  { view: 'settings', label: 'nav.settings' },
];
const VIEWS = NAV.map((n) => n.view);

function viewFromHash(): View {
  const { view } = parseOptionsHash(window.location.hash);
  return VIEWS.includes(view as View) ? (view as View) : 'dashboard';
}

interface ActiveRoutine {
  exercises: Exercise[];
  painArea: string;
  beforePain: number;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>(viewFromHash);
  const [routine, setRoutine] = useState<ActiveRoutine | null>(null);
  const [reliefData, setReliefData] = useState<ReliefEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  const [savedRoutines, setSavedRoutinesState] = useState<SavedRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped when the URL hash changes from outside (popup, notification), so views re-read it.
  const [hashNav, setHashNav] = useState(0);

  // Set before children render, so every `t()` below uses the chosen language.
  const locale = localeFromSetting(settings.language);
  setLocale(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [relief, s, routines] = await Promise.all([storage.getRelief(), storage.getSettings(), getSavedRoutines()]);
      setReliefData(relief);
      setSettings(s);
      setSavedRoutinesState(routines);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : t('app.storageNoResponse'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading) return;
    storage.setRelief(reliefData).catch((err) => console.error('Error saving relief data:', err));
  }, [reliefData, loading]);

  useEffect(() => {
    if (loading) return;
    storage.setSettings(settings).catch((err) => console.error('Error saving settings:', err));
  }, [settings, loading]);

  useEffect(() => {
    if (loading) return;
    setSavedRoutines(savedRoutines).catch((err) => console.error('Error saving routines:', err));
  }, [savedRoutines, loading]);

  useEffect(() => {
    if (loading) return;
    applyTheme(settings.theme, settings.colorMode);
    if (settings.colorMode !== 'system') return;
    return onSystemModeChange(() => applyTheme(settings.theme, settings.colorMode));
  }, [settings.theme, settings.colorMode, loading]);

  // The popup and reminder notifications reuse an open tab by changing its hash.
  useEffect(() => {
    const onHashChange = () => {
      setCurrentView(viewFromHash());
      setHashNav((n) => n + 1);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Functional update so rapid successive changes never overwrite each other.
  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const navigateTo = useCallback((v: View) => {
    setCurrentView(v);
    window.history.replaceState(null, '', `#${v}`);
    window.scrollTo(0, 0);
  }, []);

  // Alt+1–4 jumps between sections from anywhere.
  useEffect(() => {
    if (loading || routine) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < VIEWS.length) {
        e.preventDefault();
        navigateTo(VIEWS[idx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, routine, navigateTo]);

  // Arrow keys move between tabs only while the tab bar has focus (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e: ReactKeyboardEvent) => {
    const idx = VIEWS.indexOf(currentView);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % VIEWS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + VIEWS.length) % VIEWS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = VIEWS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    navigateTo(VIEWS[next]);
    document.getElementById(`${VIEWS[next]}-tab`)?.focus();
  };

  const startRoutine = useCallback((exercises: Exercise[], painArea: string, beforePain: number) => {
    setRoutine({ exercises, painArea, beforePain });
  }, []);

  const completeRoutine = useCallback(
    (afterPain: number, rated: boolean) => {
      if (!routine) return;
      const now = new Date();
      setReliefData((prev) => [
        ...prev,
        {
          date: toDateKey(now),
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          painArea: routine.painArea,
          beforePain: routine.beforePain,
          afterPain: rated ? afterPain : routine.beforePain,
          exerciseIds: routine.exercises.map((ex) => ex.id),
          ...(rated ? {} : { rated: false }),
        },
      ]);
      setRoutine(null);
      navigateTo('dashboard');
    },
    [routine, navigateTo]
  );

  const handleClearRelief = useCallback(async () => {
    await storage.clearRelief();
    setReliefData([]);
  }, []);

  const handleImportRelief = useCallback((entries: ReliefEntry[]) => setReliefData(entries), []);

  const saveRoutine = useCallback((name: string, exerciseIds: string[]) => {
    setSavedRoutinesState((prev) => [...prev, { id: `r${Date.now().toString(36)}`, name, exerciseIds }]);
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setSavedRoutinesState((prev) => prev.filter((r) => r.id !== id));
  }, []);

  if (loading) {
    // Storage resolves in a few ms; a blank page beats a spinner that flashes.
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h1 className="text-lg font-semibold">{t('app.loadError')}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            void loadData();
          }}
          className="mt-5 rounded-md border border-border bg-card px-3.5 py-1.5 text-sm font-medium hover:bg-muted"
        >
          {t('app.tryAgain')}
        </button>
      </div>
    );
  }

  if (routine) {
    return (
      <LocaleContext.Provider value={locale}>
        <RoutinePlayer
          exercises={routine.exercises}
          painArea={routine.painArea}
          beforePainLevel={routine.beforePain}
          soundCues={settings.soundCues}
          firstRun={reliefData.length === 0}
          onComplete={completeRoutine}
          onCancel={() => setRoutine(null)}
        />
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 px-4 sm:px-6">
            <LogoImg height={22} className="py-3" />
            <nav
              role="tablist"
              aria-label={t('nav.sections')}
              onKeyDown={onTabKeyDown}
              className="-mb-px flex w-full gap-6 overflow-x-auto sm:ml-auto sm:w-auto"
            >
              {NAV.map(({ view, label }, i) => {
                const selected = currentView === view;
                return (
                  <button
                    key={view}
                    id={`${view}-tab`}
                    role="tab"
                    aria-selected={selected}
                    aria-controls="main-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => navigateTo(view)}
                    title={t('nav.tabTitle', { label: t(label), n: i + 1 })}
                    className={`whitespace-nowrap border-b-2 px-0.5 py-3 text-sm transition-colors ${
                      selected
                        ? 'border-primary font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(label)}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <main
          id="main-panel"
          role="tabpanel"
          aria-labelledby={`${currentView}-tab`}
          key={currentView}
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
        >
          {currentView === 'dashboard' && (
            <Dashboard
              key={hashNav}
              reliefData={reliefData}
              remindersEnabled={settings.remindersEnabled}
              onStartRoutine={startRoutine}
              onOpenSettings={() => navigateTo('settings')}
            />
          )}
          {currentView === 'library' && (
            <ExerciseLibrary
              savedRoutines={savedRoutines}
              onStartRoutine={startRoutine}
              onSaveRoutine={saveRoutine}
              onDeleteRoutine={deleteRoutine}
            />
          )}
          {currentView === 'progress' && (
            <ProgressTracker reliefData={reliefData} onNavigateToDashboard={() => navigateTo('dashboard')} />
          )}
          {currentView === 'settings' && (
            <Settings
              settings={settings}
              reliefData={reliefData}
              onUpdateSettings={updateSettings}
              onClearRelief={handleClearRelief}
              onImportRelief={handleImportRelief}
            />
          )}
        </main>
      </div>
    </LocaleContext.Provider>
  );
}
