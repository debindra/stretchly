import type { ColorMode, Theme } from '@stretchly/shared';
import { t } from '../i18n';

export interface ThemeColors {
  /** Brand color for selection, focus, data and progress. */
  primary: string;
  /** Text/icon color on top of `primary` — chosen for contrast, not always white. */
  primaryForeground: string;
  primaryHover: string;
  secondary: string;
  secondaryForeground: string;
  background: string;
  /** Call-to-action color (Start, Save). */
  accent: string;
  accentHover: string;
  accentForeground: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  inputBackground: string;
  switchBackground: string;
  /** Status colors; each passes 4.5:1 as text on `card`. */
  success: string;
  warning: string;
  destructive: string;
  destructiveForeground: string;
}

interface ThemeDefinition {
  name: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;
  fontFamily?: string;
}

const LIGHT_STATUS = {
  success: '#15803D',
  warning: '#B45309',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
};

const DARK_STATUS = {
  success: '#4ADE80',
  warning: '#FBBF24',
  destructive: '#F87171',
  destructiveForeground: '#1F0606',
};

export const themes: Record<Theme, ThemeDefinition> = {
  'fast-wellness': {
    // Seafoam teal from the logo mark + deep navy from the wordmark.
    name: 'Fresh',
    description: 'Seafoam teal and navy, straight from the logo',
    light: {
      primary: '#0D7F76',
      primaryForeground: '#FFFFFF',
      primaryHover: '#0A6B63',
      secondary: '#0E1C2B',
      secondaryForeground: '#FFFFFF',
      background: '#F4F7F7',
      accent: '#0E1C2B',
      accentHover: '#1D3247',
      accentForeground: '#FFFFFF',
      foreground: '#0E1C2B',
      card: '#FFFFFF',
      muted: '#EBF0F1',
      mutedForeground: '#56677A',
      border: '#DFE6E8',
      inputBackground: '#FFFFFF',
      switchBackground: '#C3CED3',
      ...LIGHT_STATUS,
    },
    dark: {
      primary: '#45C9BA',
      primaryForeground: '#04201D',
      primaryHover: '#6AD6CA',
      secondary: '#E6EEF0',
      secondaryForeground: '#0B1318',
      background: '#0B1318',
      accent: '#5FD6C8',
      accentHover: '#85E2D7',
      accentForeground: '#04201D',
      foreground: '#E6EEF0',
      card: '#111C22',
      muted: '#1A272E',
      mutedForeground: '#95A7B0',
      border: '#24343C',
      inputBackground: '#0F191E',
      switchBackground: '#33454E',
      ...DARK_STATUS,
    },
  },
  calm: {
    // Sage (calm), warm apricot accent (gentle motivation).
    name: 'Calm',
    description: 'Soft sage greens with a warm apricot accent',
    light: {
      primary: '#4F7D55',
      primaryForeground: '#FFFFFF',
      primaryHover: '#416A47',
      secondary: '#475569',
      secondaryForeground: '#FFFFFF',
      background: '#F6F7F2',
      accent: '#E9874E',
      accentHover: '#DC7438',
      accentForeground: '#1E2A22',
      foreground: '#1E2A22',
      card: '#FFFFFF',
      muted: '#ECEFE6',
      mutedForeground: '#5C685D',
      border: '#E0E5DA',
      inputBackground: '#FFFFFF',
      switchBackground: '#C9D1C3',
      ...LIGHT_STATUS,
    },
    dark: {
      primary: '#9CC79A',
      primaryForeground: '#142014',
      primaryHover: '#B3D6B1',
      secondary: '#CBD5C8',
      secondaryForeground: '#121612',
      background: '#121612',
      accent: '#F2A273',
      accentHover: '#F6B993',
      accentForeground: '#241509',
      foreground: '#E7ECE3',
      card: '#191E19',
      muted: '#232A23',
      mutedForeground: '#A3AD9F',
      border: '#2D352D',
      inputBackground: '#151A15',
      switchBackground: '#3A443A',
      ...DARK_STATUS,
    },
  },
  energizer: {
    // Clear blue (focus) with a fresh mint call to action.
    name: 'Energizer',
    description: 'Crisp blue with a fresh mint call to action',
    light: {
      primary: '#2563EB',
      primaryForeground: '#FFFFFF',
      primaryHover: '#1D4FD8',
      secondary: '#64748B',
      secondaryForeground: '#FFFFFF',
      background: '#F5F8FC',
      accent: '#34D399',
      accentHover: '#10B981',
      accentForeground: '#052E21',
      foreground: '#0C1A2E',
      card: '#FFFFFF',
      muted: '#EBF0F7',
      mutedForeground: '#526379',
      border: '#DCE4EE',
      inputBackground: '#FFFFFF',
      switchBackground: '#C4CFDC',
      ...LIGHT_STATUS,
    },
    dark: {
      primary: '#6EA8FF',
      primaryForeground: '#06142B',
      primaryHover: '#93BEFF',
      secondary: '#94A3B8',
      secondaryForeground: '#0A0F1A',
      background: '#0A0F1A',
      accent: '#34D399',
      accentHover: '#6EE7B7',
      accentForeground: '#04231A',
      foreground: '#E5ECF6',
      card: '#111827',
      muted: '#1A2334',
      mutedForeground: '#98A6BB',
      border: '#253046',
      inputBackground: '#0E1522',
      switchBackground: '#334158',
      ...DARK_STATUS,
    },
  },
  modern: {
    // Navy (stability), turquoise (growth), orange (action), Inter font.
    name: 'Modern',
    description: 'Navy and orange on warm neutrals, set in Inter',
    fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif',
    light: {
      primary: '#12436D',
      primaryForeground: '#FFFFFF',
      primaryHover: '#0E3252',
      secondary: '#28A197',
      secondaryForeground: '#FFFFFF',
      background: '#F7F7F5',
      accent: '#F46A25',
      accentHover: '#E55A15',
      accentForeground: '#121212',
      foreground: '#121212',
      card: '#FFFFFF',
      muted: '#EFEFEC',
      mutedForeground: '#5C5C5C',
      border: '#E4E4E0',
      inputBackground: '#FFFFFF',
      switchBackground: '#D0D0CB',
      ...LIGHT_STATUS,
    },
    dark: {
      primary: '#7DB2E3',
      primaryForeground: '#0A1A2A',
      primaryHover: '#A0C7EC',
      secondary: '#4FC1B6',
      secondaryForeground: '#06201D',
      background: '#0F1114',
      accent: '#F7864D',
      accentHover: '#F9A172',
      accentForeground: '#1A0A02',
      foreground: '#ECECEC',
      card: '#171A1F',
      muted: '#21252B',
      mutedForeground: '#A2A6AD',
      border: '#2C3138',
      inputBackground: '#13161A',
      switchBackground: '#3A3F47',
      ...DARK_STATUS,
    },
  },
};

