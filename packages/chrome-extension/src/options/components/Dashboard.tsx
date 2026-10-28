import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Exercise, ReliefEntry } from '@stretchly/shared';
import { painRoutines } from '@stretchly/shared';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { PainScale } from './PainScale';
import { ExerciseStill, hasAnimation } from './ExerciseAnimations';
import { computeStreak } from '../utils/stats';
import { formatPainArea, formatReliefDate, formatSeconds } from '../utils/formatDate';
import { t, tp, type MessageKey } from '../../i18n';
import { useLocale } from '../../i18n/react';
import { exercisesFor, GENERAL_ROUTINES, totalSeconds } from '../utils/routines';
import { PAIN_AREA_INFO, parseOptionsHash, type PainArea } from '../../utils/painAreas';
import { sendMessage, type AlarmStatus } from '../../utils/runtime';

interface DashboardProps {
  reliefData: ReliefEntry[];
  remindersEnabled: boolean;
  onStartRoutine: (exercises: Exercise[], painArea: string, painLevel: number) => void;
  onOpenSettings: () => void;
}

/** Anything the dashboard can launch: a pain area or a full-body routine. */
interface Choice {
  id: string;
  label: string;
  /** Stored as the session's area, so Progress can group by it. */
  area: string;
  icon?: string;
  description?: string;
  exercises: Exercise[];
  seconds: number;
  /** Question above the before-rating. */
  question: string;
}

// Built per call so labels follow the current language.
function areas(): Choice[] {
  return PAIN_AREA_INFO.map((a) => {
    const list = exercisesFor(painRoutines[a.key] ?? []);
    return {
      id: a.key,
      label: formatPainArea(a.key),
      area: a.key,
      icon: a.icon,
      description: t(`painArea.${a.key}.description` as MessageKey),
      exercises: list,
      seconds: totalSeconds(list),
      question: t(`dashboard.question.${a.key}` as MessageKey),
    };
  });
}

function breaks(): Choice[] {
  return GENERAL_ROUTINES.map((r) => ({
    id: r.key,
    label: formatPainArea(r.key),
    area: r.key,
    exercises: r.exercises,
    seconds: r.seconds,
    question: t('dashboard.questionGeneral'),
  }));
}

const byId = (id: string | null) => [...areas(), ...breaks()].find((c) => c.id === id) ?? null;

/** Sessions needed before the full-body routines get their own row; until then a single link offers one. */
const BREAKS_AFTER = 3;

/** "today" and "yesterday" read better lowercase mid-sentence; real dates keep their capitals. */
function areaFromHash(): PainArea | null {
  return parseOptionsHash(window.location.hash).area;
}

