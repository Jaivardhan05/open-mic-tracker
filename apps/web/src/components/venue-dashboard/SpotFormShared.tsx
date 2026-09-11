"use client";

import { useEffect, useRef, useState } from "react";

import CtaButton from "@/components/CtaButton";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClock } from "@/components/icons/NavIcons";
import { formatSpotDate, formatTime12h } from "@/lib/formatDate";

// Shared building blocks for the "Add new shows" / "Edit Show" modals —
// pulled out of AddShowForm so both forms draw from one definition instead
// of forking the panel chrome, fields, and calendar/time pickers.
// See specs/venue-dashboard.md §5.2 / §5.4 / §9.4.

// Matches RequestsPanel's solid dark-navy panel fill / card fill.
export const PANEL_BG = "rgba(6,12,32,0.97)";
export const DROPDOWN_BG = "rgba(19,30,58,0.97)";

// Closes an open popover on outside click or Escape.
export function useDismiss(ref: React.RefObject<HTMLElement | null>, onDismiss: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handlePointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [active, ref, onDismiss]);
}

// Reuses the global CtaButton (underline + arrow) as a toggle/tab pair —
// `active` already exists on CtaButton for exactly this. Unselected options
// dim to a flat, muted state rather than losing their color entirely, so
// the pair still reads as one control.
export function ToggleCta({
  selected,
  variant,
  onClick,
  children,
}: {
  selected: boolean;
  variant?: "default" | "busking" | "free" | "hosting";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <CtaButton
      type="button"
      active={selected}
      variant={variant}
      onClick={onClick}
      className={selected ? "" : "opacity-40 hover:opacity-80"}
    >
      {children}
    </CtaButton>
  );
}

