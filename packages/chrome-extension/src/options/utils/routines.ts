import type { Exercise, Locale } from '@stretchly/shared';
import { exercises, localizeExercise, quickRoutines } from '@stretchly/shared';
import { tMaybe } from '../../i18n';

/**
 * Resolve exercise ids, dropping any that no longer exist (e.g. after the exercise list changes).
 * With `locale`, the exercises come back with their text in that language.
 */
export function exercisesFor(ids: readonly string[], locale?: Locale): Exercise[] {
  return ids
    .map((id) => exercises.find((ex) => ex.id === id))
    .filter((ex): ex is Exercise => ex !== undefined)
    .map((ex) => (locale ? localizeExercise(ex, locale) : ex));
}

export const totalSeconds = (list: readonly Exercise[]) => list.reduce((sum, ex) => sum + ex.duration, 0);

/** General-purpose routines for when nothing in particular hurts. Keys double as the stored "area". */
export const GENERAL_ROUTINES = Object.entries(quickRoutines).map(([key, r]) => {
  const list = exercisesFor(r.exercises);
  return {
    key,
    /** In the active locale; read it at render time. */
    get name() {
      return tMaybe(`routine.${key}`) ?? r.name;
    },
    exercises: list,
    seconds: totalSeconds(list),
  };
});