export const THEME_OPTIONS = Object.keys(themes) as Theme[];

const CSS_VARS: Record<keyof ThemeColors, string> = {
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  primaryHover: '--primary-hover',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  background: '--background',
  accent: '--accent',
  accentHover: '--accent-hover',
  accentForeground: '--accent-foreground',
  foreground: '--foreground',
  card: '--card',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  border: '--border',
  inputBackground: '--input-background',
  switchBackground: '--switch-background',
  success: '--success',
  warning: '--warning',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
};

/** Last applied appearance, cached so the next page load can paint it before storage resolves. */
const CACHE_KEY = 'stretchly-appearance';
const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveMode(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'system') return darkQuery?.matches ? 'dark' : 'light';
  return mode;
}

export function getThemeColors(theme: Theme, mode: 'light' | 'dark'): ThemeColors {
  return (themes[theme] ?? themes['fast-wellness'])[mode];
}

export function applyTheme(theme: Theme, mode: ColorMode = 'system'): void {
  const def = themes[theme] ?? themes['fast-wellness'];
  const resolved = resolveMode(mode);
  const colors = def[resolved];
  const root = document.documentElement;

  for (const [key, cssVar] of Object.entries(CSS_VARS)) {
    root.style.setProperty(cssVar, colors[key as keyof ThemeColors]);
  }
  root.dataset.mode = resolved;
  root.style.colorScheme = resolved;

  if (def.fontFamily) root.style.setProperty('--font-family', def.fontFamily);
  else root.style.removeProperty('--font-family');

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = colors.background;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, mode }));
  } catch {
    // Storage unavailable; the next load just starts from defaults.
  }
}

/** Apply the cached appearance synchronously, before first paint. */
export function applyCachedTheme(): void {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    applyTheme(cached?.theme ?? 'fast-wellness', cached?.mode ?? 'system');
  } catch {
    applyTheme('fast-wellness', 'system');
  }
}

/** Re-run `callback` when the OS light/dark preference changes. */
export function onSystemModeChange(callback: () => void): () => void {
  darkQuery?.addEventListener('change', callback);
  return () => darkQuery?.removeEventListener('change', callback);
}

const THEME_KEYS = {
  'fast-wellness': 'fastWellness',
  calm: 'calm',
  energizer: 'energizer',
  modern: 'modern',
} as const satisfies Record<Theme, string>;

/** Theme name in the active locale. */
export function getThemeDisplayName(theme: Theme): string {
  return t(`theme.${THEME_KEYS[theme]}`);
}

export function getThemeDescription(theme: Theme): string {
  return t(`theme.${THEME_KEYS[theme]}.description`);
}
