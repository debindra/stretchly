import { useState, useMemo, useRef, useEffect } from 'react';
import type { Exercise } from '@stretchly/shared';
import { exercises } from '@stretchly/shared';
import { Clock, Plus, Check, AlertCircle, Play } from 'lucide-react';
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
    return selectedCategory === 'all'
      ? exercises
      : exercises.filter(ex => ex.category === selectedCategory);
  }, [selectedCategory]);

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
    <div className="space-y-6 pb-6">
      {/* Category Filter */}
      <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm min-h-[44px] cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-primary/5 active:scale-95'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Routine Builder */}
      {customRoutine.length > 0 && (
        <div className="bg-primary rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold mb-1">Custom Routine</h3>
              <p className="text-white/90 text-sm">
                {customRoutine.length} exercise{customRoutine.length !== 1 ? 's' : ''} • {totalDuration}s
              </p>
            </div>
            <button
              ref={launchButtonRef}
              onClick={() => setShowLaunchModal(true)}
              className="px-6 py-3 rounded-lg bg-accent text-accent-foreground hover:bg-accent active:scale-95 transition-all duration-200 shadow-md font-semibold"
            >
              Launch
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {customRoutine.map(ex => (
              <div
                key={ex.id}
                className="bg-white/20 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 font-medium"
              >
                {ex.name}
                <button
                  onClick={() => toggleExerciseInRoutine(ex)}
                  className="cursor-pointer hover:text-white hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 ml-1 active:scale-90"
                  aria-label={`Remove ${ex.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Launch Modal */}
      {showLaunchModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="launch-modal-title"
          onClick={() => setShowLaunchModal(false)}
        >
          <div
            className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-4 duration-300 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="launch-modal-title" className="text-xl text-foreground mb-4 font-bold">Rate your discomfort</h2>

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
                className="flex-1 bg-muted text-foreground py-3 rounded-lg hover:bg-primary/10 active:scale-95 transition-all duration-200 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={startCustomRoutine}
                className="flex-1 bg-accent text-accent-foreground py-3 rounded-lg hover:bg-accent active:scale-95 transition-all duration-200 shadow-lg font-semibold cursor-pointer"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Grid */}
      {filteredExercises.length > 0 && (
        <div className="text-sm text-muted-foreground mb-3">
          {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {filteredExercises.map(exercise => {
          const isSelected = isInCustomRoutine(exercise);

          return (
            <div
              key={exercise.id}
              className={`bg-card rounded-lg p-5 shadow-sm border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:bg-card/50 flex flex-col h-full ${
                isSelected
                  ? 'border-primary shadow-md'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              {/* Header - fixed at top */}
              <div className="flex items-start justify-between mb-4 shrink-0">
                <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium ">
                  {exercise.category}
                </span>
                <button
                  onClick={() => toggleExerciseInRoutine(exercise)}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 focus-subtle group cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:scale-110'
                      : 'bg-muted text-muted-foreground hover:bg-primary hover:text-white hover:scale-110 active:scale-95'
                  }`}
                  aria-label={isSelected ? `Remove ${exercise.name}` : `Add ${exercise.name}`}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 group-hover:text-white transition-colors" />}
                </button>
              </div>

              {/* Content area - grows to fill space */}
              <div className="grow flex flex-col">
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
                        <span className="text-primary font-semibold shrink-0">{idx + 1}.</span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>

              {/* Button - fixed at bottom */}
              <button
                onClick={(e) => {
                  previewOpenerRef.current = e.currentTarget;
                  setPreviewExercise(exercise.id);
                }}
                className="group w-full flex items-center justify-center gap-2 border border-primary text-primary bg-transparent hover:bg-primary group-hover:text-white hover:text-white active:scale-95 transition-all duration-200 font-medium px-4 py-2.5 rounded-md hover:shadow-md text-sm focus-prominent shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4 text-primary group-hover:text-white hover:text-white transition-colors" />
                <span className="group-hover:text-white transition-colors">Watch animation</span>
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
            No exercises in this category. Try selecting "All" or another category.
          </p>
        </div>
      )}


      {/* Exercise Animation Preview */}
      {previewExercise && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          onClick={() => setPreviewExercise(null)}
        >
          <div
            className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-4 duration-300 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="preview-modal-title" className="text-lg text-foreground font-bold">Preview</h2>
              <button
                ref={previewCloseRef}
                onClick={() => setPreviewExercise(null)}
                className="w-8 h-8 bg-muted rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary active:scale-95 transition-all text-lg text-foreground cursor-pointer"
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
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary-hover active:scale-95 transition-all duration-200 font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}