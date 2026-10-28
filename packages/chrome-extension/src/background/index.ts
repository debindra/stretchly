import { openOptionsTab } from '../utils/openOptions';
import { isPainArea, optionsHash } from '../utils/painAreas';
import { localeFromSetting, setLocale, t } from '../i18n';
import type { UserSettings } from '@stretchly/shared';

const ALARM_NAME = 'stretchly-reminder';
const SNOOZE_ALARM = 'stretchly-snooze';
const SNOOZE_MINUTES = 15;
const SETTINGS_KEY = 'stretchly-settings';
const RELIEF_KEY = 'stretchly-relief';
const NOTIFICATION_PREFIX = 'stretchly-reminder-';

interface ReminderSettings {
  remindersEnabled: boolean;
  reminderInterval: number;
  activeFrom: number;
  activeTo: number;
  weekdaysOnly: boolean;
  language: UserSettings['language'];
}

const DEFAULTS: ReminderSettings = {
  remindersEnabled: true,
  reminderInterval: 60,
  activeFrom: 8,
  activeTo: 19,
  weekdaysOnly: false,
  language: 'auto',
};

interface StoredEntry {
  painArea?: string;
  beforePain?: number;
}

function parse(raw: unknown): unknown {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function getSettings(): Promise<ReminderSettings> {
  try {
    const raw = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
    if (raw == null) return { ...DEFAULTS };
    const p = parse(raw) as Partial<ReminderSettings>;
    const hour = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 24 ? v : d);
    return {
      remindersEnabled: typeof p.remindersEnabled === 'boolean' ? p.remindersEnabled : DEFAULTS.remindersEnabled,
      reminderInterval:
        typeof p.reminderInterval === 'number' && p.reminderInterval >= 1 ? p.reminderInterval : DEFAULTS.reminderInterval,
      activeFrom: hour(p.activeFrom, DEFAULTS.activeFrom),
      activeTo: hour(p.activeTo, DEFAULTS.activeTo),
      weekdaysOnly: typeof p.weekdaysOnly === 'boolean' ? p.weekdaysOnly : DEFAULTS.weekdaysOnly,
      // localeFromSetting falls back to the browser language for anything unrecognised.
      language: typeof p.language === 'string' ? p.language : DEFAULTS.language,
    };
  } catch (e) {
    console.warn('[Stretchly] Could not read settings:', e);
    return { ...DEFAULTS };
  }
}

async function getRelief(): Promise<StoredEntry[]> {
  try {
    const value = parse((await chrome.storage.local.get(RELIEF_KEY))[RELIEF_KEY]);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** True when a reminder may be shown now, given active hours and the weekdays-only option. */
function withinActiveHours(s: ReminderSettings, now = new Date()): boolean {
  const day = now.getDay();
  if (s.weekdaysOnly && (day === 0 || day === 6)) return false;
  const h = now.getHours();
  if (s.activeFrom === s.activeTo) return true;
  return s.activeFrom < s.activeTo ? h >= s.activeFrom && h < s.activeTo : h >= s.activeFrom || h < s.activeTo;
}

/**
 * Make the repeating alarm match the settings. An alarm that already has the right period is left
 * alone, so opening the options page or changing the theme doesn't restart the countdown.
 * `restart` forces a fresh full interval, used right after the user finishes a routine.
 */
async function syncReminderAlarm(restart = false): Promise<void> {
  const { remindersEnabled, reminderInterval } = await getSettings();
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!remindersEnabled) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(SNOOZE_ALARM);
    return;
  }
  if (!restart && existing?.periodInMinutes === reminderInterval) return;
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes: reminderInterval, periodInMinutes: reminderInterval });
}

function permissionLevel(): Promise<string> {
  return new Promise((resolve) => {
    chrome.notifications.getPermissionLevel((level) => resolve(chrome.runtime.lastError ? 'unknown' : level));
  });
}

/** Notification body that uses the user's own history when there is any. */
async function reminderMessage(): Promise<{ message: string; area: string | null }> {
  const relief = await getRelief();
  const last = relief[relief.length - 1];
  if (last && last.painArea && isPainArea(last.painArea) && typeof last.beforePain === 'number') {
    return { message: t(`notify.lastTime.${last.painArea}`, { level: last.beforePain }), area: last.painArea };
  }
  return { message: t('notify.generic'), area: null };
}

