import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useAnimationFrame, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import type { Exercise } from '@stretchly/shared';
import { localizeExercise } from '@stretchly/shared';
import { Play, Pause, SkipForward, SkipBack, X, Check } from 'lucide-react';
import { ExerciseAnimation } from './ExerciseAnimations';
import { categoryLabel } from './ExerciseLibrary';
import { PainScale } from './PainScale';
import { Modal } from './Modal';
import { formatPainArea, formatSeconds } from '../utils/formatDate';
import { chime } from '../../utils/chime';
import { isPainArea } from '../../utils/painAreas';
import { formatList, t, tp } from '../../i18n';
import { useLocale } from '../../i18n/react';

interface RoutinePlayerProps {
  exercises: Exercise[];
  painArea: string;
  beforePainLevel: number;
  /** Play a soft chime at each exercise and cue change. */
  soundCues: boolean;
  /** First routine ever: hide the queue, shortcuts and rating skip so there is less to take in. */
  firstRun?: boolean;
  /** `rated` is false when the user skipped the after-rating. */
  onComplete: (afterPainLevel: number, rated: boolean) => void;
  onCancel: () => void;
}

/** Seconds elapsed in the current exercise; advances every frame while `running`. */
function useExerciseClock(running: boolean): MotionValue<number> {
  const clock = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (running) clock.set(clock.get() + Math.min(delta, 100) / 1000);
  });
  return clock;
}

const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Countdown in the frame corner; re-renders only when the whole second changes. */
function Countdown({ clock, duration, name }: { clock: MotionValue<number>; duration: number; name: string }) {
  const left = (v: number) => Math.max(0, Math.ceil(duration - v));
  const [remaining, setRemaining] = useState(() => left(clock.get()));
  useMotionValueEvent(clock, 'change', (v) => setRemaining(left(v)));
  // Visible from other tabs, so you can glance at how long is left.
  useEffect(() => {
    document.title = `${formatClock(remaining)} · ${name}`;
  }, [remaining, name]);
  return (
    <span
      className="absolute right-3 top-3 text-sm tabular-nums text-muted-foreground"
      role="timer"
      aria-label={tp('player.secondsRemaining', remaining)}
    >
      {formatClock(remaining)}
    </span>
  );
}

/** For exercises without an animation: the instruction that matches the elapsed time, shown large. */
function StepText({ clock, duration, steps }: { clock: MotionValue<number>; duration: number; steps: string[] }) {
  const stepAt = (v: number) => Math.min(steps.length - 1, Math.floor((v / (duration || 1)) * steps.length));
  const [step, setStep] = useState(() => stepAt(clock.get()));
  useMotionValueEvent(clock, 'change', (v) => setStep(stepAt(v)));
  return (
    <div className="px-8 text-center">
      <p className="text-xs tabular-nums text-muted-foreground">
        {t('player.step', { n: step + 1, total: steps.length })}
      </p>
      <p className="mt-2 text-xl font-medium leading-snug">{steps[step]}</p>
    </div>
  );
}

/** Header segment for the exercise in progress. */
function CurrentBar({ clock, duration }: { clock: MotionValue<number>; duration: number }) {
  const width = useTransform(clock, (v) => `${duration ? Math.min(1, v / duration) * 100 : 0}%`);
  return <motion.div className="h-full bg-primary" style={{ width }} />;
}

const secondaryButton =
  'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted';

