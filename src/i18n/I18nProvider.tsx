import { useState, useEffect, useCallback, useMemo } from 'react';
import { LazyStore } from '@tauri-apps/plugin-store';
import { listen } from '@tauri-apps/api/event';
import { I18nContext, getTranslations, getCropName, getMonths } from './index';
import type { Language } from './types';

const LANG_KEY = 'language';
const store = new LazyStore('store.json');

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('zh');

  useEffect(() => {
    store.get<Language>(LANG_KEY).then((saved) => {
      if (saved === 'en' || saved === 'zh') {
        setLangState(saved);
      }
    });
  }, []);

  // Listen for language change from tray menu
  useEffect(() => {
    const unlisten = listen<string>('set-language', (event) => {
      const newLang = event.payload as Language;
      if (newLang === 'en' || newLang === 'zh') {
        setLangState(newLang);
        store.set(LANG_KEY, newLang).then(() => store.save());
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    store.set(LANG_KEY, newLang).then(() => store.save());
  }, []);

  const value = useMemo(() => ({
    lang,
    t: getTranslations(lang),
    setLang,
    cropName: (id: string) => getCropName(lang, id),
    months: getMonths(lang),
  }), [lang, setLang]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
