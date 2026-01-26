import { useState, useEffect } from 'react';
import type { Exercise } from '@stretchly/shared';
import { Play, Pause, SkipForward, SkipBack, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { ExerciseAnimation } from './ExerciseAnimations';
import { PainScale } from './PainScale';
import { formatPainArea } from '../utils/formatDate';

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(m.matches);
    const onChange = () => setPrefers(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);
  return prefers;
}

interface RoutinePlayerProps {
  exercises: Exercise[];
  painArea: string;
  beforePainLevel: number;
  onComplete: (afterPainLevel: number) => void;
  onCancel: () => void;
}

export function RoutinePlayer({
  exercises,
  painArea,
  beforePainLevel,
  onComplete,
  onCancel,
}: RoutinePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [afterPainLevel, setAfterPainLevel] = useState(beforePainLevel);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const currentExercise = exercises[currentIndex];
  const duration = currentExercise?.duration ?? 0;
  const timeRemaining = Math.max(0, duration - elapsed);

  useEffect(() => {
    if (!isPlaying || isFinished || duration === 0) return;
    const interval = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= duration) {
          if (currentIndex < exercises.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          }
          setIsFinished(true);
          return next;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isFinished, currentIndex, duration, exercises.length]);

  useEffect(() => {
    setElapsed(0);
  }, [currentIndex]);

  const togglePlayPause = () => {
    setIsPlaying((p) => !p);
  };

  const skipToNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((i) => i + 1);
      setElapsed(0);
    } else {
      setIsFinished(true);
    }
  };

  const skipToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setElapsed(0);
    }
  };

  const resetCurrentExercise = () => {
    setElapsed(0);
  };

  const handleCancelClick = () => {
    if (currentIndex > 0) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    onCancel();
  };

  const handleComplete = () => {
    onComplete(afterPainLevel);
  };

  if (isFinished) {
    const relief = beforePainLevel - afterPainLevel;

    return (
      <div className="h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-xl p-6 max-w-sm w-full text-center shadow-xl border border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl text-foreground mb-2 font-bold">How do you feel now?</h2>
          <p className="text-muted-foreground mb-4 text-sm">Rate your {formatPainArea(painArea)} pain level</p>

          <div className="mb-5 text-left">
            <PainScale
              id="routine-after-pain"
              value={afterPainLevel}
              onChange={setAfterPainLevel}
              min={0}
              max={10}
              label="After"
              variant="before-after"
              beforeValue={beforePainLevel}
            />
          </div>

          {relief > 0 && (
            <div className="mb-5 p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg flex items-center justify-center gap-2 border border-primary/20">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <p className="text-primary font-semibold text-sm">
                {relief} point{relief !== 1 ? 's' : ''} of relief!
              </p>
            </div>
          )}

          <button
            onClick={handleComplete}
            className="w-full bg-accent text-accent-foreground py-3 rounded-lg hover:bg-accent active:scale-[0.98] transition-all duration-200 shadow-lg font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = duration > 0 ? (timeRemaining / duration) * 100 : 0;

  return (
    <div className="h-screen bg-background p-3 md:p-4 flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex flex-col flex-1">
        {/* Progress bar + cancel - Enhanced */}
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-1 flex-1">
            {exercises.map((_, idx) => {
              const isDone = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div
                  key={idx}
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    isDone ? 'bg-primary h-1.5' : isCurrent ? 'bg-primary/60 h-1.5' : 'bg-muted h-1'
                  }`}
                  title={isCurrent ? `Exercise ${idx + 1} of ${exercises.length}` : isDone ? `Completed` : `Upcoming`}
                />
              );
            })}
          </div>
          <button
            onClick={handleCancelClick}
            className="w-9 h-9 md:w-10 md:h-10 bg-background/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-background transition-all ml-3 border border-border shadow-sm active:scale-95 text-muted-foreground hover:text-foreground"
            aria-label="Cancel routine"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full shadow-xl border border-border animate-in slide-in-from-bottom-4 duration-300">
              <h2 id="cancel-dialog-title" className="text-lg font-bold text-foreground mb-2">Exit routine?</h2>
              <p className="text-muted-foreground text-sm mb-4">Progress on this session will be lost. You can start again anytime.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 bg-muted text-foreground rounded-lg hover:bg-primary/10 active:scale-95 transition-all font-medium"
                >
                  Keep going
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 active:scale-95 transition-all font-semibold"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Exercise Card - Enhanced Layout */}
        <div className="bg-card rounded-xl p-4 md:p-6 shadow-lg border border-border flex-1 flex flex-col min-h-0">
          {/* Exercise Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {currentExercise.category}
              </span>
              <span className="text-disabled-foreground text-xs">
                {currentIndex + 1} of {exercises.length}
              </span>
            </div>
            <h1 className="text-foreground text-xl md:text-2xl font-bold leading-tight mb-1">{currentExercise.name}</h1>
            <p className="text-muted-foreground text-sm md:text-base leading-snug">{currentExercise.description}</p>
          </div>

          {/* Animation - Full Width */}
          <div className="bg-muted rounded-lg p-4 md:p-6 mb-4 flex items-center justify-center min-h-[200px] md:min-h-[280px]">
            <ExerciseAnimation exerciseId={currentExercise.id} isPlaying={isPlaying} />
          </div>

          {/* Timer - Linear Progress Bar + Large Number */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm font-medium">Time remaining</span>
              <span className="text-3xl md:text-4xl font-bold text-primary">{timeRemaining}</span>
            </div>
            <div
              className="w-full h-3 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={timeRemaining}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-label="Time remaining in current exercise"
            >
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span>{duration}s total</span>
              <span className={timeRemaining <= 10 ? 'text-red-400 font-semibold' : ''} style={timeRemaining <= 10 && !prefersReducedMotion ? { animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' } : undefined}>
                {timeRemaining <= 10 ? 'Almost done!' : ''}
              </span>
            </div>
          </div>

          {/* Controls - Enhanced */}
          <div className="flex items-center justify-center gap-3 md:gap-4">
            {currentIndex > 0 && (
              <button
                onClick={skipToPrevious}
                className="w-12 h-12 md:w-14 md:h-14 bg-background text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all shadow-sm border border-border hover:text-foreground"
                aria-label="Previous exercise"
              >
                <SkipBack className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}
            <button
              onClick={togglePlayPause}
              className="w-16 h-16 md:w-20 md:h-20 bg-accent text-accent-foreground rounded-full flex items-center justify-center hover:bg-accent active:scale-95 transition-all shadow-lg hover:shadow-xl"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 md:w-8 md:h-8" />
              ) : (
                <Play className="w-7 h-7 md:w-8 md:h-8 ml-1" />
              )}
            </button>
            {currentIndex < exercises.length - 1 ? (
              <button
                onClick={skipToNext}
                className="w-12 h-12 md:w-14 md:h-14 bg-background text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all shadow-sm border border-border hover:text-foreground"
                aria-label="Next exercise"
              >
                <SkipForward className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            ) : (
              <button
                onClick={resetCurrentExercise}
                className="w-12 h-12 md:w-14 md:h-14 bg-background text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-all shadow-sm border border-border hover:text-foreground"
                aria-label="Reset timer"
                title="Reset current exercise timer"
              >
                <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}
          </div>

          {/* Instructions - Step by step cards */}
          <div className="mt-4 md:mt-6">
            <h3 className="text-foreground text-sm md:text-base font-semibold mb-3">Step-by-step instructions</h3>
            <div className="space-y-2.5 max-h-[200px] md:max-h-[240px] pr-2">
              {currentExercise.instructions.map((instruction, idx) => (
                <div 
                  key={idx} 
                  className="bg-muted rounded-lg p-3 border border-border hover:bg-primary/5 transition-colors"
                >
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-foreground text-sm leading-relaxed">{instruction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}