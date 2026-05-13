import { createContext, useContext } from 'react';
import type { Language, Translations } from './types';
import { en, cropNames as enCropNames } from './en';
import { zh, cropNames as zhCropNames } from './zh';

export type { Language, Translations };

const translations: Record<Language, Translations> = { en, zh };
const cropNameMaps: Record<Language, Record<string, string>> = { en: enCropNames, zh: zhCropNames };

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}

export function getCropName(lang: Language, cropId: string): string {
  return cropNameMaps[lang][cropId] ?? cropId;
}

export function getMonths(lang: Language): string[] {
  const t = translations[lang];
  return [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
}

export interface I18nContextValue {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
  cropName: (id: string) => string;
  months: string[];
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  t: zh,
  setLang: () => {},
  cropName: (id) => zhCropNames[id] ?? id,
  months: getMonths('zh'),
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
