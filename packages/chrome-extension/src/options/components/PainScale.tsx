import { useRef, type KeyboardEvent } from 'react';
import { t } from '../../i18n';

interface PainScaleProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  /** End labels under the scale. */
  variant?: 'mild-severe' | 'no-pain-severe';
  /** Shorter cells for inline use. */
  compact?: boolean;
  className?: string;
  id?: string;
}

function severityWord(level: number): string {
  if (level === 0) return t('pain.none');
  if (level <= 3) return t('pain.mild');
  if (level <= 6) return t('pain.moderate');
  if (level <= 8) return t('pain.strong');
  return t('pain.severe');
}

/**
 * Numeric rating scale (0 or 1 to 10). Behaves as a radio group: click a cell,
 * or focus the current one and use arrow keys / Home / End.
 */
export function PainScale({
  value,
  onChange,
  min = 1,
  max = 10,
  label = t('pain.label'),
  variant = 'mild-severe',
  compact = false,
  className = '',
  id,
}: PainScaleProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const labelId = id ? `${id}-label` : undefined;

  const select = (level: number) => {
    const next = Math.min(max, Math.max(min, level));
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: value + 1,
      ArrowUp: value + 1,
      ArrowLeft: value - 1,
      ArrowDown: value - 1,
      Home: min,
      End: max,
    };
    if (e.key in keys) {
      e.preventDefault();
      e.stopPropagation();
      select(keys[e.key]);
    }
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span id={labelId} className="text-sm font-medium">
          {label}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{value}</span> / {max} · {severityWord(value)}
        </span>
      </div>

      <div
        ref={groupRef}
        id={id}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : label}
        onKeyDown={onKeyDown}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}
      >
        {levels.map((level) => {
          const filled = level <= value;
          const current = level === value;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={current}
              aria-label={t('pain.cell', { level, word: severityWord(level) })}
              data-level={level}
              tabIndex={current ? 0 : -1}
              onClick={() => select(level)}
              className={`rounded-sm border text-xs tabular-nums transition-colors ${compact ? 'h-8' : 'h-10'} ${
                filled
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground'
              } ${current ? 'outline outline-2 outline-offset-2 outline-primary' : ''}`}
            >
              {level}
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{variant === 'mild-severe' ? t('pain.mild') : t('pain.none')}</span>
        <span>{t('pain.severe')}</span>
      </div>
    </div>
  );
}
