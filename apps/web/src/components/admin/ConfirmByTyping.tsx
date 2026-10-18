interface ConfirmByTypingProps {
  id: string;
  /** The word the admin has to type. */
  word: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// True when `value` is `word`, ignoring case and surrounding spaces.
export function matchesTypedWord(value: string, word: string) {
  return value.trim().toLowerCase() === word.trim().toLowerCase();
}

// A float-input the admin must fill with `word` before a destructive button
// enables. The caller decides what "matched" gates (see matchesTypedWord).
export default function ConfirmByTyping({ id, word, value, onChange, disabled }: ConfirmByTypingProps) {
  return (
    <div className="float-field">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="float-input"
      />
      <label className="float-label" htmlFor={id}>
        Type &ldquo;{word}&rdquo; to confirm
      </label>
      <span className="float-bar" aria-hidden="true" />
    </div>
  );
}
