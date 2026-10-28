import type { ColorMode, ReliefEntry, UserSettings } from '@stretchly/shared';
import { exercises, LOCALES, painRoutines } from '@stretchly/shared';
import * as Switch from '@radix-ui/react-switch';
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getThemeColors, getThemeDescription, getThemeDisplayName, THEME_OPTIONS } from '../../utils/themes';
import { sendMessage, type AlarmStatus } from '../../utils/runtime';
import { sanitizeRelief } from '../../storage/chromeStorage';
import { toDateKey } from '../utils/formatDate';
import { chime } from '../../utils/chime';
import { getLocale, t, tp, type MessageKey } from '../../i18n';
import { tNode } from '../../i18n/react';

interface SettingsProps {
  settings: UserSettings;
  reliefData: ReliefEntry[];
  /** Merges the patch into the latest settings (safe for rapid successive changes). */
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onClearRelief: () => void | Promise<void>;
  /** Replaces the whole history with imported entries. */
  onImportRelief: (entries: ReliefEntry[]) => void;
}

const REMINDER_PRESETS = [15, 30, 45, 60, 90, 120];
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const COLOR_MODES: { mode: ColorMode; label: MessageKey }[] = [
  { mode: 'system', label: 'settings.colorSystem' },
  { mode: 'light', label: 'settings.colorLight' },
  { mode: 'dark', label: 'settings.colorDark' },
];
const VERSION =
  typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : '';

function formatDuration(seconds: number): string {
  if (seconds < 60) return t('duration.s', { s: seconds });
  const mins = Math.round(seconds / 60);
  if (mins < 60) return t('duration.min', { m: mins });
  const h = Math.floor(mins / 60);
  return mins % 60 ? t('duration.hMin', { h, m: mins % 60 }) : t('duration.h', { h });
}

const intervalLabel = (m: number) =>
  m < 60 ? tp('settings.everyMinutes', m) : m === 60 ? t('settings.everyHour') : tp('settings.everyHours', m / 60);
/** Hour of day in the locale's own clock (12- or 24-hour). */
const hourLabel = (h: number) =>
  h === 0 || h === 24
    ? t('settings.midnight')
    : h === 12
      ? t('settings.noon')
      : new Date(2024, 0, 1, h).toLocaleTimeString(getLocale(), { hour: 'numeric' });

const button = 'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted';
const select =
  'h-9 rounded-md border border-border bg-input pl-3 pr-8 text-sm outline-none transition-colors focus:border-primary';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-8">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 divide-y divide-border border-y border-border">{children}</div>
    </section>
  );
}

