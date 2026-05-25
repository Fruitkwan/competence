"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmployeePickerOption = {
  employee_id: string;
  full_name: string;
  job_title: string;
};

type Props = {
  options: EmployeePickerOption[];
  value: string;
  onChange: (employeeId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Render a small "Clear" button when set */
  clearable?: boolean;
  /** Maximum items shown in the dropdown before scrolling */
  maxItems?: number;
};

export function EmployeePicker({
  options,
  value,
  onChange,
  placeholder = "Search by ID, name, job title…",
  disabled,
  className,
  clearable,
  maxItems = 50,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => options.find((o) => o.employee_id === value) ?? null,
    [options, value],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxItems);
    return options
      .filter((o) => {
        const hay = `${o.employee_id} ${o.full_name} ${o.job_title}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, maxItems);
  }, [options, query, maxItems]);

  // Reset highlight when filtered list changes.
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row scrolled into view.
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const child = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    child?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        pick(filtered[activeIndex].employee_id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          // Focus the search input next tick.
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-left text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30 dark:hover:bg-input/50",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{selected.full_name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {selected.employee_id} · {selected.job_title}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {clearable && selected && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown className="size-4 text-muted-foreground" />
        </span>
      </button>

      {/* Hidden input so the form sees the selected value if someone submits via DOM */}
      <input type="hidden" value={value} readOnly />

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
          )}
          role="dialog"
        >
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div
            ref={listRef}
            role="listbox"
            className="max-h-72 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No employees match &quot;{query}&quot;.
              </div>
            ) : (
              filtered.map((o, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = o.employee_id === value;
                return (
                  <button
                    type="button"
                    key={o.employee_id}
                    data-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(o.employee_id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isActive && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {o.full_name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {o.employee_id}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {o.job_title}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            )}
            {options.length > filtered.length && filtered.length === maxItems && (
              <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                Showing {maxItems} of {options.length}. Keep typing to narrow.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
