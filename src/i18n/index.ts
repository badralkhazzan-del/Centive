"use client";

import type { Lang, LocalizedText } from "@/types";
import { useAppData } from "@/lib/repo";
import { en, type Dict } from "./en";
import { id } from "./id";

export const dictionaries: Record<Lang, Dict> = { en, id };

export function useLang(): Lang {
  return useAppData().ui.lang;
}

/** The dictionary for the current language plus small helpers. */
export function useT() {
  const lang = useLang();
  const t = dictionaries[lang];
  /** Pick the right side of a generated bilingual text. */
  const lt = (text: LocalizedText | undefined) => (text ? text[lang] : "");
  /** Name of a data record that has nameEn / nameId. */
  const nm = (rec: { nameEn: string; nameId: string } | undefined) => (rec ? (lang === "id" ? rec.nameId : rec.nameEn) : "");
  return { t, lang, lt, nm };
}
