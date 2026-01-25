import { useState, useMemo, useRef, useEffect } from 'react';
import type { Exercise } from '@stretchly/shared';
import { exercises } from '@stretchly/shared';
import { Clock, Plus, Check, AlertCircle, Lightbulb, Play, Search, X } from 'lucide-react';
import { ExerciseAnimation } from './ExerciseAnimations';
import { PainScale } from './PainScale';

interface ExerciseLibraryProps {
  onStartRoutine: (exercises: Exercise[], painArea: string, painLevel: number) => void;
}

type Category = 'all' | 'neck' | 'shoulders' | 'back' | 'hips' | 'wrists' | 'eyes';

export function ExerciseLibrary({ onStartRoutine }: ExerciseLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [customRoutine, setCustomRoutine] = useState<Exercise[]>([]);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [painLevel, setPainLevel] = useState(5);
  const [previewExercise, setPreviewExercise] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const launchModalCancelRef = useRef<HTMLButtonElement>(null);
  const previewOpenerRef = useRef<HTMLElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'neck', label: 'Neck' },
    { key: 'shoulders', label: 'Shoulders' },
    { key: 'back', label: 'Back' },
    { key: 'hips', label: 'Hips' },
    { key: 'wrists', label: 'Wrists' },
    { key: 'eyes', label: 'Eyes' },
  ];

  const filteredExercises = useMemo(() => {
    let result = selectedCategory === 'all'
      ? exercises
      : exercises.filter(ex => ex.category === selectedCategory);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ex => 
        ex.name.toLowerCase().includes(query) ||
        ex.description.toLowerCase().includes(query) ||
        ex.instructions.some(inst => inst.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [selectedCategory, searchQuery]);

  const isInCustomRoutine = (exercise: Exercise) => {
    return customRoutine.some(ex => ex.id === exercise.id);
  };

  const toggleExerciseInRoutine = (exercise: Exercise) => {
    if (isInCustomRoutine(exercise)) {
      setCustomRoutine(customRoutine.filter(ex => ex.id !== exercise.id));
    } else {
      setCustomRoutine([...customRoutine, exercise]);
    }
  };

  const startCustomRoutine = () => {
    if (customRoutine.length > 0) {
      onStartRoutine(customRoutine, 'custom', painLevel);
      setCustomRoutine([]);
      setShowLaunchModal(false);
    }
  };

  const totalDuration = customRoutine.reduce((sum, ex) => sum + ex.duration, 0);

  useEffect(() => {
    if (!showLaunchModal) return;
    launchModalCancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowLaunchModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      launchButtonRef.current?.focus();
    };
  }, [showLaunchModal]);

  useEffect(() => {
    if (!previewExercise) return;
    previewCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPreviewExercise(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previewOpenerRef.current?.focus();
    };
  }, [previewExercise]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Search Bar - New */}
      <div className="bg-card rounded-xl p-4 md:p-5 shadow-sm border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter - Enhanced */}
      <div className="bg-card rounded-xl p-4 md:p-5 shadow-sm border border-border">
        <p className="text-foreground mb-3 md:mb-4 font-semibold text-sm">Browse by area</p>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => {
                setSelectedCategory(cat.key);
                setSearchQuery(''); // Clear search when changing category
              }}
              className={`px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm min-h-[44px] ${
                selectedCategory === cat.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-primary/10 active:scale-95'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Routine Builder - Enhanced */}
      {customRoutine.length > 0 && (
        <div className="bg-gradient-primary rounded-xl p-6 md:p-7 text-white shadow-lg border border-primary/30">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <h3 className="text-lg font-bold mb-1">Custom Routine</h3>
              <p className="text-white/90 text-sm">
                {customRoutine.length} exercise{customRoutine.length !== 1 ? 's' : ''} • ~
                {totalDuration}s total
              </p>
            </div>
            <button
              ref={launchButtonRef}
              onClick={() => setShowLaunchModal(true)}
              className="min-w-0 shrink-0 px-6 md:px-8 py-3 rounded-lg bg-accent text-accent-foreground hover:bg-accent active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg font-semibold text-sm"
            >
              Launch Routine
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {customRoutine.map(ex => (
              <div
                key={ex.id}
                className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm flex items-center gap-2 font-medium"
              >
                {ex.name}
                <button
                  onClick={() => toggleExerciseInRoutine(ex)}
                  className="hover:text-white/80 transition-colors ml-1"
                  aria-label={`Remove ${ex.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Launch Modal - Enhanced */}
      {showLaunchModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="launch-modal-title"
          onClick={() => setShowLaunchModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-4 duration-300 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="launch-modal-title" className="text-2xl text-foreground mb-2 font-bold">Ready to start?</h2>
            <p className="text-muted-foreground mb-6 text-base">
              Rate your current discomfort level before starting
            </p>

            <div className="mb-6">
              <PainScale
                id="library-pain-level"
                value={painLevel}
                onChange={setPainLevel}
                min={1}
                max={10}
                label="Discomfort level"
                variant="mild-severe"
              />
            </div>

            <div className="flex gap-3">
              <button
                ref={launchModalCancelRef}
                onClick={() => setShowLaunchModal(false)}
                className="flex-1 bg-muted text-muted-foreground py-4 rounded-lg hover:bg-primary/10 active:scale-95 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={startCustomRoutine}
                className="flex-1 bg-accent text-accent-foreground py-4 rounded-lg hover:bg-accent active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold"
              >
                Start Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Grid - Enhanced */}
      {filteredExercises.length > 0 && (
        <div className="text-sm text-muted-foreground mb-2">
          {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} found
          {searchQuery && ` for "${searchQuery}"`}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {filteredExercises.map(exercise => {
          const isSelected = isInCustomRoutine(exercise);

          return (
            <div
              key={exercise.id}
              className={`bg-card rounded-xl p-5 shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                isSelected
                  ? 'border-primary shadow-md'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  {exercise.category}
                </span>
                <button
                  onClick={() => toggleExerciseInRoutine(exercise)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-primary/10 active:scale-95'
                  }`}
                  aria-label={isSelected ? `Remove ${exercise.name}` : `Add ${exercise.name}`}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              <h3 className="text-foreground mb-2 text-base font-semibold">{exercise.name}</h3>
              <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{exercise.description}</p>

              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{exercise.duration}s</span>
              </div>

              <details className="mb-4">
                <summary className="text-primary text-sm cursor-pointer hover:text-primary-hover font-medium transition-colors">
                  View instructions
                </summary>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground pl-4">
                  {exercise.instructions.map((instruction, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-primary font-semibold flex-shrink-0">{idx + 1}.</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </details>

              <button
                onClick={(e) => {
                  previewOpenerRef.current = e.currentTarget;
                  setPreviewExercise(exercise.id);
                }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary-hover active:scale-95 transition-all duration-200 font-medium shadow-sm hover:shadow-md text-sm"
              >
                <Play className="w-4 h-4" />
                Watch animation
              </button>
            </div>
          );
        })}
      </div>

      {filteredExercises.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl p-8 border border-border">
          <AlertCircle className="w-12 h-12 text-disabled-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">No exercises found</p>
          <p className="text-muted-foreground text-sm">
            {searchQuery 
              ? `Try a different search term or clear the search to see all exercises.`
              : `No exercises in this category. Try selecting "All" or another category.`
            }
          </p>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              Clear search & show all
            </button>
          )}
        </div>
      )}

      {/* Info Banner */}
      {filteredExercises.length > 0 && (
        <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-foreground mb-2 font-semibold">Building Custom Routines</h3>
              <p className="text-muted-foreground text-sm">
                Select 2-4 exercises that target your specific needs. Keep total duration under 3
                minutes for best compliance. Mix and match areas for full-body relief sessions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Animation Preview - Compact */}
      {previewExercise && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          onClick={() => setPreviewExercise(null)}
        >
          <div
            className="bg-card rounded-xl p-5 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-4 duration-300 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="preview-modal-title" className="text-lg text-foreground font-bold">Exercise Preview</h2>
              <button
                ref={previewCloseRef}
                onClick={() => setPreviewExercise(null)}
                className="w-8 h-8 bg-muted rounded-full flex items-center justify-center hover:bg-primary/10 active:scale-95 transition-all text-lg text-foreground"
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            <div className="bg-muted rounded-lg p-4 mb-4">
              <ExerciseAnimation exerciseId={previewExercise} isPlaying={true} />
            </div>
            <button
              onClick={() => setPreviewExercise(null)}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary-hover active:scale-95 transition-all duration-200 font-semibold shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}