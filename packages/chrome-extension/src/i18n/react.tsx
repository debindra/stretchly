import { createContext, Fragment, useContext, type ReactNode } from 'react';
import type { Locale } from '@stretchly/shared';
import { getLocale, t, type MessageKey } from './index';

/**
 * Current locale for components. The provider's value changes when the language setting does,
 * which re-renders consumers; `t()` itself reads the module-level locale set alongside it.
 */
export const LocaleContext = createContext<Locale>(getLocale());

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** `t` for messages whose placeholders are elements, e.g. a link inside a sentence. */
export function tNode(key: MessageKey, vars: Record<string, ReactNode>): ReactNode {
  return t(key)
    .split(/(\{\w+\})/)
    .map((part, i) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return <Fragment key={i}>{name && name in vars ? vars[name] : part}</Fragment>;
    });
}
