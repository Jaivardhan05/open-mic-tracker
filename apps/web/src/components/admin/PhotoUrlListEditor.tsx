"use client";

import { useRef, useState } from "react";

import { PHOTO_HOSTS, PHOTO_MAX_COUNT, PHOTO_URL_MAX_LENGTH, photoUrlError } from "@repo/types/photoHosts.js";

interface PhotoUrlListEditorProps {
  /** The starting list; later changes are reported through onChange. */
  initial: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

interface Row {
  id: number;
  url: string;
}

const ICON_BUTTON =
  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-[#38bdf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] disabled:opacity-30 disabled:hover:text-zinc-400";

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Trash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Photo URLs as an ordered list: up/down to reorder, the first is the cover
// shown on /venues. URL-only (no uploads, no previews). Each row is checked
// with the same rule the API enforces (photoUrlError), so what you see here is
// what the server will accept.
export default function PhotoUrlListEditor({ initial, onChange, disabled }: PhotoUrlListEditorProps) {
  const nextId = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((url, id) => ({ id, url })));

  function update(next: Row[]) {
    setRows(next);
    onChange(next.map((r) => r.url));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    if (!a || !b) return;
    const next = rows.slice();
    next[index] = b;
    next[target] = a;
    update(next);
  }

  return (
    <div>
      <p className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500">
        Photos ({rows.length}/{PHOTO_MAX_COUNT})
      </p>

      <ol className="mt-2 flex flex-col gap-3">
        {rows.map((row, i) => {
          const trimmed = row.url.trim();
          const problem = trimmed === "" ? "Enter a URL or remove this row." : photoUrlError(trimmed);
          return (
            <li key={row.id}>
              <div className="flex items-start gap-1">
                <span
                  className={`mt-3 w-12 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide ${
                    i === 0 ? "bg-[#38bdf8]/15 text-[#38bdf8]" : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {i === 0 ? "Cover" : i + 1}
                </span>
                <input
                  type="url"
                  value={row.url}
                  onChange={(e) => update(rows.map((r) => (r.id === row.id ? { ...r, url: e.target.value } : r)))}
                  disabled={disabled}
                  maxLength={PHOTO_URL_MAX_LENGTH + 50}
                  placeholder="https://…"
                  aria-label={`Photo ${i + 1} URL`}
                  aria-invalid={problem ? true : undefined}
                  className="float-input min-w-0 flex-1"
                />
                <button
                  type="button"
                  className={ICON_BUTTON}
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                  aria-label={`Move photo ${i + 1} up`}
                >
                  <Arrow up />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === rows.length - 1}
                  aria-label={`Move photo ${i + 1} down`}
                >
                  <Arrow up={false} />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  onClick={() => update(rows.filter((r) => r.id !== row.id))}
                  disabled={disabled}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <Trash />
                </button>
              </div>
              {problem ? <p className="mt-1 pl-[3.25rem] text-[11px] text-red-400">{problem}</p> : null}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => update([...rows, { id: nextId.current++, url: "" }])}
        disabled={disabled || rows.length >= PHOTO_MAX_COUNT}
        className="mt-2 min-h-[44px] text-sm text-[#38bdf8] hover:underline disabled:text-zinc-600 disabled:no-underline"
      >
        {rows.length >= PHOTO_MAX_COUNT ? `Maximum of ${PHOTO_MAX_COUNT} photos` : "Add photo"}
      </button>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        https only, from {PHOTO_HOSTS.map((h) => h.hostname).join(", ")}. The first photo is the cover.
      </p>
    </div>
  );
}