/** Area each live notification should open; kept in session storage so it survives a worker restart. */
async function rememberArea(id: string, area: string | null) {
  try {
    await chrome.storage.session.set({ [id]: area });
  } catch {
    // Session storage unavailable; the notification then opens the area picker.
  }
}

async function areaFor(id: string): Promise<string | null> {
  try {
    const value = (await chrome.storage.session.get(id))[id];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

async function showReminderNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    // The worker has no UI of its own; take the language from settings each time it speaks.
    setLocale(localeFromSetting((await getSettings()).language));
    if ((await permissionLevel()) !== 'granted') {
      return { success: false, error: t('notify.blocked') };
    }
    const { message, area } = await reminderMessage();
    const id = NOTIFICATION_PREFIX + Date.now();
    await new Promise<void>((resolve, reject) => {
      chrome.notifications.create(
        id,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: t('notify.title'),
          message,
          buttons: [
            { title: area ? t('notify.start') : t('notify.open') },
            { title: t('notify.snooze', { count: SNOOZE_MINUTES }) },
          ],
          priority: 2,
        },
        () => (chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve())
      );
    });
    await rememberArea(id, area);

    const shown = await new Promise<boolean>((resolve) => chrome.notifications.getAll((all) => resolve(id in all)));
    if (!shown) {
      return { success: false, error: t('notify.hidden') };
    }
    return { success: true };
  } catch (e) {
    console.error('[Stretchly] Notification failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function openFromNotification(id: string) {
  const area = await areaFor(id);
  try {
    await openOptionsTab(optionsHash('dashboard', area && isPainArea(area) ? area : undefined));
  } catch (e) {
    console.error('[Stretchly] Could not open the options page:', e);
  }
  chrome.notifications.clear(id);
  void chrome.storage.session.remove(id).catch(() => {});
}

// Listeners must be registered at top level so they exist when the worker wakes for an event.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME && alarm.name !== SNOOZE_ALARM) return;
  void getSettings().then((s) => {
    if (s.remindersEnabled && withinActiveHours(s)) void showReminderNotification();
  });
});

chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith(NOTIFICATION_PREFIX)) void openFromNotification(id);
});

chrome.notifications.onButtonClicked.addListener((id, button) => {
  if (!id.startsWith(NOTIFICATION_PREFIX)) return;
  if (button === 0) {
    void openFromNotification(id);
  } else {
    chrome.notifications.clear(id);
    void chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: SNOOZE_MINUTES });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  void syncReminderAlarm();
  // First install: show the Relief page once so the extension isn't silent for the first hour.
  if (details.reason === 'install') void openOptionsTab('#dashboard?welcome=1').catch(() => {});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[SETTINGS_KEY]) void syncReminderAlarm();
  // A new session was saved: the user just stretched, so start a full interval from now.
  if (changes[RELIEF_KEY]) {
    const count = (v: unknown) => {
      try {
        const parsed = parse(v);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    };
    if (count(changes[RELIEF_KEY].newValue) > count(changes[RELIEF_KEY].oldValue)) {
      void chrome.alarms.clear(SNOOZE_ALARM);
      void syncReminderAlarm(true);
    }
  }
});

chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
  if (msg.type === 'SYNC_REMINDERS') {
    void syncReminderAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'TEST_NOTIFICATION') {
    void showReminderNotification().then((r) => sendResponse({ ok: r.success, sent: r.success, error: r.error }));
    return true;
  }
  if (msg.type === 'GET_ALARM_STATUS') {
    void Promise.all([chrome.alarms.get(ALARM_NAME), chrome.alarms.get(SNOOZE_ALARM), getSettings(), permissionLevel()]).then(
      ([alarm, snooze, settings, level]) => {
        const next = [alarm?.scheduledTime, snooze?.scheduledTime].filter((t): t is number => t != null);
        const nextTime = next.length ? Math.min(...next) : null;
        sendResponse({
          alarmExists: !!alarm,
          nextFireTime: nextTime ? new Date(nextTime).toISOString() : null,
          nextFireIn: nextTime ? Math.round((nextTime - Date.now()) / 1000) : null,
          periodInMinutes: alarm?.periodInMinutes ?? null,
          remindersEnabled: settings.remindersEnabled,
          reminderInterval: settings.reminderInterval,
          hasNotificationPermission: level === 'granted',
          withinActiveHours: withinActiveHours(settings),
        });
      }
    );
    return true;
  }
  return false;
});

// The worker also starts after a browser restart; make sure the alarm still exists.
void syncReminderAlarm();
