"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

import Toast from "@/components/Toast";

// The app's one shared "small confirmation" primitive — see
// specs/toast-notification-spec.md. Only a "success" look ships today, but
// the entry shape leaves room for future variants (error/info) without an
// API change, the same way CtaButton grew variants incrementally.
export type ToastVariant = "success";

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    // Removal is driven by Toast itself finishing its exit animation
    // (onDismiss below), not a timer here — keeps the animation timings in
    // one place (Toast.tsx) instead of split across two files.
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Fixed, bottom-center, above every layout's chrome — see
          specs/toast-notification-spec.md for why this position was chosen
          over a per-corner desktop/mobile split. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} variant={t.variant} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
