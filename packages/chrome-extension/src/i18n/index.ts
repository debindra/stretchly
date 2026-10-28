import { LOCALES, resolveLocale, type Locale, type UserSettings } from '@stretchly/shared';
import { en, type MessageKey } from './messages/en';
import type { Messages, PluralBase } from './types';
import { es } from './messages/es';
import { it } from './messages/it';
import { tr } from './messages/tr';
import { ru } from './messages/ru';
import { zh } from './messages/zh';
import { hi } from './messages/hi';
import { pl } from './messages/pl';
import { ko } from './messages/ko';
import { fr } from './messages/fr';

export type { MessageKey } from './messages/en';
export type { Messages, PluralBase } from './types';

const catalogs: Record<Locale, Messages> = { en, es, it, tr, ru, zh, hi, pl, ko, fr };

type Vars = Record<string, string | number>;

// One active locale per page or worker; set from settings before rendering or notifying.
let current: Locale = browserLocale();

/** The locale Chrome's UI is in (or the page's navigator language outside the extension). */
export function browserLocale(): Locale {
  const tag =
    typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : typeof navigator !== 'undefined'
        ? navigator.language
        : undefined;
  return resolveLocale(tag);
}

/** Locale for the `language` setting; 'auto' (or anything unrecognised) follows the browser. */
export function localeFromSetting(language: UserSettings['language'] | undefined): Locale {
  if (!language || language === 'auto') return browserLocale();
  return LOCALES.some((l) => l.code === language) ? language : browserLocale();
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Message in the active locale, English if it has none, with `{name}` placeholders filled. */
export function t(key: MessageKey, vars?: Vars): string {
  return format(catalogs[current][key] ?? en[key], vars);
}

/** Like `t` for keys built at runtime; returns undefined when English has no such key. */
export function tMaybe(key: string, vars?: Vars): string | undefined {
  return key in en ? t(key as MessageKey, vars) : undefined;
}

/** Plural message for `count`, e.g. tp('count.sessions', 3) → "3 sessions". `{count}` is filled in. */
export function tp(base: PluralBase, count: number, vars?: Vars): string {
  const all = { count: formatNumber(count), ...vars };
  const own = catalogs[current] as Record<string, string | undefined>;
  const form = new Intl.PluralRules(current).select(count);
  const text =
    own[`${base}.${form}`] ??
    own[`${base}.other`] ??
    (en as Record<string, string>)[`${base}.${new Intl.PluralRules('en').select(count)}`] ??
    en[`${base}.other` as MessageKey];
  return format(text, all);
}

/** Number in the active locale; `digits` fixes the decimals (1 → "2.5" / "2,5"). */
export function formatNumber(n: number, digits?: number): string {
  return n.toLocaleString(current, digits == null ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "A, B, C" with the active locale's separator (Intl.ListFormat's unit lists drop commas in many locales). */
export function formatList(items: string[]): string {
  return items.join(t('common.listSeparator'));
}

// Animation captions are authored as English text in the clip files; map them back to their keys.
let cueKeys: Map<string, MessageKey> | null = null;

/** Animation caption in the active locale; captions without a message stay as authored. */
export function translateCue(text: string): string {
  if (!cueKeys) {
    cueKeys = new Map();
    for (const key of Object.keys(en) as MessageKey[]) if (key.startsWith('cue.')) cueKeys.set(en[key], key);
  }
  const key = cueKeys.get(text);
  return key ? t(key) : text;
}
