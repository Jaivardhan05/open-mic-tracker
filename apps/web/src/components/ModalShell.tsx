"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { IconClose } from "@/components/icons/NavIcons";

// The Requests modal's chrome (RequestsPanel): overlay below the navbar and
// beside the sidebar, solid dark-navy glass panel, Bebas header, 44px close
// button, click-outside to close. Same fill/blur values as RequestsPanel and
// CancelShowDialog, kept in sync by hand. Adds dialog semantics and Escape.
const PANEL_BG = "rgba(6,12,32,0.97)";

interface ModalShellProps {
  title: string;
  /** Small Bebas line under the title (RequestsPanel's date line). */
  subtitle?: string;
  /** Leading marker in the header, e.g. a status icon. */
  leading?: ReactNode;
  /** Color of the flat header spine; omit for none. */
  spineColor?: string;
  onClose: () => void;
  /** False while an action is running: blocks close button, Escape and click-outside. */
  dismissible?: boolean;
  maxWidthClass?: string;
  children: ReactNode;
}

export default function ModalShell({
  title,
  subtitle,
  leading,
  spineColor,
  onClose,
  dismissible = true,
  maxWidthClass = "max-w-md",
  children,
}: ModalShellProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissibleRef.current) {
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-lg lg:left-[var(--sidebar-w)]"
      onClick={() => {
        if (dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`surface-grain max-h-[85vh] w-full ${maxWidthClass} overflow-y-auto rounded-2xl border border-white/[0.08] p-6 outline-none`}
        style={{
          backgroundColor: PANEL_BG,
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {spineColor ? (
              <span
                className="w-[3px] flex-shrink-0 self-stretch rounded-full"
                style={{ backgroundColor: spineColor }}
                aria-hidden="true"
              />
            ) : null}
            {leading}
            <div>
              <h2
                id={titleId}
                className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.12em] text-zinc-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-white disabled:opacity-40"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
