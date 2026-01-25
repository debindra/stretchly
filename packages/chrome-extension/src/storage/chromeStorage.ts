import type { StorageAdapter } from '@stretchly/shared';
import type { ReliefEntry, UserSettings } from '@stretchly/shared';
import { DEFAULT_SETTINGS } from '@stretchly/shared';

const KEYS = {
  relief: 'stretchly-relief',
  settings: 'stretchly-settings',
} as const;

function getStorage() {
  return typeof chrome !== 'undefined' && chrome.storage?.local
    ? chrome.storage.local
    : null;
}

export const chromeStorageAdapter: StorageAdapter = {
  async getRelief(): Promise<ReliefEntry[]> {
    const s = getStorage();
    if (!s) return [];
    const out = await s.get(KEYS.relief);
    const raw = out[KEYS.relief];
    if (raw == null) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async setRelief(data: ReliefEntry[]): Promise<void> {
    const s = getStorage();
    if (!s) return;
    await s.set({ [KEYS.relief]: JSON.stringify(data) });
  },

  async clearRelief(): Promise<void> {
    const s = getStorage();
    if (!s) return;
    await s.remove(KEYS.relief);
  },

  async getSettings(): Promise<UserSettings> {
    const s = getStorage();
    if (!s) return { ...DEFAULT_SETTINGS };
    const out = await s.get(KEYS.settings);
    const raw = out[KEYS.settings];
    if (raw == null) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        reminderInterval: typeof parsed.reminderInterval === 'number' ? parsed.reminderInterval : DEFAULT_SETTINGS.reminderInterval,
        remindersEnabled: typeof parsed.remindersEnabled === 'boolean' ? parsed.remindersEnabled : DEFAULT_SETTINGS.remindersEnabled,
        preferredDuration: typeof parsed.preferredDuration === 'number' ? parsed.preferredDuration : DEFAULT_SETTINGS.preferredDuration,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  async setSettings(settings: UserSettings): Promise<void> {
    const s = getStorage();
    if (!s) return;
    await s.set({ [KEYS.settings]: JSON.stringify(settings) });
    // Notify background service worker to sync alarms
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }).catch((err) => {
        // Service worker might not be running, that's okay - storage.onChanged will handle it
        console.debug('[Stretchly] Could not send SYNC_REMINDERS message:', err);
      });
    }
  },
};
