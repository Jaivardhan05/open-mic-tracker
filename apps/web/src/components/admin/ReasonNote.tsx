interface ReasonNoteProps {
  /** Renders nothing when empty, so a status with no recorded reason stays clean. */
  reason: string | null | undefined;
  /** Status color for the leading rule. */
  color: string;
  /** Small caption above the quote, e.g. "Earlier note". */
  caption?: string;
  className?: string;
}

// An admin's reason, set in the site's italic voice with a flat colored rule.
export default function ReasonNote({ reason, color, caption, className = "" }: ReasonNoteProps) {
  const text = reason?.trim();
  if (!text) return null;

  return (
    <div className={`border-l-2 pl-3 ${className}`} style={{ borderColor: color }}>
      {caption ? (
        <p className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500">
          {caption}
        </p>
      ) : null}
      <p className="font-[family-name:var(--font-cormorant)] text-base italic leading-snug text-zinc-300">
        &ldquo;{text}&rdquo;
      </p>
    </div>
  );
}