// Plain numeric field: label above, underline that lights up cyan on focus,
// no native stepper.
export function NumberField({
  id,
  label,
  value,
  onChange,
  onFocus,
  prefix,
  min,
  max,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  prefix?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wide transition-colors"
        style={{ color: isFocused ? "#38bdf8" : "rgba(255,255,255,0.5)" }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-1.5 border-b py-2 transition-colors"
        style={{ borderColor: isFocused ? "#38bdf8" : "rgba(255,255,255,0.2)" }}
      >
        {prefix ? <span className="text-sm text-zinc-500">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="no-spinner w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}

// A pool section's colored heading — flat text color only (no gradient/glow),
// per specs/venue-dashboard.md §9.4: busking blue, non-busking pink, hosting
// yellow, matching the colors already used for spot_type elsewhere in the app.
export function PoolLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
      {children}
    </p>
  );
}

// Free/Amount price control, shared across all three pool sections in
// AddShowForm/EditShowForm (previously forked per-form as a single price
// field before the 3-pool split — see specs/venue-dashboard.md §9.4).
export function PriceField({
  idPrefix,
  isFree,
  price,
  setIsFree,
  setPrice,
}: {
  idPrefix: string;
  isFree: boolean;
  price: string;
  setIsFree: (value: boolean) => void;
  setPrice: (value: string) => void;
}) {
  return (
    <div className="flex items-end gap-5">
      <ToggleCta selected={isFree} variant="free" onClick={() => setIsFree(true)}>
        Free
      </ToggleCta>
      <div className="flex-1">
        <NumberField
          id={`${idPrefix}-price`}
          label="Amount"
          prefix="₹"
          value={price}
          onFocus={() => setIsFree(false)}
          onChange={(v) => {
            setIsFree(false);
            setPrice(v);
          }}
          min={0}
          placeholder="0"
        />
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// A 6x7 grid of real dates spanning the given month, padded with the tail
// of the previous month and the head of the next so every row is full.
function buildCalendarGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function CalendarDropdown({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (value: string) => void;
}) {
  const selected = parseDateValue(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const grid = buildCalendarGrid(viewYear, viewMonth);

  return (
    <div
      className="surface-grain w-64 overflow-hidden rounded-xl border border-white/10 p-3"
      style={{
        backgroundColor: DROPDOWN_BG,
        backdropFilter: "blur(40px) saturate(140%)",
        WebkitBackdropFilter: "blur(40px) saturate(140%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 40px -12px rgba(0,0,0,0.65)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconChevronLeft className="h-3.5 w-3.5" />
        </button>
        <p className="font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.08em] text-white">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === viewMonth;
          const cellValue = toDateValue(d);
          const isSelected = cellValue === value;
          const isToday = isSameDay(d, today);

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(cellValue)}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                isSelected
                  ? "bg-[#38bdf8] font-semibold text-[#04121c]"
                  : inMonth
                    ? "text-zinc-200 hover:bg-white/10"
                    : "text-zinc-700 hover:bg-white/5"
              } ${isToday && !isSelected ? "ring-1 ring-inset ring-[#38bdf8]/50" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Every 15-minute mark across the day, in 24h "HH:MM" form.
const TIME_OPTIONS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function TimeDropdown({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (value: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]')?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div
      className="surface-grain w-40 overflow-hidden rounded-xl border border-white/10"
      style={{
        backgroundColor: DROPDOWN_BG,
        backdropFilter: "blur(40px) saturate(140%)",
        WebkitBackdropFilter: "blur(40px) saturate(140%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 40px -12px rgba(0,0,0,0.65)",
      }}
    >
      <div ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1.5">
        {TIME_OPTIONS.map((t) => {
          const isSelected = t === value;
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected}
              onClick={() => onSelect(t)}
              className={`block w-full px-4 py-1.5 text-left text-sm tabular-nums transition-colors ${
                isSelected ? "bg-[#38bdf8]/15 font-semibold text-[#38bdf8]" : "text-zinc-200 hover:bg-white/10"
              }`}
            >
              {formatTime12h(t).toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The field itself sits on the same underline language as the rest of the
// form. What opens beneath it is a fully custom calendar / time list, not
// the browser's own popup — that popup is effectively unstylable across
// browsers (no font, spacing, or panel control at all), so it can never
// read as the same product as the modal it opens from.
export function DateTimeField({
  id,
  type,
  label,
  value,
  onChange,
}: {
  id: string;
  type: "date" | "time";
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(containerRef, () => setOpen(false), open);

  const hasValue = Boolean(value);
  const display = hasValue
    ? type === "date"
      ? formatSpotDate(value)
      : formatTime12h(value).toUpperCase()
    : type === "date"
      ? "Select date"
      : "--:-- --";

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wide transition-colors"
        style={{ color: open ? "#38bdf8" : "rgba(255,255,255,0.5)" }}
      >
        {label}
      </label>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={type === "date" ? "grid" : "listbox"}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b py-2 text-left transition-colors"
        style={{ borderColor: open ? "#38bdf8" : "rgba(255,255,255,0.2)" }}
      >
        <span className={`text-sm tabular-nums ${hasValue ? "text-white" : "text-zinc-600"}`}>{display}</span>
        <span className={open ? "text-[#38bdf8]" : "text-zinc-500"}>
          {type === "date" ? <IconCalendar className="h-4 w-4" /> : <IconClock className="h-4 w-4" />}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2">
          {type === "date" ? (
            <CalendarDropdown
              value={value}
              onSelect={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          ) : (
            <TimeDropdown
              value={value}
              onSelect={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

// Shared modal shell: dim/blurred backdrop confined to the dashboard's
// content frame (never the fixed navbar/sidebar), same panel surface as
// RequestsPanel/CancelShowDialog. Both AddShowForm and EditShowForm render
// their own header/body inside this so the chrome can't drift apart.
export function SpotFormModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-lg lg:left-[var(--sidebar-w)]"
      onClick={onClose}
    >
      <div
        className="surface-grain max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.08]"
        style={{
          backgroundColor: PANEL_BG,
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
