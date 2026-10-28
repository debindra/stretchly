import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMotionValue, useMotionValueEvent, useReducedMotion, type MotionValue } from 'motion/react';
import { VIEWBOX, cueAt, useLoopProgress, type Clip } from './exercise-animations/engine';
import { neckTilt, neckRotation, chinTuck } from './exercise-animations/neck';
import { eye202020, blinkReset, eyeRolls } from './exercise-animations/eyes';
import { shoulderRolls, shoulderShrugs, shoulderSqueeze } from './exercise-animations/shoulders';
import { wristFlexor, wristExtensor, wristCircles } from './exercise-animations/wrists';
import { spinalTwist, thoracicExtension, pelvicTilt, catCow, kneeToChest, backExtension } from './exercise-animations/back';
import { stretchClips } from './exercise-animations/stretches';
import { t, translateCue } from '../../i18n';
import { useLocale } from '../../i18n/react';

// Every exercise's animation clip, keyed by exercise id.
// Keep each exercise's `duration` (shared/exercises.ts) a whole multiple of its clip's loop, so a
// routine always ends at rest with both sides done equally.
const clips: Record<string, Clip> = {
  'neck-tilt': neckTilt,
  'neck-rotation': neckRotation,
  'chin-tuck': chinTuck,
  'eye-20-20-20': eye202020,
  'blink-reset': blinkReset,
  'eye-rolls': eyeRolls,
  'shoulder-rolls': shoulderRolls,
  'shoulder-shrugs': shoulderShrugs,
  'shoulder-squeeze': shoulderSqueeze,
  'wrist-flexor': wristFlexor,
  'wrist-extensor': wristExtensor,
  'wrist-circles': wristCircles,
  'spinal-twist': spinalTwist,
  'thoracic-extension': thoracicExtension,
  'pelvic-tilt': pelvicTilt,
  'cat-cow': catCow,
  'knee-to-chest': kneeToChest,
  'standing-back-extension': backExtension,
  ...stretchClips,
};

interface ExerciseAnimationProps {
  exerciseId: string;
  isPlaying: boolean;
  /** 'md' fits small containers (library preview); 'lg' grows to fill the routine player column. */
  size?: AnimationSize;
  /** Overlay content (e.g. a status badge) positioned relative to the frame. */
  children?: ReactNode;
  /**
   * Seconds elapsed in the exercise. When given, clips follow this clock instead of their own,
   * so the animation stays in step with the routine timer.
   */
  clock?: MotionValue<number>;
  /** Shown inside the frame for exercises that have no animation yet (e.g. the current instruction). */
  fallback?: ReactNode;
  /** Called with the caption text whenever it changes, so the player can play an audio cue. */
  onCueChange?: (text: string) => void;
}

/** Whether an exercise has an animation clip; exercises without one are taught by text alone. */
export const hasAnimation = (exerciseId: string) => exerciseId in clips;

type AnimationSize = 'md' | 'lg';

const frameBase = 'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-muted';

const frameClass: Record<AnimationSize, string> = {
  md: `${frameBase} h-48 w-full md:h-60`,
  // Square that tracks the column width, capped by viewport height so it never crowds the controls.
  lg: `${frameBase} aspect-square w-full max-w-[min(60vh,560px)] p-4 md:max-w-[min(70vh,560px)] md:p-6`,
};

const cueClass: Record<AnimationSize, string> = {
  md: 'h-6 shrink-0 text-xs font-medium text-muted-foreground',
  lg: 'h-7 shrink-0 pt-1 text-sm font-medium text-muted-foreground',
};

export function ExerciseAnimation({
  exerciseId,
  isPlaying,
  size = 'md',
  children,
  clock,
  fallback,
  onCueChange,
}: ExerciseAnimationProps) {
  const clip = clips[exerciseId];
  if (clip) {
    return (
      <ClipPlayer key={exerciseId} clip={clip} isPlaying={isPlaying} size={size} clock={clock} onCueChange={onCueChange}>
        {children}
      </ClipPlayer>
    );
  }
  // No clip yet: same frame, so layouts don't jump, with the text guidance in its place.
  return (
    <div className={frameClass[size]}>
      {fallback ?? <p className="px-6 text-center text-sm text-muted-foreground">{t('animation.none')}</p>}
      {children}
    </div>
  );
}

function ClipPlayer({
  clip,
  isPlaying,
  size,
  children,
  clock,
  onCueChange,
}: {
  clip: Clip;
  isPlaying: boolean;
  size: AnimationSize;
  children?: ReactNode;
  clock?: MotionValue<number>;
  onCueChange?: (text: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  useLocale(); // Re-render captions when the language changes.
  const ownProgress = useLoopProgress(clip.duration, isPlaying && !reduceMotion && !clock);
  const unused = useMotionValue(0);
  const [seconds, setSeconds] = useState(() => clock?.get() ?? 0);
  useMotionValueEvent(clock ?? unused, 'change', setSeconds);
  const progress = clock ? (seconds / clip.duration) % 1 : ownProgress;
  // Reduced motion holds the key pose; captions (text, not motion) still follow the routine clock.
  const t = reduceMotion ? clip.still : progress;
  const cue = cueAt(clock ? progress : t, clip.cues, clip.duration);
  const onCueRef = useRef(onCueChange);
  onCueRef.current = onCueChange;
  const firstCue = useRef(true);
  useEffect(() => {
    // Skip the opening caption; the player already signals the start of each exercise.
    if (firstCue.current) {
      firstCue.current = false;
      return;
    }
    onCueRef.current?.(cue.text);
  }, [cue.text]);
  return (
    <div className={frameClass[size]} aria-hidden="true">
      <ClipFrame clip={clip} t={t} />
      <p className={cueClass[size]}>
        {translateCue(cue.text)}
        {cue.holdLeft !== null && (
          <span className="ml-1.5 font-semibold tabular-nums text-foreground">{cue.holdLeft}</span>
        )}
      </p>
      {children}
    </div>
  );
}

/** One still frame of a clip at progress `t` — pure, so it can be rendered for previews. */
export function ClipFrame({ clip, t }: { clip: Clip; t: number }) {
  const { Scene } = clip;
  return (
    <svg viewBox={VIEWBOX} className="w-full flex-1 min-h-0 text-foreground">
      <Scene t={t} />
    </svg>
  );
}

export function ExerciseFrame({ exerciseId, t }: { exerciseId: string; t: number }) {
  const clip = clips[exerciseId];
  return clip ? <ClipFrame clip={clip} t={t} /> : null;
}

/** The key pose of an exercise as a static thumbnail; no timers, safe to render in lists. */
export function ExerciseStill({ exerciseId, className = '' }: { exerciseId: string; className?: string }) {
  const clip = clips[exerciseId];
  if (!clip) return null;
  const { Scene } = clip;
  return (
    <svg viewBox={VIEWBOX} className={`text-foreground ${className}`} aria-hidden>
      <Scene t={clip.still} />
    </svg>
  );
}
