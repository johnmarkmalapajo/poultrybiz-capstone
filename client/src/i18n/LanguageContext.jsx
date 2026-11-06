/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TL } from "./tl";
import { translateByPattern } from "./patterns";

// App language. Only the visible text changes; layout and styling are untouched.
// English text is the lookup key: t("Dashboard") returns "Dashboard" in English
// and the Filipino entry from tl.js when Filipino is selected. A string with no
// Filipino entry simply stays in English, so a missing translation never breaks
// a page.

export const LANGUAGES = ["English", "Filipino"];
const STORAGE_KEY = "pb_lang";

const readStoredLanguage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "Filipino" ? "Filipino" : "English";
  } catch {
    return "English";
  }
};

// Lower-cased index so ALL-CAPS labels (e.g. breadcrumbs) find their entry.
const TL_LOWER = Object.keys(TL).reduce((acc, k) => {
  acc[k.toLowerCase()] = TL[k];
  return acc;
}, {});

const lookup = (text) => {
  if (TL[text] !== undefined) return TL[text];
  const hit = TL_LOWER[text.toLowerCase()];
  if (hit === undefined) return undefined;
  return text === text.toUpperCase() ? hit.toUpperCase() : hit;
};

// "November 2026" / "Year 2026" style labels are built from data, so they have
// no dictionary entry of their own.
const MONTH_YEAR = /^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/;
const YEAR_ONLY = /^Year (\d{4})$/;

const translatePattern = (text) => {
  const my = text.match(MONTH_YEAR);
  if (my && TL[my[1]] !== undefined) return `${TL[my[1]]} ${my[2]}`;
  const yo = text.match(YEAR_ONLY);
  if (yo) return `Taon ${yo[1]}`;
  return undefined;
};

const translate = (language, text, vars) => {
  let out = text;
  if (language === "Filipino" && typeof text === "string") {
    const found = lookup(text) ?? translatePattern(text) ?? translateByPattern(text);
    if (found !== undefined) out = found;
  }
  if (vars && typeof out === "string") {
    out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  }
  return out;
};

const LanguageContext = createContext({
  language: "English",
  setLanguage: () => {},
  t: (text, vars) => translate("English", text, vars),
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  const setLanguage = useCallback((next) => {
    const value = next === "Filipino" ? "Filipino" : "English";
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage unavailable: the choice just lasts for this session */
    }
    setLanguageState(value);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "Filipino" ? "fil" : "en";
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (text, vars) => translate(language, text, vars),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);