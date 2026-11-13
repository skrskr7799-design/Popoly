import { create } from 'zustand';
import { translations, type Locale, type TranslationKey } from './translations';

const STORAGE_KEY = 'popoly-locale';

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
  t: (key: TranslationKey) => string;
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
  t: (key) => {
    const { locale } = get();
    return translations[locale][key] ?? translations.ru[key] ?? key;
  },
}));

export type { Locale, TranslationKey };
