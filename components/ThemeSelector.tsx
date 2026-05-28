"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getThemePreference,
  setThemePreference,
  applyTheme,
  type ThemePreference,
} from "@/lib/theme/themePreference";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
];

const THEME_CHANGE_EVENT = "markdown-reviewer:theme-change";

function getServerSnapshot(): ThemePreference {
  return "system";
}

function getClientSnapshot(): ThemePreference {
  return getThemePreference();
}

function subscribeToThemePreference(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

export default function ThemeSelector() {
  const pref = useSyncExternalStore(
    subscribeToThemePreference,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(pref, mq.matches);

    // Keep system preference in sync if OS changes while app is open
    const onOsChange = (e: MediaQueryListEvent) => {
      if (getThemePreference() === "system") applyTheme("system", e.matches);
    };
    mq.addEventListener("change", onOsChange);
    return () => mq.removeEventListener("change", onOsChange);
  }, [pref]);

  function select(next: ThemePreference) {
    setThemePreference(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(next, systemIsDark);
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex items-center rounded border border-zinc-300 dark:border-zinc-600 overflow-hidden text-xs"
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          data-testid={`theme-${value}`}
          onClick={() => select(value)}
          aria-pressed={pref === value}
          className={`px-2 py-1 transition-colors ${
            pref === value
              ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
              : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
