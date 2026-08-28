"use client";

import { useEffect } from "react";

export type ThemePreference = "system" | "light" | "dark";

function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  window.localStorage.setItem("lifestack-theme", preference);
}

export function ThemeSync({ preference }: { preference: ThemePreference }) {
  useEffect(() => {
    applyTheme(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => { if (preference === "system") applyTheme(preference); };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [preference]);
  return null;
}

