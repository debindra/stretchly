import { getLocale, t, tMaybe } from '../../i18n';
import { isPainArea } from '../../utils/painAreas';

/**
 * Local calendar date as YYYY-MM-DD. Use this instead of toISOString(),
 * which returns the UTC date and is off by one day in many timezones.
 */
export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Humanize ISO date (YYYY-MM-DD) for display.
 * Returns "Today", "Yesterday", or "Mon, Jan 24"; `inline` gives the mid-sentence "today" / "yesterday".
 */
export function formatReliefDate(iso: string, inline = false): string {
  if (iso === toDateKey()) return t(inline ? 'date.todayInline' : 'date.today');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toDateKey(yesterday)) return t(inline ? 'date.yesterdayInline' : 'date.yesterday');
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(getLocale(), { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format a session's area key for display, e.g. "upperBack" → "Upper Back".
 * General routines ("deskReset") use their own names instead. `inline` gives the mid-sentence form.
 */
export function formatPainArea(area: string, inline = false): string {
  if (isPainArea(area) || area === 'custom') return t(inline ? `painArea.${area}.inline` : `painArea.${area}`);
  const general = tMaybe(`routine.${area}`);
  if (general) return general;
  return area
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s/, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Seconds as prose: "48 s", "2 min", "1 min 30 s". */
export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return t('duration.s', { s });
  return s ? t('duration.minS', { m, s }) : t('duration.min', { m });
}
