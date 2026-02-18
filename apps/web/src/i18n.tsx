import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLang = "pt-BR" | "en";

type I18nContextValue = {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  tx: (pt: string, en: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "td2_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>("pt-BR");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pt-BR" || saved === "en") {
      setLangState(saved);
    }
  }, []);

  const setLang = (next: AppLang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    tx: (pt: string, en: string) => (lang === "pt-BR" ? pt : en),
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
