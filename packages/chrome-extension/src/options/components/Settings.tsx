import type { UserSettings, Theme } from '@stretchly/shared';
import * as Switch from '@radix-ui/react-switch';
import { Lightbulb, Bell, BellOff, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getThemeDisplayName, themes } from '../../utils/themes';

interface AlarmStatus {
  alarmExists: boolean;
  nextFireTime: string | null;
  nextFireIn: number | null;
  periodInMinutes: number | null;
  remindersEnabled: boolean;
  reminderInterval: number;
  hasNotificationPermission: boolean;
}

interface SettingsProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  onClearRelief: () => void | Promise<void>;
}

export function Settings({ settings, onUpdateSettings, onClearRelief }: SettingsProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [alarmStatus, setAlarmStatus] = useState<AlarmStatus | null>(null);
  const [testNotificationState, setTestNotificationState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const clearCancelRef = useRef<HTMLButtonElement>(null);

  // Fetch alarm status from background script
  const fetchAlarmStatus = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_ALARM_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get alarm status:', chrome.runtime.lastError);
          setAlarmStatus(null);
        } else if (response) {
          setAlarmStatus(response as AlarmStatus);
        }
      });
    }
  }, []);

  // Fetch status on mount and when settings change
  useEffect(() => {
    // Small delay to allow background script to sync alarm after settings change
    const timeout = setTimeout(() => {
      fetchAlarmStatus();
    }, 500);
    // Refresh status every 10 seconds to keep countdown updated
    const interval = setInterval(fetchAlarmStatus, 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchAlarmStatus, settings.remindersEnabled, settings.reminderInterval]);

  useEffect(() => {
    if (!showClearConfirm) return;
    clearCancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowClearConfirm(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showClearConfirm]);

  const handleClearData = () => {
    if (showClearConfirm) {
      void onClearRelief();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-hide confirmation after 5 seconds
      setTimeout(() => setShowClearConfirm(false), 5000);
    }
  };

  const handleTestNotification = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      setTestNotificationState('sending');
      setNotificationError(null);
      chrome.runtime.sendMessage({ type: 'TEST_NOTIFICATION' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Test notification error:', chrome.runtime.lastError);
          setTestNotificationState('error');
          setNotificationError(chrome.runtime.lastError.message || 'Unknown error');
        } else if (response?.sent) {
          setTestNotificationState('sent');
          setNotificationError(null);
        } else {
          setTestNotificationState('error');
          setNotificationError(response?.error || 'Notification was not displayed');
        }
        // Reset state after 5 seconds (longer for error messages)
        setTimeout(() => {
          setTestNotificationState('idle');
          setNotificationError(null);
        }, 5000);
      });
    }
  };

  const handleForceSync = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      setAlarmStatus(null); // Show loading state
      chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }, () => {
        if (chrome.runtime.lastError) {
          console.error('Sync error:', chrome.runtime.lastError);
        }
        // Fetch updated status after sync
        setTimeout(fetchAlarmStatus, 300);
      });
    }
  };

  const formatTimeUntilFire = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return 'calculating...';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const reminderPresets = [15, 30, 45, 60, 90, 120];

  const themeOptions: Theme[] = ['fast-wellness', 'calm', 'energizer'];

  return (
    <div className="space-y-6 pb-6">
      {/* Theme + Reminders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Selection */}
        <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-foreground text-lg font-bold mb-4">Theme</h2>
          <div className="flex gap-3">
            {themeOptions.map((theme) => {
              const colors = themes[theme];
              const isSelected = settings.theme === theme;
              return (
                <button
                  key={theme}
                  onClick={() => onUpdateSettings({ ...settings, theme })}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5 active:scale-95'
                  }`}
                  title={getThemeDisplayName(theme)}
                >
                  <div className="w-full h-16 rounded mb-2 flex items-center justify-center gap-2" style={{ backgroundColor: colors.primary }}>
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: colors.accent }} />
                  </div>
                  <p className="text-foreground text-sm font-medium">{getThemeDisplayName(theme)}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reminders */}
        <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-foreground text-lg font-bold mb-4">Reminders</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <label className="text-foreground font-medium">
              Enable reminders
            </label>
            <Switch.Root
              checked={settings.remindersEnabled}
              onCheckedChange={checked =>
                onUpdateSettings({ ...settings, remindersEnabled: checked })
              }
              className="relative w-14 h-8 rounded-full transition-colors duration-200 data-[state=checked]:bg-primary data-[state=unchecked]:bg-[var(--switch-background)] data-[state=checked]:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center overflow-hidden"
              aria-label="Toggle reminders"
            >
              <Switch.Thumb className="switch-thumb block w-6 h-6 bg-background rounded-full shadow-sm transition-transform duration-200 will-change-transform" />
            </Switch.Root>
          </div>

          {settings.remindersEnabled && (
            <div className="p-4 bg-muted rounded-xl animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4">
                <label htmlFor="reminder-interval" className="text-foreground font-medium">
                  Reminder interval
                </label>
                <span className="text-2xl font-bold text-primary">{settings.reminderInterval} min</span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {reminderPresets.map(preset => (
                  <button
                    key={preset}
                    onClick={() => onUpdateSettings({ ...settings, reminderInterval: preset })}
                    className={`py-2.5 px-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium cursor-pointer ${
                      settings.reminderInterval === preset
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95'
                    }`}
                  >
                    {preset} min
                  </button>
                ))}
              </div>

              {/* Alarm Status Indicator */}
              <div className="mt-4 pt-4 border-t border-border">
                {alarmStatus ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {alarmStatus.alarmExists ? (
                          <>
                            <Bell className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Alarm active</span>
                          </>
                        ) : (
                          <>
                            <BellOff className="w-4 h-4 text-amber-600" />
                            <span className="text-sm text-amber-600 font-medium">Alarm not set</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleForceSync}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        title="Force sync alarm"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Sync
                      </button>
                    </div>
                    {alarmStatus.alarmExists && alarmStatus.nextFireIn !== null && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Next reminder in: <strong className="text-foreground">{formatTimeUntilFire(alarmStatus.nextFireIn)}</strong></span>
                      </div>
                    )}
                    {!alarmStatus.hasNotificationPermission && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Notification permission not granted</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Checking alarm status...</span>
                  </div>
                )}
              </div>

              {/* Test Notification Button */}
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={testNotificationState === 'sending'}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    testNotificationState === 'sending' 
                      ? 'text-muted-foreground cursor-wait'
                      : testNotificationState === 'sent'
                      ? 'text-green-600'
                      : testNotificationState === 'error'
                      ? 'text-red-600'
                      : 'text-primary hover:text-primary/80'
                  }`}
                >
                  {testNotificationState === 'sending' && (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  )}
                  {testNotificationState === 'sent' && (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Notification sent!
                    </>
                  )}
                  {testNotificationState === 'error' && (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      Failed to send
                    </>
                  )}
                  {testNotificationState === 'idle' && (
                    <>
                      <Bell className="w-4 h-4" />
                      Send a test reminder now
                    </>
                  )}
                </button>
                {notificationError && (
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <p className="font-medium mb-1">Notification blocked</p>
                    <p>{notificationError}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Preferred Duration */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-foreground text-lg font-bold mb-4">Session Duration</h2>

        <div className="flex gap-3">
          {[1, 2, 3].map(duration => (
            <button
              key={duration}
              onClick={() => onUpdateSettings({ ...settings, preferredDuration: duration })}
              className={`flex-1 py-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                settings.preferredDuration === duration
                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                  : 'border-border text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{duration}</div>
              <div className="text-xs font-medium">minute{duration !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-foreground text-lg font-bold mb-4">About</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Stretchly is a moment-based, micro-mobility system designed for desk workers who need
          instant relief without leaving their workspace. Each routine is 60-180 seconds,
          chair-only, and office-safe.
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-3 px-4 bg-muted rounded-lg">
            <span className="text-muted-foreground">Version</span>
            <span className="text-foreground font-semibold">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-3 px-4 bg-muted rounded-lg">
            <span className="text-muted-foreground">Exercise library</span>
            <span className="text-foreground font-semibold">18 exercises</span>
          </div>
          <div className="flex justify-between items-center py-3 px-4 bg-muted rounded-lg">
            <span className="text-muted-foreground">Focus areas</span>
            <span className="text-foreground font-semibold">6 pain zones</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-foreground font-semibold">Tips</h3>
        </div>
        <ul className="space-y-2 text-sm text-foreground">
          <li>Consistency beats intensity — short daily sessions are more effective</li>
          <li>Listen to your body — never push through sharp pain</li>
          <li>Regular breaks improve focus and productivity</li>
        </ul>
      </div>

      {/* Data Management */}
      <div className="bg-card rounded-xl p-6 shadow-sm border-2 border-red-100 dark:border-red-900/30">
        <h2 className="text-foreground text-lg font-bold mb-4">Data Management</h2>

        {!showClearConfirm ? (
          <>
            <button
              onClick={handleClearData}
              className="w-full bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 py-4 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-95 transition-all duration-200 border-2 border-red-200 dark:border-red-800 font-semibold shadow-sm hover:shadow-md"
            >
              Clear All Relief Data
            </button>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              This will permanently delete all your relief tracking and cannot be undone.
            </p>
          </>
        ) : (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2" role="alertdialog" aria-modal="true" aria-labelledby="clear-confirm-title">
            <p id="clear-confirm-title" className="text-foreground font-medium text-center">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                ref={clearCancelRef}
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-muted text-foreground rounded-lg hover:bg-primary/10 active:scale-95 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all duration-200 font-semibold shadow-md"
              >
                Delete all data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}