/**
 * Humanize ISO date (YYYY-MM-DD) for display.
 * Returns "Today", "Yesterday", or "Mon Jan 24".
 */
export function formatReliefDate(iso: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (iso === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (iso === yesterdayStr) return 'Yesterday';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format pain area key for display, e.g. "upperBack" → "Upper back".
 */
export function formatPainArea(area: string): string {
  return area
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s/, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
