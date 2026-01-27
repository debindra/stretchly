export {};

const ALARM_NAME = 'stretchly-reminder';
const SETTINGS_KEY = 'stretchly-settings';
const DEFAULT_INTERVAL = 60;

interface StoredSettings {
  reminderInterval?: number;
  remindersEnabled?: boolean;
}

async function getSettings(): Promise<{ remindersEnabled: boolean; reminderInterval: number }> {
  try {
    const out = await chrome.storage.local.get(SETTINGS_KEY);
    const raw = out[SETTINGS_KEY];
    if (raw == null) {
      console.log('[Stretchly] No settings found, using defaults');
      return { remindersEnabled: true, reminderInterval: DEFAULT_INTERVAL };
    }
    const parsed: StoredSettings = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const settings = {
      remindersEnabled: typeof parsed.remindersEnabled === 'boolean' ? parsed.remindersEnabled : true,
      reminderInterval:
        typeof parsed.reminderInterval === 'number' && parsed.reminderInterval >= 1
          ? parsed.reminderInterval
          : DEFAULT_INTERVAL,
    };
    console.log('[Stretchly] Loaded settings:', settings);
    return settings;
  } catch (e) {
    console.warn('[Stretchly] Error loading settings:', e);
    return { remindersEnabled: true, reminderInterval: DEFAULT_INTERVAL };
  }
}

async function syncReminderAlarm(): Promise<void> {
  try {
    const { remindersEnabled, reminderInterval } = await getSettings();
    
    // Clear existing alarm
    await chrome.alarms.clear(ALARM_NAME);
    console.log('[Stretchly] Cleared existing alarm');
    
    if (remindersEnabled) {
      // Create alarm with both delayInMinutes (for first fire) and periodInMinutes (for repeating)
      // This ensures the first alarm fires after reminderInterval minutes, then repeats
      const delayInMinutes = reminderInterval;
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: delayInMinutes,
        periodInMinutes: reminderInterval,
      });
      console.log(`[Stretchly] Created reminder alarm - first fire in ${delayInMinutes} min, then every ${reminderInterval} min`);
      
      // Verify alarm was created
      const alarms = await chrome.alarms.getAll();
      const ourAlarm = alarms.find(a => a.name === ALARM_NAME);
      if (ourAlarm) {
        const fireTime = ourAlarm.scheduledTime ? new Date(ourAlarm.scheduledTime) : null;
        const timeUntilFire = fireTime ? Math.round((fireTime.getTime() - Date.now()) / 1000 / 60) : null;
        console.log('[Stretchly] Alarm verified:', {
          name: ourAlarm.name,
          scheduledTime: fireTime ? fireTime.toISOString() : 'unknown',
          timeUntilFire: timeUntilFire !== null ? `${timeUntilFire} minutes` : 'unknown',
          periodInMinutes: ourAlarm.periodInMinutes,
        });
      } else {
        console.error('[Stretchly] Alarm was not created!');
      }
    } else {
      console.log('[Stretchly] Reminders disabled, alarm cleared');
    }
  } catch (e) {
    console.error('[Stretchly] Failed to sync reminder alarm:', e);
  }
}

async function showReminderNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    // First check notification permission level
    const permissionLevel = await new Promise<string>((resolve) => {
      chrome.notifications.getPermissionLevel((level) => {
        resolve(level);
      });
    });
    
    console.log('[Stretchly] Notification permission level:', permissionLevel);
    
    if (permissionLevel !== 'granted') {
      console.error('[Stretchly] ❌ Notifications not permitted. Level:', permissionLevel);
      return { 
        success: false, 
        error: `Notifications blocked. Check Chrome settings and macOS System Settings > Notifications > Google Chrome` 
      };
    }

    // Get icon URL - using the extension's icon
    const iconUrl = chrome.runtime.getURL('icons/icon128.png');
    console.log('[Stretchly] Creating notification with icon:', iconUrl);
    
    // Create notification with unique ID to prevent duplicates
    const notificationId = 'stretchly-reminder-' + Date.now();
    
    const notificationOptions: chrome.notifications.NotificationOptions = {
      type: 'basic',
      iconUrl,
      title: 'Time to Stretch!',
      message: "Take a quick break and check in on your body.",
      priority: 2,
      requireInteraction: false,
      silent: false,
    };

    try {
      const id = await new Promise<string>((resolve, reject) => {
        chrome.notifications.create(notificationId, notificationOptions, (createdId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(createdId || notificationId);
          }
        });
      });
      
      console.log('[Stretchly] ✅ Notification API returned ID:', id);
      
      // Verify the notification exists
      const exists = await new Promise<boolean>((resolve) => {
        chrome.notifications.getAll((notifications) => {
          console.log('[Stretchly] Active notifications:', Object.keys(notifications));
          resolve(id in notifications);
        });
      });
      
      if (exists) {
        console.log('[Stretchly] ✅ Notification verified as active');
        return { success: true };
      } else {
        console.warn('[Stretchly] ⚠️ Notification was created but not found in active list');
        console.warn('[Stretchly] This usually means macOS is blocking Chrome notifications.');
        console.warn('[Stretchly] Fix: System Settings > Notifications > Google Chrome > Allow Notifications');
        return { 
          success: false, 
          error: 'Notification created but blocked by system. Enable notifications for Chrome in macOS System Settings > Notifications > Google Chrome' 
        };
      }
    } catch (error) {
      console.error('[Stretchly] Notification creation failed:', error);
      return { success: false, error: String(error) };
    }
  } catch (e) {
    console.error('[Stretchly] ❌ Error in showReminderNotification:', e);
    return { success: false, error: String(e) };
  }
}

