/** Promise wrapper around chrome.runtime.sendMessage that rejects outside the extension. */
export function sendMessage<T>(message: { type: string }): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('Extension runtime unavailable'));
      return;
    }
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response as T);
    });
  });
}

/** Shape of the background worker's GET_ALARM_STATUS reply. */
export interface AlarmStatus {
  alarmExists: boolean;
  nextFireTime: string | null;
  nextFireIn: number | null;
  periodInMinutes: number | null;
  remindersEnabled: boolean;
  reminderInterval: number;
  hasNotificationPermission: boolean;
  withinActiveHours: boolean;
}
