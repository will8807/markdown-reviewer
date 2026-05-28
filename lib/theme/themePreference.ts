export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "markdown-reviewer:theme";
const VALID = new Set<ThemePreference>(["light", "dark", "system"]);

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored as ThemePreference)) return stored as ThemePreference;
  } catch {}
  return "system";
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {}
}

export function applyTheme(pref: ThemePreference, systemIsDark: boolean): void {
  const dark = pref === "dark" || (pref === "system" && systemIsDark);
  document.documentElement.classList.toggle("dark", dark);
}
