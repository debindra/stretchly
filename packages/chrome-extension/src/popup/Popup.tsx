import { useEffect, useState } from 'react';
import type { Locale, View } from '@stretchly/shared';
import { LogoImg } from '../components/LogoImg';
import { chromeStorageAdapter } from '../storage/chromeStorage';
import { applyTheme } from '../utils/themes';
import { openOptionsTab } from '../utils/openOptions';
import { optionsHash, PAIN_AREA_INFO, type PainArea } from '../utils/painAreas';
import { computeStreak } from '../options/utils/stats';
import { getLocale, localeFromSetting, setLocale, t, tp, type MessageKey } from '../i18n';

function open(view: View, area?: PainArea) {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;
  openOptionsTab(optionsHash(view, area))
    .catch(() => chrome.runtime.openOptionsPage?.())
    .finally(() => window.close());
}

const LINKS: { view: View; label: MessageKey }[] = [
  { view: 'library', label: 'nav.library' },
  { view: 'progress', label: 'nav.progress' },
  { view: 'settings', label: 'nav.settings' },
];

export function Popup() {
  const [streak, setStreak] = useState<number | null>(null);
  // Starts as the browser language; re-renders once the saved language setting is read.
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  useEffect(() => {
    chromeStorageAdapter
      .getSettings()
      .then((s) => {
        applyTheme(s.theme, s.colorMode);
        const next = localeFromSetting(s.language);
        setLocale(next);
        document.documentElement.lang = next;
        setLocaleState(next);
      })
      .catch(() => {});
    chromeStorageAdapter
      .getRelief()
      .then((r) => setStreak(computeStreak(r)))
      .catch(() => {});
  }, []);

  return (
    <div className="w-[340px] bg-background text-foreground" lang={locale}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <LogoImg height={20} />
        {streak != null && streak > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{tp('count.dayStreak', streak)}</span>
        )}
      </header>

      <div className="px-4 pb-4 pt-3">
        <h1 className="text-sm font-medium">{t('common.whereDoesItHurt')}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('popup.subtitle')}</p>

        {/* One click from the toolbar straight to that area's routine. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {PAIN_AREA_INFO.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => open('dashboard', a.key)}
              className="overflow-hidden rounded-md border border-border bg-card text-left transition-colors hover:border-muted-foreground"
            >
              <span className="block aspect-[4/3] w-full border-b border-border bg-muted">
                <img src={a.icon} alt="" width={480} height={360} className="h-full w-full object-contain p-1.5" />
              </span>
              <span className="block truncate px-2 py-1.5 text-xs font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <nav className="flex divide-x divide-border border-t border-border" aria-label={t('popup.more')}>
        {LINKS.map(({ view, label }) => (
          <button
            key={view}
            type="button"
            onClick={() => open(view)}
            className="flex-1 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t(label)}
          </button>
        ))}
      </nav>
    </div>
  );
}
