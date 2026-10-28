import type { ExerciseTranslations, Locale } from '../i18n';
import es from './es';
import it from './it';
import tr from './tr';
import ru from './ru';
import zh from './zh';
import hi from './hi';
import pl from './pl';
import ko from './ko';
import fr from './fr';

// English lives in exercises.ts itself.
export const exerciseTranslations: Partial<Record<Locale, ExerciseTranslations>> = { es, it, tr, ru, zh, hi, pl, ko, fr };