export function RoutinePlayer({
  exercises: given,
  painArea,
  beforePainLevel,
  soundCues,
  firstRun = false,
  onComplete,
  onCancel,
}: RoutinePlayerProps) {
  const locale = useLocale();
  const exercises = useMemo(() => given.map((ex) => localizeExercise(ex, locale)), [given, locale]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  /** Set when the routine paused itself because the tab was hidden. */
  const [pausedAway, setPausedAway] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [afterPain, setAfterPain] = useState(beforePainLevel);
  const [confirmExit, setConfirmExit] = useState(false);

  const exercise = exercises[index];
  const duration = exercise?.duration ?? 0;
  const clock = useExerciseClock(isPlaying && !isFinished && !confirmExit);
  const isLast = index === exercises.length - 1;

  const goTo = useCallback(
    (i: number) => {
      if (i >= exercises.length) {
        setIsFinished(true);
        return;
      }
      setIndex(Math.max(0, i));
      clock.set(0);
    },
    [exercises.length, clock]
  );

  // Restore the page title when the player closes.
  useEffect(() => {
    const title = document.title;
    return () => {
      document.title = title;
    };
  }, []);

  // Animation frames stop in background tabs, which would freeze the timer without saying so.
  // Pause explicitly instead, and tell the user why when they come back.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && isPlaying && !isFinished) {
        setIsPlaying(false);
        setPausedAway(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPlaying, isFinished]);

  useEffect(() => {
    if (isFinished) document.title = t('player.completeDocTitle');
  }, [isFinished]);

  // Audio cue at the start of each exercise and when the routine ends.
  useEffect(() => {
    if (soundCues && !isFinished) chime('start');
  }, [index, soundCues, isFinished]);
  useEffect(() => {
    if (soundCues && isFinished) chime('done');
  }, [isFinished, soundCues]);

  const togglePlay = useCallback(() => {
    setPausedAway(false);
    setIsPlaying((p) => !p);
  }, []);

  // Auto-advance when the current exercise runs out.
  useMotionValueEvent(clock, 'change', (v) => {
    if (duration > 0 && v >= duration) goTo(index + 1);
  });

  const requestExit = useCallback(() => {
    if (index > 0 || clock.get() > 5) setConfirmExit(true);
    else onCancel();
  }, [index, clock, onCancel]);

  // Space = play/pause, ←/→ = previous/next, Esc = exit.
  useEffect(() => {
    if (isFinished || confirmExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      const onControl = target.closest('button, input, select, textarea, summary');
      if (e.key === ' ' && !onControl) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        requestExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFinished, confirmExit, index, goTo, requestExit, togglePlay]);

  if (isFinished) {
    const relief = beforePainLevel - afterPain;
    const totalSeconds = exercises.reduce((sum, ex) => sum + ex.duration, 0);
    const question = isPainArea(painArea) ? t(`player.question.${painArea}`) : t('player.questionGeneral');
    const comparison =
      relief > 0
        ? t('player.down', { diff: relief, before: beforePainLevel })
        : relief < 0
          ? t('player.up', { diff: -relief, before: beforePainLevel })
          : t('player.same', { before: beforePainLevel });
    const area = painArea === 'custom' ? null : formatPainArea(painArea, true);

    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <h1 className="text-2xl font-semibold">{t('player.complete')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('player.completeSummary', {
              exercises: tp('count.exercises', exercises.length),
              duration: formatSeconds(totalSeconds),
              names: formatList(exercises.map((ex) => ex.name)),
            })}
          </p>

          <PainScale
            id="routine-after-pain"
            className="mt-8"
            value={afterPain}
            onChange={setAfterPain}
            min={0}
            max={10}
            label={question}
            variant="no-pain-severe"
          />
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            {comparison}
          </p>
          {relief < 0 && (
            <p className="mt-3 border-l-2 border-warning pl-3 text-sm">
              {area ? t('player.worseArea', { area }) : t('player.worseGeneral')}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onComplete(afterPain, true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              {t('player.saveFinish')}
            </button>
            {!firstRun && (
              <button
                type="button"
                onClick={() => onComplete(afterPain, false)}
                className="text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                {t('player.skipRating')}
              </button>
            )}
          </div>
          {!firstRun && <p className="mt-2 text-xs text-muted-foreground">{t('player.skippedNote')}</p>}
        </div>
      </div>
    );
  }

  const stepButton =
    'rounded-md border border-border bg-card p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {t('player.position', { n: index + 1, total: exercises.length })}
          </span>
          <div className="flex flex-1 gap-1" aria-hidden>
            {exercises.map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-sm bg-muted">
                {i === index ? (
                  <CurrentBar clock={clock} duration={duration} />
                ) : (
                  <div className="h-full bg-primary" style={{ width: i < index ? '100%' : '0%' }} />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={requestExit}
            className="-mr-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('player.exitLabel')}
            title={t('player.exitTitle')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-6 sm:px-6 md:grid-cols-2 md:items-start">
        <div className={`relative transition-opacity ${isPlaying ? '' : 'opacity-60'}`}>
          <ExerciseAnimation
            exerciseId={exercise.id}
            isPlaying={isPlaying}
            size="lg"
            clock={clock}
            onCueChange={soundCues ? () => chime('change') : undefined}
            fallback={<StepText key={index} clock={clock} duration={duration} steps={exercise.instructions} />}
          >
            <Countdown key={index} clock={clock} duration={duration} name={exercise.name} />
            {!isPlaying && (
              <span className="absolute left-3 top-3 text-sm text-muted-foreground">
                {pausedAway ? t('player.pausedAway') : t('player.paused')}
              </span>
            )}
          </ExerciseAnimation>
        </div>

        <div key={exercise.id}>
          <p className="text-xs text-muted-foreground">
            {categoryLabel(exercise.category)} · {formatSeconds(exercise.duration)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{exercise.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{exercise.description}</p>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className={stepButton}
              aria-label={t('player.previousLabel')}
              title={t('player.previousTitle')}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex min-w-28 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              title={isPlaying ? t('player.pauseTitle') : t('player.resumeTitle')}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
              {isPlaying ? t('player.pause') : t('player.resume')}
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className={stepButton}
              aria-label={isLast ? t('player.finishLabel') : t('player.nextLabel')}
              title={isLast ? t('player.finishTitle') : t('player.nextTitle')}
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <ol className="mt-7 list-decimal space-y-2 pl-5 text-sm marker:text-muted-foreground">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="pl-1">
                {step}
              </li>
            ))}
          </ol>

          {/* Queue and shortcuts wait until the second routine; the first needs only the figure and Pause. */}
          {!firstRun && (
            <>
          <ol className="mt-7 divide-y divide-border border-y border-border text-sm" aria-label={t('player.routine')}>
            {exercises.map((ex, i) => {
              const done = i < index;
              const current = i === index;
              return (
                <li
                  key={ex.id + i}
                  aria-current={current ? 'step' : undefined}
                  className={`flex items-center gap-3 py-2 ${current ? 'font-medium' : 'text-muted-foreground'}`}
                >
                  <span className="flex w-4 justify-center text-xs tabular-nums">
                    {done ? <Check className="h-3.5 w-3.5" aria-label={t('player.done')} /> : i + 1}
                  </span>
                  <span className="flex-1 truncate">{ex.name}</span>
                  <span className="text-xs tabular-nums">{formatSeconds(ex.duration)}</span>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 hidden text-xs text-muted-foreground sm:block">
            <kbd>{t('key.space')}</kbd> {t('player.keysPause')} · <kbd>←</kbd> <kbd>→</kbd> {t('player.keysStep')} ·{' '}
            <kbd>Esc</kbd> {t('player.keysLeave')}
          </p>
            </>
          )}
        </div>
      </main>

      {confirmExit && (
        <Modal
          title={t('player.leaveTitle')}
          onClose={() => setConfirmExit(false)}
          footer={
            <>
              <button type="button" onClick={() => setConfirmExit(false)} className={secondaryButton}>
                {t('player.keepGoing')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90"
              >
                {t('player.leave')}
              </button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">{t('player.leaveBody')}</p>
        </Modal>
      )}
    </div>
  );
}
