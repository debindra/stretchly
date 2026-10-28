import type { StorageAdapter } from '@stretchly/shared';
import type { ColorMode, ReliefEntry, SavedRoutine, Theme, UserSettings } from '@stretchly/shared';
import { DEFAULT_SETTINGS, LOCALES } from '@stretchly/shared';

const KEYS = {
  relief: 'stretchly-relief',
  settings: 'stretchly-settings',
  routines: 'stretchly-routines',
} as const;

const hour = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 24 ? v : fallback;

/** Keep only well-formed entries; used for stored data and for imported files. */
export function sanitizeRelief(value: unknown): ReliefEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is ReliefEntry =>
      r != null &&
      typeof r === 'object' &&
      typeof r.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      typeof r.painArea === 'string' &&
      typeof r.beforePain === 'number' &&
      typeof r.afterPain === 'number' &&
      Array.isArray(r.exerciseIds)
  );
}

const THEMES: Theme[] = ['fast-wellness', 'calm', 'energizer', 'modern'];
const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark'];

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
      return sanitizeRelief(typeof raw === 'string' ? JSON.parse(raw) : raw);
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
        soundCues: typeof parsed.soundCues === 'boolean' ? parsed.soundCues : DEFAULT_SETTINGS.soundCues,
        activeFrom: hour(parsed.activeFrom, DEFAULT_SETTINGS.activeFrom),
        activeTo: hour(parsed.activeTo, DEFAULT_SETTINGS.activeTo),
        weekdaysOnly: typeof parsed.weekdaysOnly === 'boolean' ? parsed.weekdaysOnly : DEFAULT_SETTINGS.weekdaysOnly,
        theme: THEMES.includes(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
        colorMode: COLOR_MODES.includes(parsed.colorMode) ? parsed.colorMode : DEFAULT_SETTINGS.colorMode,
        language:
          parsed.language === 'auto' || LOCALES.some((l) => l.code === parsed.language)
            ? parsed.language
            : DEFAULT_SETTINGS.language,
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

/** Routines saved from the library. Kept outside the shared adapter because only the extension has them. */
export async function getSavedRoutines(): Promise<SavedRoutine[]> {
  const s = getStorage();
  if (!s) return [];
  const raw = (await s.get(KEYS.routines))[KEYS.routines];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is SavedRoutine =>
      r != null && typeof r.id === 'string' && typeof r.name === 'string' && Array.isArray(r.exerciseIds)
  );
}

export async function setSavedRoutines(routines: SavedRoutine[]): Promise<void> {
  const s = getStorage();
  if (!s) return;
  await s.set({ [KEYS.routines]: routines });
}