/** Label and hint on the left, control on the right; stacks when narrow. */
function Row({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4">
      <div className="min-w-0 max-w-md">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {hint && <div className="mt-0.5 text-sm text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-switch-background transition-colors data-[state=checked]:bg-primary"
    >
      <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </Switch.Root>
  );
}

export function Settings({ settings, reliefData, onUpdateSettings, onClearRelief, onImportRelief }: SettingsProps) {
  const [alarm, setAlarm] = useState<AlarmStatus | null>(null);
  const [alarmUnavailable, setAlarmUnavailable] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dataNote, setDataNote] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ReliefEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = onUpdateSettings;
  const sessionCount = reliefData.length;

  const fetchAlarm = useCallback(() => {
    sendMessage<AlarmStatus>({ type: 'GET_ALARM_STATUS' })
      .then((s) => {
        if (s) setAlarm(s);
        setAlarmUnavailable(!s);
      })
      .catch(() => setAlarmUnavailable(true));
  }, []);

  // Refresh after settings change (give the background a moment to resync), then every 30s.
  useEffect(() => {
    if (!settings.remindersEnabled) return;
    const timeout = setTimeout(fetchAlarm, 400);
    const interval = setInterval(fetchAlarm, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchAlarm, settings.remindersEnabled, settings.reminderInterval, settings.activeFrom, settings.activeTo, settings.weekdaysOnly]);

  const resync = () => {
    sendMessage({ type: 'SYNC_REMINDERS' })
      .catch((err) => console.error('Sync error:', err))
      .finally(() => setTimeout(fetchAlarm, 300));
  };

  const sendTest = () => {
    setTestState('sending');
    setTestError(null);
    sendMessage<{ sent?: boolean; error?: string }>({ type: 'TEST_NOTIFICATION' })
      .then((res) => {
        if (res?.sent) setTestState('sent');
        else {
          setTestState('error');
          setTestError(res?.error || t('settings.testNotShown'));
        }
      })
      .catch((err: Error) => {
        setTestState('error');
        setTestError(err.message);
      })
      .finally(() =>
        setTimeout(() => {
          setTestState('idle');
          setTestError(null);
        }, 5000)
      );
  };

  const flash = (note: string) => {
    setDataNote(note);
    setTimeout(() => setDataNote(null), 4000);
  };

  const clearData = async () => {
    await onClearRelief();
    setConfirmClear(false);
    flash(t('settings.historyDeleted'));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'stretchly', version: 1, sessions: reliefData }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stretchly-history-${toDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const readImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const entries = sanitizeRelief(Array.isArray(parsed) ? parsed : parsed?.sessions);
      if (entries.length === 0) {
        flash(t('settings.importEmpty'));
        return;
      }
      setPendingImport(entries);
    } catch {
      flash(t('settings.importInvalid'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  let status: ReactNode;
  if (!alarm) {
    status = alarmUnavailable ? t('settings.statusUnavailable') : t('settings.checking');
  } else if (!alarm.hasNotificationPermission) {
    status = <span className="text-warning">{t('settings.notificationsOff')}</span>;
  } else if (alarm.alarmExists) {
    status = (
      <>
        {tNode('settings.nextReminder', {
          time: (
            <span className="text-foreground">
              {alarm.nextFireIn != null && alarm.nextFireIn >= 0 ? formatDuration(alarm.nextFireIn) : t('settings.aMoment')}
            </span>
          ),
        })}
        {!alarm.withinActiveHours && ` ${t('settings.outsideHours')}`}
      </>
    );
  } else {
    status = (
      <span className="text-warning">
        {t('settings.noReminder')}{' '}
        <button type="button" onClick={resync} className="underline underline-offset-2">
          {t('settings.scheduleIt')}
        </button>
      </span>
    );
  }

  const testLabel = t(
    ({ idle: 'settings.testIdle', sending: 'settings.testSending', sent: 'settings.testSent', error: 'settings.testError' } as const)[
      testState
    ]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{t('nav.settings')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('settings.saved')}</p>

      <Section title={t('settings.reminders')}>
        <Row label={t('settings.stretchReminders')} hint={t('settings.stretchRemindersHint')} htmlFor="reminders-switch">
          <Toggle id="reminders-switch" checked={settings.remindersEnabled} onChange={(v) => update({ remindersEnabled: v })} />
        </Row>

        {settings.remindersEnabled && (
          <>
            <Row label={t('settings.interval')} htmlFor="reminder-interval">
              <select
                id="reminder-interval"
                value={settings.reminderInterval}
                onChange={(e) => update({ reminderInterval: Number(e.target.value) })}
                className={select}
              >
                {REMINDER_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    {intervalLabel(m)}
                  </option>
                ))}
              </select>
            </Row>
            <Row label={t('settings.reminderHours')} hint={t('settings.reminderHoursHint')} htmlFor="active-from">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <select
                  id="active-from"
                  aria-label={t('settings.from')}
                  value={settings.activeFrom}
                  onChange={(e) => update({ activeFrom: Number(e.target.value) })}
                  className={select}
                >
                  {HOURS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
                {t('settings.hoursTo')}
                <select
                  aria-label={t('settings.until')}
                  value={settings.activeTo}
                  onChange={(e) => update({ activeTo: Number(e.target.value) })}
                  className={select}
                >
                  {HOURS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
            </Row>
            <Row label={t('settings.weekdaysOnly')} hint={t('settings.weekdaysOnlyHint')} htmlFor="weekdays-switch">
              <Toggle id="weekdays-switch" checked={settings.weekdaysOnly} onChange={(v) => update({ weekdaysOnly: v })} />
            </Row>
            <Row
              label={t('settings.status')}
              hint={
                <>
                  <span aria-live="polite">{status}</span>
                  {testError && <span className="block text-destructive">{testError}</span>}
                </>
              }
            >
              <button
                type="button"
                onClick={sendTest}
                disabled={testState === 'sending'}
                className={`${button} disabled:cursor-wait ${
                  testState === 'sent' ? 'text-success' : testState === 'error' ? 'text-destructive' : ''
                }`}
              >
                {testLabel}
              </button>
            </Row>
          </>
        )}
      </Section>

      <Section title={t('settings.routines')}>
        <Row label={t('settings.soundCues')} hint={t('settings.soundCuesHint')} htmlFor="sound-switch">
          <div className="flex items-center gap-3">
            {settings.soundCues && (
              <button type="button" onClick={() => chime('start')} className="text-sm text-muted-foreground hover:text-foreground">
                {t('settings.playSample')}
              </button>
            )}
            <Toggle id="sound-switch" checked={settings.soundCues} onChange={(v) => update({ soundCues: v })} />
          </div>
        </Row>
      </Section>

      <Section title={t('settings.appearance')}>
        <Row label={t('settings.language')} hint={t('settings.languageHint')} htmlFor="language">
          <select
            id="language"
            value={settings.language}
            onChange={(e) => update({ language: e.target.value as UserSettings['language'] })}
            className={select}
          >
            <option value="auto">{`🌐\u2002${t('settings.matchBrowser')}`}</option>
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {`${l.flag}\u2002${l.name}`}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('settings.colorMode')} hint={t('settings.colorModeHint')}>
          <div
            className="inline-flex divide-x divide-border rounded-md border border-border"
            role="radiogroup"
            aria-label={t('settings.colorMode')}
          >
            {COLOR_MODES.map(({ mode, label }) => {
              const active = settings.colorMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ colorMode: mode })}
                  className={`px-3 py-1.5 text-sm transition-colors first:rounded-l-md last:rounded-r-md ${
                    active ? 'bg-muted font-medium text-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(label)}
                </button>
              );
            })}
          </div>
        </Row>
        <div className="py-4">
          <p className="text-sm font-medium" id="theme-label">
            {t('settings.theme')}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.themeHint')}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="theme-label">
            {THEME_OPTIONS.map((theme) => {
              const active = settings.theme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ theme })}
                  className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                    active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  {/* Page, brand and call-to-action colors; light mode then dark mode. */}
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    {(['light', 'dark'] as const).map((mode) => {
                      const c = getThemeColors(theme, mode);
                      return (
                        <span key={mode} className="flex overflow-hidden rounded-sm border border-border">
                          <span className="h-7 w-3" style={{ backgroundColor: c.background }} />
                          <span className="h-7 w-3" style={{ backgroundColor: c.primary }} />
                          <span className="h-7 w-3" style={{ backgroundColor: c.accent }} />
                        </span>
                      );
                    })}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{getThemeDisplayName(theme)}</span>
                    <span className="block text-xs text-muted-foreground">{getThemeDescription(theme)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title={t('settings.data')}>
        <Row label={t('settings.backup')} hint={t('settings.backupHint')}>
          <div className="flex gap-2">
            <button type="button" onClick={exportData} disabled={sessionCount === 0} className={`${button} disabled:opacity-40`}>
              {t('settings.export')}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className={button}>
              {t('settings.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readImport(file);
              }}
            />
          </div>
        </Row>
        {pendingImport && (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <p>
              {sessionCount
                ? t('settings.replacePrompt', {
                    current: tp('count.sessions', sessionCount),
                    incoming: tp('count.sessions', pendingImport.length),
                  })
                : t('settings.replacePromptEmpty', { incoming: tp('count.sessions', pendingImport.length) })}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPendingImport(null)} className={button}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onImportRelief(pendingImport);
                  flash(t('settings.imported', { sessions: tp('count.sessions', pendingImport.length) }));
                  setPendingImport(null);
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                {t('settings.replace')}
              </button>
            </div>
          </div>
        )}
        <Row
          label={t('settings.history')}
          hint={
            dataNote ??
            (sessionCount === 0
              ? t('settings.historyEmpty')
              : t('settings.historyCount', { sessions: tp('count.sessions', sessionCount) }))
          }
        >
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t('settings.deleteConfirm', { sessions: tp('count.sessions', sessionCount) })}
              </span>
              <button type="button" onClick={() => setConfirmClear(false)} className={button}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void clearData()}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90"
              >
                {t('common.delete')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={sessionCount === 0}
              className={`${button} text-destructive disabled:opacity-40`}
            >
              {t('settings.deleteHistory')}
            </button>
          )}
        </Row>
      </Section>

      <Section title={t('settings.about')}>
        <div className="py-4 text-sm">
          <p className="max-w-prose text-muted-foreground">{t('settings.aboutBody')}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
            <dt>
              <kbd>Alt</kbd> + {tNode('settings.keyRange', { from: <kbd>1</kbd>, to: <kbd>4</kbd> })}
            </dt>
            <dd>{t('settings.keySections')}</dd>
            <dt>
              <kbd>{t('key.space')}</kbd>
            </dt>
            <dd>{t('settings.keyPause')}</dd>
            <dt>
              <kbd>←</kbd> <kbd>→</kbd>
            </dt>
            <dd>{t('settings.keyStep')}</dd>
            <dt>
              <kbd>Esc</kbd>
            </dt>
            <dd>{t('settings.keyLeave')}</dd>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            {VERSION && <>{t('settings.version', { version: VERSION })} · </>}
            {tp('count.exercises', exercises.length)} · {tp('count.areas', Object.keys(painRoutines).length)}
          </p>
        </div>
      </Section>
    </div>
  );
}
