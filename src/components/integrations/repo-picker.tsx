"use client";

import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX = 50;
const PATH = /^[\w.-]+(?:\/[\w.-]+)+$/;

/**
 * Searchable multi-select for repositories/projects. Submits the selection as
 * a newline-separated "repositories" field, the same shape the server action
 * already validates and verifies.
 */
export function RepoPicker({
  name,
  options,
  defaultSelected,
  placeholder,
  unit,
  loadError,
}: {
  name: string;
  options: string[];
  defaultSelected: string[];
  placeholder: string;
  unit: string;
  loadError?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(q)).slice(0, 60),
    [options, q],
  );
  const custom =
    q && PATH.test(query.trim()) && !options.some((o) => o.toLowerCase() === q)
      ? query.trim()
      : null;
  const items = custom ? [...matches, custom] : matches;
  const full = selected.length >= MAX;

  const toggle = (value: string) => {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : current.length >= MAX
          ? current
          : [...current, value],
    );
    setQuery("");
    input.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the form from the search box
      if (open && items[highlight]) toggle(items[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length) {
      setSelected((current) => current.slice(0, -1));
    }
  };

  return (
    <div data-repo-picker className="space-y-2">
      <input type="hidden" name={name} value={selected.join("\n")} />

      {selected.length > 0 && (
        <ul aria-label={`Selected ${unit}`} className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <li
              key={value}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-accent/20 bg-accent-soft py-1 pr-1 pl-2.5 font-mono text-[11px] text-ink"
            >
              <span className="truncate">{value}</span>
              <button
                type="button"
                onClick={() => toggle(value)}
                aria-label={`Remove ${value}`}
                className="grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-accent/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-canvas px-3 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
          <Search size={15} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && items[highlight] ? `${listId}-${highlight}` : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            placeholder={
              full ? `Limit of ${MAX} reached` : `Search ${unit} or type ${placeholder}`
            }
            disabled={full && !query}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            className="min-h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen((o) => !o);
              input.current?.focus();
            }}
            className="text-muted"
          >
            <ChevronDown
              size={16}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={`Available ${unit}`}
            className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
          >
            {items.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-muted">
                {options.length
                  ? `No ${unit} match “${query}”.`
                  : `No ${unit} available. Type a full path like ${placeholder}.`}
              </li>
            ) : (
              items.map((value, index) => {
                const isSelected = selected.includes(value);
                const isCustom = value === custom;
                return (
                  <li
                    key={value}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggle(value);
                    }}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 font-mono text-xs text-ink",
                      index === highlight && "bg-accent-soft",
                    )}
                  >
                    <span className="grid size-4 shrink-0 place-items-center text-accent">
                      {isCustom ? (
                        <Plus size={14} aria-hidden="true" />
                      ) : (
                        isSelected && <Check size={14} aria-hidden="true" />
                      )}
                    </span>
                    <span className="truncate">
                      {isCustom ? `Add “${value}”` : value}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      <p className="text-xs leading-5 text-muted">
        {selected.length} selected
        {options.length ? ` · ${options.length} available` : ""} · up to {MAX}. Each is
        verified when you save.
        {loadError && <span className="block text-danger">{loadError}</span>}
      </p>
    </div>
  );
}