// Handle alarm events - MUST be registered at top level BEFORE any async operations
// This ensures the listener is active when the service worker wakes up for an alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('[Stretchly] ⏰ Alarm fired:', alarm.name, 'at', new Date().toISOString());
  if (alarm.name === ALARM_NAME) {
    console.log('[Stretchly] Processing reminder alarm...');
    void showReminderNotification();
  } else {
    console.log('[Stretchly] Unknown alarm:', alarm.name);
  }
});

// Check notification permission on startup
async function checkNotificationPermission(): Promise<boolean> {
  if (!chrome.notifications) {
    console.error('[Stretchly] ❌ chrome.notifications API not available');
    return false;
  }
  
  // Chrome extensions with "notifications" permission should have access
  // But we can verify by trying to get permission level
  try {
    const level = await new Promise<string>((resolve) => {
      chrome.notifications.getPermissionLevel((level) => {
        if (chrome.runtime.lastError) {
          resolve('unknown');
        } else {
          resolve(level);
        }
      });
    });
    console.log('[Stretchly] Notification permission level:', level);
    return level === 'granted';
  } catch (e) {
    console.warn('[Stretchly] Could not check notification permission:', e);
    // Assume granted if we have the permission in manifest
    return true;
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Stretchly] Extension installed/updated');
  void checkNotificationPermission();
  void syncReminderAlarm();
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('[Stretchly] Notification clicked:', notificationId);
  chrome.notifications.clear(notificationId);
  void chrome.runtime.openOptionsPage();
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[SETTINGS_KEY]) {
    console.log('[Stretchly] Settings changed, syncing alarm');
    void syncReminderAlarm();
  }
});

// Handle messages from options page
chrome.runtime.onMessage.addListener(
  (msg: { type?: string }, _sender, sendResponse) => {
    if (msg.type === 'SYNC_REMINDERS') {
      console.log('[Stretchly] Received SYNC_REMINDERS message');
      void syncReminderAlarm().then(() => {
        sendResponse({ ok: true });
      });
      return true; // Keep channel open for async response
    }
    if (msg.type === 'TEST_NOTIFICATION') {
      console.log('[Stretchly] Received TEST_NOTIFICATION message');
      void showReminderNotification().then((result) => {
        sendResponse({ ok: result.success, sent: result.success, error: result.error });
      });
      return true; // Fixed: return true when using sendResponse
    }
    if (msg.type === 'CHECK_ALARMS') {
      // Debug helper: check all alarms
      chrome.alarms.getAll().then((alarms) => {
        console.log('[Stretchly] All alarms:', alarms);
        sendResponse({ alarms: alarms.map(a => ({
          name: a.name,
          scheduledTime: a.scheduledTime ? new Date(a.scheduledTime).toISOString() : null,
          periodInMinutes: a.periodInMinutes,
        })) });
      });
      return true;
    }
    if (msg.type === 'GET_ALARM_STATUS') {
      // Get current alarm status for UI display
      Promise.all([
        chrome.alarms.get(ALARM_NAME),
        getSettings(),
        checkNotificationPermission(),
      ]).then(([alarm, settings, hasNotificationPermission]) => {
        const status = {
          alarmExists: !!alarm,
          nextFireTime: alarm?.scheduledTime ? new Date(alarm.scheduledTime).toISOString() : null,
          nextFireIn: alarm?.scheduledTime ? Math.round((alarm.scheduledTime - Date.now()) / 1000) : null,
          periodInMinutes: alarm?.periodInMinutes ?? null,
          remindersEnabled: settings.remindersEnabled,
          reminderInterval: settings.reminderInterval,
          hasNotificationPermission,
        };
        console.log('[Stretchly] Alarm status:', status);
        sendResponse(status);
      });
      return true;
    }
    return false; // Don't keep channel open for unknown messages
  }
);

// Sync alarms whenever the service worker starts (e.g. after browser restart)
console.log('[Stretchly] Service worker started, syncing alarms');
void checkNotificationPermission();
void syncReminderAlarm();
