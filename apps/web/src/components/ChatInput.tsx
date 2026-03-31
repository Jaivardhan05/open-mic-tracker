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
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950 px-4 pb-4 pt-3">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find a spot… e.g. busking tonight after 8pm"
          className="w-full rounded-full bg-zinc-800 px-4 py-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none"
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="flex h-11 min-w-14 items-center justify-center rounded-full bg-white px-4 text-sm font-bold text-black disabled:opacity-50"
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
