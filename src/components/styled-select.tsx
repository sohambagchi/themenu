"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface StyledSelectOption {
  value: string;
  label: string;
}

interface StyledSelectProps {
  value: string;
  options: Array<string | StyledSelectOption>;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

function normalizeOptions(options: Array<string | StyledSelectOption>): StyledSelectOption[] {
  return options.map((entry) =>
    typeof entry === "string" ? { value: entry, label: entry } : { value: entry.value, label: entry.label }
  );
}

export function StyledSelect({
  value,
  options,
  onChange,
  className = "",
  buttonClassName = "",
  disabled = false,
  ariaLabel
}: StyledSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selected = normalizedOptions.find((option) => option.value === value) ?? normalizedOptions[0] ?? null;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded border border-edge bg-canvas px-3 py-2 text-left text-sm text-text outline-none transition hover:border-text focus:border-text disabled:cursor-not-allowed disabled:opacity-40 ${buttonClassName}`}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <span aria-hidden className={`text-xs text-muted transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 rounded-md border border-edge bg-card shadow-[0_18px_38px_rgba(0,0,0,0.32)]">
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {normalizedOptions.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-text text-canvas"
                        : "text-text hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {active && <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Selected</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
