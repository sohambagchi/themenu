"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function applyTheme(nextTheme: ThemeMode) {
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  window.localStorage.setItem("theme", nextTheme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const initialTheme: ThemeMode =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        applyTheme(next);
      }}
      className="rounded border border-edge px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted transition hover:border-text hover:text-text"
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
