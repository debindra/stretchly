import type { Exercise } from './types';
import { exerciseTranslations } from './translations';

export type Locale = 'en' | 'es' | 'it' | 'tr' | 'ru' | 'zh' | 'hi' | 'pl' | 'ko' | 'fr';

/**
 * Each language named in itself, so a reader finds theirs without knowing English.
 * `flag` is the country most associated with the language, shown beside the name in the picker.
 * Flags stand for languages loosely (English uses the UK flag); the name is what identifies it.
 */
export const LOCALES: { code: Locale; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'zh', name: '中文（简体）', flag: '🇨🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

/** The user-facing text of one exercise; everything else on `Exercise` is language-neutral. */
export interface ExerciseText {
  name: string;
  description: string;
  instructions: string[];
}

export type ExerciseTranslations = Record<string, ExerciseText>;

/** Maps a browser language tag ("pt-BR", "zh-TW", "es") to a supported locale, falling back to English. */
export function resolveLocale(tag: string | undefined): Locale {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return LOCALES.some((l) => l.code === base) ? (base as Locale) : 'en';
}

/** Returns the exercise with its text in `locale`; missing translations keep the English text. */
export function localizeExercise(exercise: Exercise, locale: Locale): Exercise {
  const text = exerciseTranslations[locale]?.[exercise.id];
  return text ? { ...exercise, ...text } : exercise;
}
