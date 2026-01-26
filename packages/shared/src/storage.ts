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
  preferredDuration: 2,
  theme: 'fast-wellness',
};
