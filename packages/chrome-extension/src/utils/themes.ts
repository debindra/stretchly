import type { Theme } from '@stretchly/shared';

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  secondary: string;
  secondaryForeground: string;
  background: string;
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
}

export const themes: Record<Theme, ThemeColors> = {
  'fast-wellness': {
    // Option A: "Fast Wellness Tech"
    // Primary: Teal (#14B8A6) → wellness + energy
    // Secondary: Navy (#0F172A) → credibility & tech
    // Background: White (#FFFFFF) → clean, lightweight
    // Accent: Lime (#A3E635) → fast/action highlights
    primary: '#14B8A6',
    primaryHover: '#0D9488',
    primaryActive: '#0F766E',
    secondary: '#0F172A',
    secondaryForeground: '#ffffff',
    background: '#FFFFFF',
    accent: '#A3E635',
    accentHover: '#84CC16',
    accentForeground: '#0F172A',
    foreground: '#0F172A',
    card: '#F8FAFC',
    muted: '#F8FAFC',
    mutedForeground: '#475569',
    border: '#E2E8F0',
    inputBackground: '#F8FAFC',
    switchBackground: '#CBD5E1',
  },
  'calm': {
    // Option B: "Calm in 2 Minutes"
    // Primary: Sage Green (#9DBE8F) → calm muscles/eyes
    // Secondary: Slate Gray (#475569) → professional
    // Background: Warm Off-White (#F8FAF7)
    // Accent: Soft Orange (#F4A261) → micro motivation
    primary: '#9DBE8F',
    primaryHover: '#7FA86F',
    primaryActive: '#6B8E5A',
    secondary: '#475569',
    secondaryForeground: '#ffffff',
    background: '#F8FAF7',
    accent: '#F4A261',
    accentHover: '#E76F51',
    accentForeground: '#1F2937',
    foreground: '#1F2937',
    card: '#FFFFFF',
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    border: '#E2E8F0',
    inputBackground: '#F8FAF7',
    switchBackground: '#CBD5E1',
  },
  'energizer': {
    // Option C: "Workplace Friendly Energizer"
    // Primary: Sky Blue (#3A86FF) → productivity + clarity
    // Secondary: Cool Gray (#64748B) → neutral, office-friendly
    // Background: White (#FFFFFF)
    // Accent: Mint Green (#6EE7B7) → health + freshness
    primary: '#3A86FF',
    primaryHover: '#2563EB',
    primaryActive: '#1D4ED8',
    secondary: '#64748B',
    secondaryForeground: '#ffffff',
    background: '#FFFFFF',
    accent: '#6EE7B7',
    accentHover: '#34D399',
    accentForeground: '#0F172A',
    foreground: '#0F172A',
    card: '#F8FAFC',
    muted: '#F8FAFC',
    mutedForeground: '#64748B',
    border: '#E2E8F0',
    inputBackground: '#F8FAFC',
    switchBackground: '#CBD5E1',
  },
};

export function applyTheme(theme: Theme): void {
  const colors = themes[theme];
  const root = document.documentElement;

  // Apply CSS variables
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-hover', colors.primaryHover);
  root.style.setProperty('--primary-active', colors.primaryActive);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-hover', colors.accentHover);
  root.style.setProperty('--accent-foreground', colors.accentForeground);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input-background', colors.inputBackground);
  root.style.setProperty('--switch-background', colors.switchBackground);
}

export function getThemeDisplayName(theme: Theme): string {
  const names: Record<Theme, string> = {
    'fast-wellness': 'Fast Wellness Tech',
    'calm': 'Calm in 2 Minutes',
    'energizer': 'Workplace Friendly Energizer',
  };
  return names[theme];
}

export function getThemeDescription(theme: Theme): string {
  const descriptions: Record<Theme, string> = {
    'fast-wellness': 'Quick relief + trusted SaaS tool',
    'calm': 'Relaxation + balance without slowing down',
    'energizer': 'Healthy breaks during work',
  };
  return descriptions[theme];
}
