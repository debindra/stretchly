import { useState, useMemo } from 'react';
import type { Exercise, SavedRoutine } from '@stretchly/shared';
import { exercises, localizeExercise } from '@stretchly/shared';
import { Search } from 'lucide-react';
import { ExerciseAnimation, ExerciseStill, hasAnimation } from './ExerciseAnimations';
import { PainScale } from './PainScale';
import { Modal } from './Modal';
import { formatSeconds } from '../utils/formatDate';
import { exercisesFor, totalSeconds } from '../utils/routines';
import { formatList, t, tp } from '../../i18n';
import { tNode, useLocale } from '../../i18n/react';

interface ExerciseLibraryProps {
  savedRoutines: SavedRoutine[];
  onStartRoutine: (exercises: Exercise[], painArea: string, painLevel: number) => void;
  onSaveRoutine: (name: string, exerciseIds: string[]) => void;
  onDeleteRoutine: (id: string) => void;
}

type Category = 'all' | Exercise['category'];

const CATEGORIES: Category[] = ['all', 'neck', 'shoulders', 'back', 'hips', 'legs', 'wrists', 'eyes'];

export const categoryLabel = (key: Category) => t(`category.${key}`);

export function ExerciseLibrary({ savedRoutines, onStartRoutine, onSaveRoutine, onDeleteRoutine }: ExerciseLibraryProps) {
  const [category, setCategory] = useState<Category>('all');
  const [routine, setRoutine] = useState<Exercise[]>([]);
  /** Exercises about to start; set when the before-rating dialog is open. */
  const [launch, setLaunch] = useState<Exercise[] | null>(null);
  const [naming, setNaming] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [painLevel, setPainLevel] = useState(5);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [query, setQuery] = useState('');
  const locale = useLocale();
  const all = useMemo(() => exercises.map((ex) => localizeExercise(ex, locale)), [locale]);

  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = { all: all.length };
    for (const ex of all) c[ex.category] = (c[ex.category] ?? 0) + 1;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return all.filter(
      (ex) =>
        (category === 'all' || ex.category === category) &&
        (!q ||
          ex.name.toLocaleLowerCase(locale).includes(q) ||
          ex.description.toLocaleLowerCase(locale).includes(q))
    );
  }, [all, category, query, locale]);
  const selectedIds = useMemo(() => new Set(routine.map((ex) => ex.id)), [routine]);
  const totalDuration = routine.reduce((sum, ex) => sum + ex.duration, 0);

  const toggle = (exercise: Exercise) =>
    setRoutine((prev) =>
      prev.some((ex) => ex.id === exercise.id) ? prev.filter((ex) => ex.id !== exercise.id) : [...prev, exercise]
    );

  const start = () => {
    if (!launch) return;
    onStartRoutine(launch, 'custom', painLevel);
    if (launch === routine) setRoutine([]);
    setLaunch(null);
  };

  const save = () => {
    const name = routineName.trim();
    if (!name) return;
    onSaveRoutine(name, routine.map((ex) => ex.id));
    setRoutine([]);
    setRoutineName('');
    setNaming(false);
  };

  const button = 'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted';

  return (
    <div className={routine.length > 0 ? 'pb-24' : ''}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('nav.library')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tp('library.intro', all.length)}</p>
        </div>
        <label className="relative w-full sm:w-60">
          <span className="sr-only">{t('library.searchLabel')}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('library.searchPlaceholder')}
            className="h-9 w-full rounded-md border border-border bg-input pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </label>
      </div>

      {savedRoutines.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">{t('library.yourRoutines')}</h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {savedRoutines.map((r) => {
              const list = exercisesFor(r.exerciseIds, locale);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatList(list.map((ex) => ex.name))} · {formatSeconds(totalSeconds(list))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRoutine(r.id)}
                    className="text-sm text-muted-foreground transition-colors hover:text-destructive"
                  >
                    {t('common.delete')}
                  </button>
                  <button type="button" onClick={() => setLaunch(list)} disabled={list.length === 0} className={button}>
                    {t('common.start')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-5 flex gap-1.5 overflow-x-auto border-b border-border pb-3 [scrollbar-width:none] sm:flex-wrap" role="group" aria-label={t('library.filterByArea')}>
        {CATEGORIES.filter((cat) => counts[cat]).map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-sm transition-colors ${
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground'
              }`}
            >
              {categoryLabel(cat)} <span className="tabular-nums opacity-60">{counts[cat]}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-sm">
          <p className="font-medium">{t('library.noMatch')}</p>
          <p className="mt-1 text-muted-foreground">
            {tNode('library.noMatchHint', {
              clear: (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                  }}
                  className="text-primary underline underline-offset-2"
                >
                  {t('library.clearFilters')}
                </button>
              ),
            })}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exercise) => {
            const added = selectedIds.has(exercise.id);
            return (
              <article
                key={exercise.id}
                className={`flex flex-col overflow-hidden rounded-lg border bg-card transition-colors ${
                  added ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`}
              >
                <div className="flex aspect-[2/1] items-center justify-center border-b border-border bg-muted">
                  {hasAnimation(exercise.id) ? (
                    <ExerciseStill exerciseId={exercise.id} className="h-full w-full p-2" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('library.textOnly')}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(exercise.category)} · {formatSeconds(exercise.duration)}
                  </p>
                  <h3 className="mt-1 font-medium">{exercise.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{exercise.description}</p>

                  <details className="mt-3 text-sm">
                    <summary className="w-fit text-muted-foreground hover:text-foreground">{t('library.instructions')}</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                      {exercise.instructions.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </details>

                  <div className="mt-auto flex gap-2 pt-4">
                  <button type="button" onClick={() => setPreview(exercise)} className={button}>
                    {t('library.preview')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(exercise)}
                    aria-pressed={added}
                    className={
                      added
                        ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover'
                        : button
                    }
                  >
                    {added ? t('library.added') : t('library.addToRoutine')}
                  </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {routine.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
            {naming ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <label className="sr-only" htmlFor="routine-name">
                  {t('library.routineName')}
                </label>
                <input
                  id="routine-name"
                  autoFocus
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
                  placeholder={t('library.namePlaceholder')}
                  maxLength={40}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary"
                />
                <button type="submit" disabled={!routineName.trim()} className={`${button} disabled:opacity-40`}>
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setNaming(false)}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('common.cancel')}
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {tp('count.exercises', routine.length)} · {formatSeconds(totalDuration)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{formatList(routine.map((ex) => ex.name))}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoutine([])}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('library.clear')}
                </button>
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('library.saveAsRoutine')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setLaunch(routine)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              {t('common.start')}
            </button>
          </div>
        </div>
      )}

      {launch && (
        <Modal
          title={t('library.beforeStart')}
          onClose={() => setLaunch(null)}
          footer={
            <>
              <button type="button" onClick={() => setLaunch(null)} className={button}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={start}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                {t('common.startRoutine')}
              </button>
            </>
          }
        >
          <PainScale id="library-pain-level" value={painLevel} onChange={setPainLevel} label={t('library.discomfortNow')} />
        </Modal>
      )}

      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <ExerciseAnimation
            exerciseId={preview.id}
            isPlaying
            fallback={
              <ol className="list-decimal space-y-1 px-8 pl-12 text-sm">
                {preview.instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            }
          />
          <p className="mt-3 text-sm text-muted-foreground">{preview.description}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                toggle(preview);
                setPreview(null);
              }}
              className={
                selectedIds.has(preview.id)
                  ? button
                  : 'rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover'
              }
            >
              {selectedIds.has(preview.id) ? t('library.removeFromRoutine') : t('library.addToRoutine')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
