import type { ReliefEntry, UserSettings } from './types';

export interface StorageAdapter {
  getRelief(): Promise<ReliefEntry[]>;
  setRelief(data: ReliefEntry[]): Promise<void>;
  clearRelief(): Promise<void>;
  getSettings(): Promise<UserSettings>;
  setSettings(settings: UserSettings): Promise<void>;
}

export const DEFAULT_SETTINGS: UserSettings = {
  reminderInterval: 60,
  remindersEnabled: true,
  soundCues: false,
  activeFrom: 8,
  activeTo: 19,
  weekdaysOnly: false,
  theme: 'fast-wellness',
  colorMode: 'system',
  language: 'auto',
};
