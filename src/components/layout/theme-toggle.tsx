"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const eventName = "workcopilot:theme";
function preferredDark() {
  try {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
  } catch {
    /* Storage may be disabled. */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function subscribe(callback: () => void) {
  const apply = () => {
    document.documentElement.classList.toggle("dark", preferredDark());
    callback();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === "theme") apply();
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", storage);
  media.addEventListener("change", apply);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", storage);
    media.removeEventListener("change", apply);
  };
}
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = !dark;
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
          /* The theme still works for the current visit. */
        }
        document.documentElement.classList.toggle("dark", next);
        window.dispatchEvent(new Event(eventName));
      }}
    >
      {dark ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </Button>
  );
}
