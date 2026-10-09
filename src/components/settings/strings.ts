import type { Lang } from "@/types";
import { en, type Dict } from "@/i18n/en";
import { id } from "@/i18n/id";

// The Settings screens read their extra strings from the shared dictionaries.
export type SettingsStrings = Dict["settingsUi"];

export function settingsStrings(lang: Lang): SettingsStrings {
  return lang === "id" ? id.settingsUi : en.settingsUi;
}
