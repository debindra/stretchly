import type { MessageKey } from './messages/en';

/** Base of a plural message: `count.sessions` for `count.sessions.one` / `count.sessions.other`. */
export type PluralBase = { [K in MessageKey]: K extends `${infer B}.other` ? B : never }[MessageKey];

/** Plural forms English doesn't use but other locales' Intl.PluralRules may select. */
type ExtraPluralKey = `${PluralBase}.${'zero' | 'two' | 'few' | 'many'}`;

/** A locale's catalog; any key it leaves out falls back to English. */
export type Messages = Partial<Record<MessageKey | ExtraPluralKey, string>>;
