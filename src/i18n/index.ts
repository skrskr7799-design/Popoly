import { create } from 'zustand';
import { translations, type Locale } from './translations';

const STORAGE_KEY = 'popoly-tech-dominion-locale';

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'ru') return v;
  } catch {
    /* ignore */
  }
  return 'ru';
}

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate key; supports {name} style placeholders */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function lookup(locale: Locale, key: string): string {
  const table = translations[locale] as Record<string, string>;
  const fallback = translations.ru as Record<string, string>;
  return table[key] ?? fallback[key] ?? key;
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export const useI18n = create<I18nStore>((set, get) => ({
  locale: typeof window !== 'undefined' ? readStoredLocale() : 'ru',
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
    set({ locale });
  },
  t: (key, vars) => format(lookup(get().locale, key), vars),
}));

/** Non-React access (game store logs) */
export function tr(key: string, vars?: Record<string, string | number>): string {
  return useI18n.getState().t(key, vars);
}

export type { Locale };
