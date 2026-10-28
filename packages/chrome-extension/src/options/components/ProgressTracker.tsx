import { useMemo, useState } from 'react';
import type { ReliefEntry } from '@stretchly/shared';
import { formatPainArea, formatReliefDate, toDateKey } from '../utils/formatDate';
import { computeStreak } from '../utils/stats';
import { formatNumber, getLocale, t, tp, type MessageKey } from '../../i18n';
import { useLocale } from '../../i18n/react';

interface ProgressTrackerProps {
  reliefData: ReliefEntry[];
  onNavigateToDashboard?: () => void;
}

const DAYS = 30;
const RECENT = 8;
const WINDOW = 28;

function heatColor(count: number) {
  if (count === 0) return 'bg-muted';
  if (count === 1) return 'bg-primary/40';
  if (count === 2) return 'bg-primary/70';
  return 'bg-primary';
}

function signed(n: number): string {
  if (n > 0) return `−${formatNumber(n)}`;
  if (n < 0) return `+${formatNumber(-n)}`;
  return formatNumber(0);
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function daysAgo(iso: string): number {
  const then = new Date(iso + 'T12:00:00').getTime();
  const today = new Date(toDateKey() + 'T12:00:00').getTime();
  return Math.round((today - then) / 86_400_000);
}

function partOfDay(time: string): MessageKey {
  const h = Number(time.slice(0, 2));
  if (h < 12) return 'progress.insightMornings';
  if (h < 17) return 'progress.insightAfternoons';
  return 'progress.insightEvenings';
}

/** One decimal, in the active locale. */
const one = (n: number) => formatNumber(n, 1);

/** Narrow weekday initials, Sunday first, to head the calendar columns. */
function weekdayInitials(): string[] {
  const fmt = new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow' });
  // 2024-01-07 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
}

/** Sessions where the user rated how they felt afterwards; only these say anything about relief. */
const isRated = (r: ReliefEntry) => r.rated !== false;

export function ProgressTracker({ reliefData, onNavigateToDashboard }: ProgressTrackerProps) {
  const [showAll, setShowAll] = useState(false);
  const locale = useLocale();

  const stats = useMemo(() => {
    const countByDate = new Map<string, number>();
    for (const r of reliefData) countByDate.set(r.date, (countByDate.get(r.date) ?? 0) + 1);

    const rated = reliefData.filter(isRated);
    const reliefs = rated.map((r) => r.beforePain - r.afterPain);

    // Per area: frequency, relief, and how starting ratings moved between the last 4 weeks and the 4 before.
    const byArea = new Map<string, ReliefEntry[]>();
    for (const r of reliefData) byArea.set(r.painArea, [...(byArea.get(r.painArea) ?? []), r]);
    const areas = [...byArea.entries()]
      .map(([area, entries]) => {
        const ratedEntries = entries.filter(isRated);
        const recent = average(entries.filter((r) => daysAgo(r.date) < WINDOW).map((r) => r.beforePain));
        const earlier = average(
          entries.filter((r) => daysAgo(r.date) >= WINDOW && daysAgo(r.date) < WINDOW * 2).map((r) => r.beforePain)
        );
        return {
          area,
          count: entries.length,
          avgBefore: average(entries.map((r) => r.beforePain)) ?? 0,
          avgRelief: average(ratedEntries.map((r) => r.beforePain - r.afterPain)),
          trend: recent != null && earlier != null ? recent - earlier : null,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Last 30 days, padded so columns line up with weekdays (Sun first).
    const today = toDateKey();
    const start = new Date();
    start.setDate(start.getDate() - (DAYS - 1));
    const cells: ({ key: string; label: string; count: number; isToday: boolean } | null)[] = Array.from(
      { length: start.getDay() },
      () => null
    );
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toDateKey(d);
      cells.push({
        key,
        label: d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
        count: countByDate.get(key) ?? 0,
        isToday: key === today,
      });
    }

    // One sentence on what stands out, built only from facts the data supports.
    const insights: string[] = [];
    const top = areas[0];
    if (top && top.count >= 2 && top.area !== 'custom') {
      insights.push(
        t('progress.insightTop', {
          area: formatPainArea(top.area),
          sessions: tp('count.sessions', top.count),
          average: one(top.avgBefore),
        })
      );
    }
    const improving = areas.find((a) => a.trend != null && a.trend <= -1);
    if (improving) {
      insights.push(
        t('progress.insightImproving', { area: formatPainArea(improving.area), diff: one(Math.abs(improving.trend!)) })
      );
    }
    const timed = reliefData.filter((r) => r.time);
    if (timed.length >= 5) {
      const counts = new Map<MessageKey, number>();
      for (const r of timed) counts.set(partOfDay(r.time!), (counts.get(partOfDay(r.time!)) ?? 0) + 1);
      const [part, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (n / timed.length >= 0.5) insights.push(t(part));
    }

    return {
      streak: computeStreak(reliefData),
      total: reliefData.length,
      avgRelief: average(reliefs),
      cells,
      activeDays: cells.filter((c) => c && c.count > 0).length,
      areas,
      maxAreaCount: Math.max(1, ...areas.map((a) => a.count)),
      insights,
      history: [...reliefData].reverse(),
    };
  }, [reliefData, locale]);

  if (reliefData.length === 0) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">{t('nav.progress')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('progress.empty')}</p>
        {onNavigateToDashboard && (
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            {t('progress.startRoutine')}
          </button>
        )}
      </div>
    );
  }

  const figures = [
    { label: t('progress.streak'), value: tp('count.days', stats.streak) },
    { label: t('progress.sessions'), value: formatNumber(stats.total) },
    {
      label: t('progress.averageRelief'),
      value: stats.avgRelief == null ? t('progress.notAvailable') : t('progress.points', { value: one(stats.avgRelief) }),
    },
  ];
  const rows = showAll ? stats.history : stats.history.slice(0, RECENT);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('nav.progress')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('progress.intro')}</p>

      <dl className="mt-6 grid max-w-lg grid-cols-3 gap-6 border-y border-border py-4">
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      {stats.insights.length > 0 && <p className="mt-4 max-w-2xl text-sm">{stats.insights.join(' ')}</p>}

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">{t('progress.last30Days')}</h2>
            <span className="text-xs text-muted-foreground">{tp('count.activeDays', stats.activeDays)}</span>
          </div>
          <div className="mt-3 grid w-fit grid-cols-[repeat(7,1.75rem)] gap-1">
            {weekdayInitials().map((d, i) => (
              <div key={i} className="text-center text-[11px] text-muted-foreground">
                {d}
              </div>
            ))}
            {stats.cells.map((c, i) =>
              c ? (
                <div
                  key={c.key}
                  title={t('progress.dayCell', { date: c.label, sessions: tp('count.sessions', c.count) })}
                  className={`aspect-square rounded-sm ${heatColor(c.count)} ${
                    c.isToday ? 'ring-1 ring-foreground ring-offset-1 ring-offset-background' : ''
                  }`}
                />
              ) : (
                <div key={`pad-${i}`} />
              )
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold">{t('progress.byArea')}</h2>
          <ul className="mt-3 space-y-3">
            {stats.areas.map((a) => (
              <li key={a.area}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{formatPainArea(a.area)}</span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">
                    {tp('count.sessions', a.count)}
                    {a.avgRelief != null && t('progress.areaRelief', { value: one(a.avgRelief) })}
                    {a.trend != null && (
                      <span className={a.trend < 0 ? 'text-success' : a.trend > 0 ? 'text-destructive' : ''}>
                        {t(a.trend < 0 ? 'progress.trendDown' : a.trend > 0 ? 'progress.trendUp' : 'progress.trendFlat', {
                          value: one(Math.abs(a.trend)),
                        })}
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(a.count / stats.maxAreaCount) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{showAll ? t('progress.allSessions') : t('progress.recentSessions')}</h2>
          {stats.history.length > RECENT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {showAll ? t('progress.showRecent') : t('progress.showAll', { count: formatNumber(stats.history.length) })}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">{t('progress.colArea')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('progress.colBefore')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('progress.colAfter')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('progress.colChange')}</th>
                <th className="py-1.5 text-right font-medium">{t('progress.colWhen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {rows.map((r, i) => {
                const relief = r.beforePain - r.afterPain;
                const rated = isRated(r);
                return (
                  <tr key={i} className="transition-colors hover:bg-muted/60">
                    <td className="py-2.5 pr-3">{formatPainArea(r.painArea)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{r.beforePain}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{rated ? r.afterPain : <span className="text-muted-foreground">{t('progress.notRated')}</span>}</td>
                    <td
                      className={`py-2.5 pr-3 tabular-nums ${
                        !rated ? 'text-muted-foreground' : relief > 0 ? 'text-success' : relief < 0 ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {rated ? signed(relief) : ''}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right text-muted-foreground">
                      {formatReliefDate(r.date)}
                      {r.time && <span className="tabular-nums">, {r.time}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