export function Dashboard({ reliefData, remindersEnabled, onStartRoutine, onOpenSettings }: DashboardProps) {
  useLocale();
  const [notificationsBlocked, setNotificationsBlocked] = useState(false);

  // Consume one-shot params (area, welcome) so a reload doesn't reapply them.
  useEffect(() => {
    if (window.location.hash.includes('?')) window.history.replaceState(null, '', '#dashboard');
  }, []);

  // Reminders are pointless if the system hides them; say so where people will see it.
  useEffect(() => {
    if (!remindersEnabled) return;
    sendMessage<AlarmStatus>({ type: 'GET_ALARM_STATUS' })
      .then((s) => setNotificationsBlocked(!!s && !s.hasNotificationPermission))
      .catch(() => {});
  }, [remindersEnabled]);

  const warning = notificationsBlocked && (
    <p className="mb-6 border-l-2 border-warning pl-3 text-sm">
      {t('dashboard.v2.notificationsBlocked')}{' '}
      <button type="button" onClick={onOpenSettings} className="text-primary underline underline-offset-2">
        {t('dashboard.v2.fixInSettings')}
      </button>
    </p>
  );

  return (
    <>
      {warning}
      {reliefData.length === 0 ? (
        <FirstRun onStartRoutine={onStartRoutine} />
      ) : (
        <Returning reliefData={reliefData} onStartRoutine={onStartRoutine} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// First visit: one question per screen.
// ---------------------------------------------------------------------------

/** The first-run picker shows five plain choices; upper and lower back are split on the next screen. */
function firstRunPicks(): Choice[] {
  return [
    ...['neck', 'shoulders', 'wrists'].map((k) => byId(k)!),
    { ...byId('upperBack')!, id: 'back', label: t('dashboard.v2.back'), description: t('dashboard.v2.backDescription') },
    byId('eyes')!,
  ];
}

function FirstRun({ onStartRoutine }: Pick<DashboardProps, 'onStartRoutine'>) {
  // A link from the popup or a notification skips straight to rating that area.
  const [step, setStep] = useState<'pick' | 'back' | 'rate'>(() => (areaFromHash() ? 'rate' : 'pick'));
  const [choice, setChoice] = useState<Choice | null>(() => byId(areaFromHash()));
  const [painLevel, setPainLevel] = useState(5);

  const deskReset = byId('deskReset');
  const rate = (c: Choice) => {
    setChoice(c);
    setPainLevel(5);
    setStep('rate');
  };

  if (step === 'rate' && choice) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <button
          type="button"
          onClick={() => setStep(choice.id === 'upperBack' || choice.id === 'lowerBack' ? 'back' : 'pick')}
          className="-ml-1 flex items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {choice.label}
        </button>
        <h1 className="mt-4 text-2xl font-semibold">{t('dashboard.v2.howBad')}</h1>
        <PainScale
          id="first-pain"
          className="mt-6"
          value={painLevel}
          onChange={setPainLevel}
          label={t('dashboard.v2.yourRating')}
        />
        <button
          type="button"
          onClick={() => onStartRoutine(choice.exercises, choice.area, painLevel)}
          className="mt-8 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          {t('common.start')}
        </button>
      </div>
    );
  }

  if (step === 'back') {
    return (
      <div className="mx-auto max-w-md pt-6">
        <button
          type="button"
          onClick={() => setStep('pick')}
          className="-ml-1 flex items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('dashboard.v2.allAreas')}
        </button>
        <h1 className="mt-4 text-2xl font-semibold">{t('dashboard.v2.upperOrLower')}</h1>
        <div className="mt-6 space-y-2">
          {[byId('upperBack')!, byId('lowerBack')!].map((c) => (
            <AreaRow key={c.id} choice={c} navigates onClick={() => rate(c)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pt-6">
      <h1 className="text-2xl font-semibold">{t('common.whereDoesItHurt')}</h1>
      <div className="mt-6 space-y-2">
        {firstRunPicks().map((c) => (
          <AreaRow key={c.id} choice={c} navigates onClick={() => (c.id === 'back' ? setStep('back') : rate(c))} />
        ))}
      </div>
      {deskReset && (
        <button
          type="button"
          onClick={() => rate(deskReset)}
          className="mt-5 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {t('dashboard.v2.notSureFirst')}
        </button>
      )}
    </div>
  );
}

/**
 * One choice as a list row. When `children` is given the row is open and shows them
 * underneath, inside the same card, so the routine appears right where you clicked.
 */
function AreaRow({
  choice,
  onClick,
  meta,
  children,
  navigates = false,
}: {
  choice: Choice;
  onClick: () => void;
  meta?: string;
  children?: ReactNode;
  /** The row moves to another screen instead of expanding (first-run flow). */
  navigates?: boolean;
}) {
  const open = children != null;
  const ref = useRef<HTMLDivElement>(null);
  // Bring the opened routine fully into view, without jumping if it already is.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);
  return (
    <div
      ref={ref}
      className={`scroll-my-6 overflow-hidden rounded-lg border bg-card transition-colors ${
        open ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground'
      }`}
    >
      <button type="button" aria-expanded={navigates ? undefined : open} onClick={onClick} className="flex w-full items-center gap-4 p-2.5 pr-4 text-left">
        {choice.icon && (
          // Every cover shares one 480×360 canvas, so the figures line up down the list.
          <span className="block h-16 w-[5.5rem] shrink-0 overflow-hidden rounded-md bg-muted">
            <img src={choice.icon} alt="" width={480} height={360} loading="eager" className="h-full w-full object-contain p-1" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{choice.label}</span>
          {choice.description && <span className="block text-sm text-muted-foreground">{choice.description}</span>}
        </span>
        {meta && <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>}
        {navigates ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        )}
      </button>
      {children}
    </div>
  );
}

/** The routine for one choice: what you'll do, how you feel now, and Start. */
function RoutineSection({ choice, onStart }: { choice: Choice; onStart: (painLevel: number) => void }) {
  const [painLevel, setPainLevel] = useState(5);
  return (
    <div className="border-t border-border px-4 pb-4 pt-3">
      <ol className="grid gap-2 sm:grid-cols-3">
        {choice.exercises.map((ex, i) => (
          <li key={ex.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background p-2">
            {hasAnimation(ex.id) && <ExerciseStill exerciseId={ex.id} className="h-14 w-16 shrink-0" />}
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">
                {i + 1}. {ex.name}
              </span>
              <span className="block text-xs tabular-nums text-muted-foreground">{formatSeconds(ex.duration)}</span>
            </span>
          </li>
        ))}
      </ol>
      <PainScale
        id={`pain-${choice.id}`}
        className="mt-4"
        value={painLevel}
        onChange={setPainLevel}
        label={choice.question}
        compact
      />
      <button
        type="button"
        onClick={() => onStart(painLevel)}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        {t('common.startRoutine')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Returning visits: choose on the left, start on the right.
// ---------------------------------------------------------------------------

function Returning({ reliefData, onStartRoutine }: Pick<DashboardProps, 'reliefData' | 'onStartRoutine'>) {
  const AREAS = areas();
  const BREAKS = breaks();
  const deskReset = byId('deskReset');
  const last = reliefData[reliefData.length - 1];
  // Nothing is open until you pick, except when a link (popup, reminder) names an area.
  const [selected, setSelected] = useState<string | null>(() => areaFromHash());
  const [breaksOpen, setBreaksOpen] = useState(false);
  const showBreaks = reliefData.length >= BREAKS_AFTER;
  const streak = useMemo(() => computeStreak(reliefData), [reliefData]);

  // Clicking the open row closes it; clicking another switches to it.
  const toggle = (id: string) => setSelected((cur) => (cur === id ? null : id));
  const section = (c: Choice) =>
    selected === c.id ? <RoutineSection choice={c} onStart={(level) => onStartRoutine(c.exercises, c.area, level)} /> : undefined;

  const lastLine =
    last &&
    (last.rated === false
      ? t('dashboard.v2.lastTime', { what: formatPainArea(last.painArea, true), date: formatReliefDate(last.date, true) })
      : t('dashboard.v2.lastTimeRated', {
          what: formatPainArea(last.painArea, true),
          date: formatReliefDate(last.date, true),
          before: last.beforePain,
          after: last.afterPain,
        }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-baseline justify-between gap-6">
        <h1 className="text-2xl font-semibold">{t('common.whereDoesItHurt')}</h1>
        {streak > 1 && <p className="text-sm text-muted-foreground">{tp('count.dayStreak', streak)}</p>}
      </div>

      <div className="mt-6 space-y-2">
        {AREAS.map((a) => (
          <AreaRow key={a.id} choice={a} meta={formatSeconds(a.seconds)} onClick={() => toggle(a.id)}>
            {section(a)}
          </AreaRow>
        ))}
      </div>

      {showBreaks ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
          <button
            type="button"
            aria-expanded={breaksOpen}
            onClick={() => setBreaksOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="font-medium">{t('dashboard.v2.fullBodyBreak')}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${breaksOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {breaksOpen && (
            <ul className="divide-y divide-border border-t border-border">
              {BREAKS.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    aria-expanded={selected === b.id}
                    onClick={() => toggle(b.id)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                      selected === b.id ? 'font-medium' : 'hover:bg-muted'
                    }`}
                  >
                    {b.label}
                    <span className="text-xs tabular-nums text-muted-foreground">{formatSeconds(b.seconds)}</span>
                  </button>
                  {section(b)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        deskReset && (
          <div className="mt-3">
            <button
              type="button"
              aria-expanded={selected === deskReset.id}
              onClick={() => toggle(deskReset.id)}
              className="px-1 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {t('dashboard.v2.notSure')}
            </button>
            {selected === deskReset.id && (
              <div className="mt-2 overflow-hidden rounded-lg border border-primary bg-card ring-1 ring-primary">{section(deskReset)}</div>
            )}
          </div>
        )
      )}

      {lastLine && <p className="mt-8 text-sm text-muted-foreground">{lastLine}</p>}
    </div>
  );
}
