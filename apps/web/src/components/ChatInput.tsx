"use client";

import { KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mobile-menu-glass fixed bottom-0 left-0 right-0 border-t border-white/10 px-4 pb-4 pt-3 pb-safe backdrop-blur-[40px] backdrop-saturate-[120%]">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find a spot… e.g. busking tonight after 8pm"
          className="content-glass w-full rounded-full px-4 py-3 text-base text-white placeholder:text-zinc-400 focus:outline-none backdrop-blur-[12px]"
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="flex h-11 min-w-[64px] items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-50"
        >
          {isLoading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
          ) : (
            "Go"
          )}
        </button>
      </div>
    </div>
  );
}
