import type { UserSettings } from '@stretchly/shared';
import * as Switch from '@radix-ui/react-switch';
import { Bell, Clock, Trash2, Info, Lightbulb } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface SettingsProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  onClearRelief: () => void | Promise<void>;
}

export function Settings({ settings, onUpdateSettings, onClearRelief }: SettingsProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const clearCancelRef = useRef<HTMLButtonElement>(null);

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

  const reminderPresets = [1, 15, 30, 45, 60, 90, 120];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Reminders - Enhanced */}
      <div className="bg-card rounded-xl p-6 md:p-7 shadow-sm border border-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-bold">Smart Break Reminders</h2>
            <p className="text-muted-foreground text-sm mt-1">Get notified to take mobility breaks</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <label htmlFor="reminders-toggle" className="text-foreground font-medium cursor-pointer">
              Enable reminders
            </label>
            <Switch.Root
              id="reminders-toggle"
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
                    className={`py-2.5 px-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                      settings.reminderInterval === preset
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border text-foreground hover:border-primary/40 active:scale-95'
                    }`}
                  >
                    {preset} min
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                      chrome.runtime.sendMessage({ type: 'TEST_NOTIFICATION' }, () => {
                        if (chrome.runtime.lastError) {
                          console.error('Test notification error:', chrome.runtime.lastError);
                        }
                      });
                    }
                  }}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Send a test reminder now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preferred Duration - Consistent Colors */}
      <div className="bg-card rounded-xl p-6 md:p-7 shadow-sm border border-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-bold">Preferred Session Duration</h2>
            <p className="text-muted-foreground text-sm mt-1">Default length for quick routines</p>
          </div>
        </div>

        <div className="flex gap-3">
          {[1, 2, 3].map(duration => (
            <button
              key={duration}
              onClick={() => onUpdateSettings({ ...settings, preferredDuration: duration })}
              className={`flex-1 py-4 rounded-lg border-2 transition-all duration-200 ${
                settings.preferredDuration === duration
                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                  : 'border-border text-foreground hover:border-primary/40 active:scale-95'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{duration}</div>
              <div className="text-xs font-medium">minute{duration !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      </div>

      {/* About - Enhanced */}
      <div className="bg-card rounded-xl p-6 md:p-7 shadow-sm border border-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-foreground text-lg font-bold">About Stretchly</h2>
        </div>
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
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-foreground">Maximizing Relief</h3>
        </div>
        <ul className="space-y-3 text-sm text-foreground">
          <li className="flex gap-3">
            <span className="text-primary flex-shrink-0">•</span>
            <span>
              <strong>Consistency beats intensity</strong> — short daily sessions are more
              effective than occasional long workouts
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary flex-shrink-0">•</span>
            <span>
              <strong>Listen to your body</strong> — never push through sharp pain, only gentle
              discomfort
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary flex-shrink-0">•</span>
            <span>
              <strong>Breathe deeply</strong> — slow, deliberate breathing enhances relief
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary flex-shrink-0">•</span>
            <span>
              <strong>Track your pain</strong> — accurate before/after ratings help identify what
              works best for you
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary flex-shrink-0">•</span>
            <span>
              <strong>Productivity link</strong> — regular breaks actually improve focus and output
            </span>
          </li>
        </ul>
      </div>

      {/* Data Management - Enhanced with Confirmation */}
      <div className="bg-card rounded-xl p-4 md:p-6 shadow-sm border-2 border-red-100 dark:border-red-900/30">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-bold">Data Management</h2>
            <p className="text-muted-foreground text-sm mt-1">Manage your stored data</p>
          </div>
        </div>

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