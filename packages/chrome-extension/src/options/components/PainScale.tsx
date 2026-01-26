import type { ReactNode } from 'react';

interface PainScaleProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  /** 'mild-severe' | 'no-pain-severe' | 'before-after' */
  variant?: 'mild-severe' | 'no-pain-severe' | 'before-after';
  beforeValue?: number;
  /** Optional second line e.g. "Before" / "After" */
  sublabel?: ReactNode;
  className?: string;
  /** Optional ID for range input */
  id?: string;
  /** Whether the pain scale is disabled */
  disabled?: boolean;
  /** Optional ID of element that describes the scale (e.g. "1 = mild, 10 = severe") */
  ariaDescribedBy?: string;
}

const steps = (min: number, max: number) => {
  const arr: number[] = [];
  for (let i = min; i <= max; i++) arr.push(i);
  return arr;
};

/** Segment color by level: low = teal, mid = amber, high = red */
function segmentColor(level: number, min: number, max: number, isSelected: boolean) {
  if (!isSelected) return 'bg-muted';
  const span = max - min || 1;
  const t = (level - min) / span;
  if (t <= 1 / 3) return 'bg-primary'; // teal
  if (t <= 2 / 3) return 'bg-amber-400';
  return 'bg-red-400';
}

export function PainScale({
  value,
  onChange,
  min = 1,
  max = 10,
  label = 'Pain level',
  variant = 'mild-severe',
  beforeValue,
  sublabel,
  className = '',
  id,
  disabled = false,
  ariaDescribedBy,
}: PainScaleProps) {
  const levels = steps(min, max);
  const isBeforeAfter = variant === 'before-after';

  const isCompact = className.includes('compact');
  
  return (
    <div className={className}>
      <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <label htmlFor={id} className={`text-foreground font-semibold ${isCompact ? 'text-sm' : 'text-base'}`}>
          {label}
        </label>
        <span className={`font-bold text-primary ${isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}>
          {value}/{max}
        </span>
      </div>

      {isBeforeAfter && beforeValue != null && (
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Before</p>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-red-50 border-2 border-red-200 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-lg md:text-xl font-bold">{beforeValue}</span>
            </div>
          </div>
          <div className="text-xl md:text-2xl text-disabled-foreground" aria-hidden="true">→</div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2 font-medium">After</p>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 border-2 border-primary/30 rounded-full flex items-center justify-center">
              <span className="text-primary text-lg md:text-xl font-bold">{value}</span>
            </div>
          </div>
        </div>
      )}

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className={`w-full h-2.5 bg-[var(--switch-background)] rounded-lg appearance-none ${isCompact ? 'mb-2' : 'mb-3'} ${
          disabled 
            ? 'cursor-not-allowed opacity-50' 
            : 'cursor-pointer accent-primary'
        }`}
        aria-label={label}
        aria-disabled={disabled}
        {...(ariaDescribedBy && { 'aria-describedby': ariaDescribedBy })}
      />

      <div className={`flex items-center gap-1.5 ${isCompact ? 'mb-1.5' : 'mb-2'}`}>
        {levels.map(level => (
          <button
            key={level}
            type="button"
            onClick={() => !disabled && onChange(level)}
            disabled={disabled}
            className={`flex-1 ${isCompact ? 'h-5' : 'h-6'} rounded transition-all ${
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            } ${
              level <= value
                ? segmentColor(level, min, max, true)
                : 'bg-muted'
            } ${level === value ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            aria-label={`${label} ${level}`}
            aria-disabled={disabled}
          />
        ))}
      </div>

      {variant === 'mild-severe' && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Mild</span>
          <span>Moderate</span>
          <span>Severe</span>
        </div>
      )}
      {(variant === 'no-pain-severe' || (variant === 'before-after' && min === 0)) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>No pain</span>
          <span>Severe</span>
        </div>
      )}
      {sublabel && <div className="text-sm text-muted-foreground mt-2">{sublabel}</div>}
    </div>
  );
}
