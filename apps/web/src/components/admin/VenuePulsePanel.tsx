import type { AdminVenueStats } from "@repo/types";

import CtaButton from "@/components/CtaButton";

// Requests-panel status colors (RequestsPanel.tsx), plus the red already used
// for "rejected". Stack order keeps gray away from blue so the bar reads for
// full-color readers; each segment is also named in the legend with its count.
const COLORS = {
  accepted: "#38bdf8",
  pending: "#facc15",
  waitlisted: "#a1a1aa",
  cancelled: "#f87171",
} as const;

interface VenuePulsePanelProps {
  stats: AdminVenueStats | null;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
}

const HEADING =
  "font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white";
const LABEL =
  "font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-400";

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.04em] text-white">{value}</span>
        {note ? <span className="text-xs text-zinc-500">{note}</span> : null}
      </dd>
    </div>
  );
}

// Flat ring: a quiet track and one arc for the share of knowable requests that
// were ever accepted. "n/a" draws the track only.
function AcceptanceRing({ rate }: { rate: number | null }) {
  const size = 120;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = rate === null ? 0 : circumference * rate;

  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        {rate !== null && filled > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={COLORS.accepted}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {rate === null ? (
          <span className="font-[family-name:var(--font-cormorant)] text-2xl italic text-zinc-400">n/a</span>
        ) : (
          <span className="font-[family-name:var(--font-bebas)] text-4xl tracking-[0.04em] text-white">
            {Math.round(rate * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Body({ stats }: { stats: AdminVenueStats }) {
  const { requests, shows, acceptance, cancelled_after_acceptance: after } = stats;
  const cancelled = requests.cancelled_by_comedian + requests.cancelled_by_venue;

  const segments = [
    { key: "accepted", label: "Accepted", count: requests.accepted, color: COLORS.accepted },
    { key: "pending", label: "Pending", count: requests.pending, color: COLORS.pending },
    { key: "waitlisted", label: "Waitlisted", count: requests.waitlisted, color: COLORS.waitlisted },
    { key: "cancelled", label: "Cancelled", count: cancelled, color: COLORS.cancelled },
  ];

  const rate = acceptance.knowable > 0 ? acceptance.ever_accepted / acceptance.knowable : null;
  const summary = segments.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(", ");

  return (
    <>
      {!stats.has_owner ? (
        <p className="mt-1 font-[family-name:var(--font-cormorant)] text-lg italic text-zinc-400">
          No owner on record, so there is no activity to show.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Requests received and where they ended up */}
        <div>
          <p className={LABEL}>Requests received</p>
          <p className="font-[family-name:var(--font-bebas)] text-6xl leading-none tracking-[0.04em] text-white md:text-7xl">
            {requests.total}
          </p>

          {requests.total > 0 ? (
            <div
              className="mt-4 flex h-3 w-full gap-[2px]"
              role="img"
              aria-label={`Requests by outcome: ${summary}`}
            >
              {segments
                .filter((s) => s.count > 0)
                .map((s) => (
                  <span
                    key={s.key}
                    title={`${s.label}: ${s.count}`}
                    className="h-full rounded-[4px]"
                    style={{ backgroundColor: s.color, flexGrow: s.count, flexBasis: 0, minWidth: 6 }}
                  />
                ))}
            </div>
          ) : (
            <div className="mt-4 h-3 w-full rounded-[4px] border border-dashed border-white/20" aria-hidden="true" />
          )}

          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
                {s.label}
                <span className="ml-auto font-[family-name:var(--font-bebas)] text-lg tracking-[0.04em] text-white">
                  {s.count}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-white/15 pt-4">
            <Fact label="Shows created" value={String(shows.created)} />
            <Fact label="Shows cancelled" value={String(shows.cancelled)} />
          </dl>
        </div>

        {/* Acceptance rate and who cancelled */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <AcceptanceRing rate={rate} />
            <div className="min-w-0">
              <p className={LABEL}>Acceptance rate</p>
              <p className="mt-1 text-sm text-zinc-300">
                {rate === null
                  ? "Nothing to measure yet."
                  : `${acceptance.ever_accepted} of ${acceptance.knowable} requests were accepted at some point.`}
              </p>
              {acceptance.excluded > 0 ? (
                <p className="mt-1 font-[family-name:var(--font-cormorant)] text-sm italic text-zinc-500">
                  {acceptance.excluded} older cancelled {acceptance.excluded === 1 ? "request" : "requests"} left out:
                  they were cancelled before acceptance was recorded.
                </p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-dashed border-white/15 pt-4">
            <p className={LABEL}>Request cancellations</p>
            <dl className="mt-2 grid grid-cols-2 gap-4">
              <Fact label="By venue" value={String(requests.cancelled_by_venue)} />
              <Fact label="By comedian" value={String(requests.cancelled_by_comedian)} />
              <Fact label="By venue, after accepting" value={String(after.by_venue)} />
              <Fact label="By comedian, after accepting" value={String(after.by_comedian)} />
            </dl>
            <p className="mt-3 font-[family-name:var(--font-cormorant)] text-sm italic text-zinc-500">
              Cancellations by the venue include those caused by a suspension.
              {acceptance.excluded > 0
                ? ` The "after accepting" figures can't count the ${acceptance.excluded} older ${
                    acceptance.excluded === 1 ? "cancellation" : "cancellations"
                  } (n/a).`
                : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// "Pulse": how busy this venue has been, all-time. Own loading/error states so
// the rest of the dossier is never blocked by it.
export default function VenuePulsePanel({ stats, isLoading, error, onRetry }: VenuePulsePanelProps) {
  return (
    <section className="glass-panel rounded-2xl p-5" aria-labelledby="pulse-heading" aria-busy={isLoading}>
      <h2 id="pulse-heading" className={HEADING}>
        Pulse
      </h2>
      <p className="mt-1 font-[family-name:var(--font-cormorant)] text-lg italic text-zinc-400">
        All-time activity. Shows are shows; requests are individual spot requests.
      </p>

      {isLoading && !stats ? (
        <div className="mt-4 animate-pulse" aria-label="Loading activity">
          <div className="h-16 w-40 rounded-xl bg-white/5" />
          <div className="mt-4 h-3 w-full rounded-[4px] bg-white/5" />
        </div>
      ) : stats ? (
        <>
          {error ? (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <Body stats={stats} />
        </>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-sm text-red-400" role="alert">
            {error || "Couldn't load activity."}
          </p>
          <CtaButton type="button" onClick={onRetry}>
            Try again
          </CtaButton>
        </div>
      )}
    </section>
  );
}
