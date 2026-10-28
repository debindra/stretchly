import type { Locale } from './i18n';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  category: 'neck' | 'shoulders' | 'back' | 'hips' | 'legs' | 'wrists' | 'eyes';
  instructions: string[];
}

export interface ReliefEntry {
  date: string;
  painArea: string;
  beforePain: number; // 1-10
  afterPain: number; // 1-10
  exerciseIds: string[];
  /** Local time the session ended, "HH:MM". Missing on entries saved before this field existed. */
  time?: string;
  /** False when the user skipped the after-rating; such entries count as sessions but not toward relief. */
  rated?: boolean;
}

/** A routine the user built in the library and saved under a name. */
export interface SavedRoutine {
  id: string;
  name: string;
  exerciseIds: string[];
}

export type Theme = 'fast-wellness' | 'calm' | 'energizer' | 'modern';

export type ColorMode = 'system' | 'light' | 'dark';

export interface UserSettings {
  reminderInterval: number; // in minutes
  remindersEnabled: boolean;
  /** Soft chime when an exercise starts or its cue changes; helps with eyes-closed exercises. */
  soundCues: boolean;
  /** Reminders only fire between these local hours (0–24, `activeFrom` inclusive, `activeTo` exclusive). */
  activeFrom: number;
  activeTo: number;
  weekdaysOnly: boolean;
  theme: Theme;
  colorMode: ColorMode;
  /** 'auto' follows the browser language. */
  language: Locale | 'auto';
}

export type View = 'dashboard' | 'library' | 'progress' | 'settings';
