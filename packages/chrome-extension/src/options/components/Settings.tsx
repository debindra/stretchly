import type { UserSettings, Theme } from '@stretchly/shared';
import * as Switch from '@radix-ui/react-switch';
import { Lightbulb } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getThemeDisplayName, themes } from '../../utils/themes';

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
                  className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 active:scale-95'
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