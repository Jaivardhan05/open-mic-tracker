import type { AdminVenueDetail } from "@repo/types";

import { safeHttpUrl, safeMailto } from "@/lib/safeLinks";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-zinc-200">{children}</dd>
    </div>
  );
}

function NotSet() {
  return <span className="font-[family-name:var(--font-cormorant)] text-base italic text-zinc-600">Not set</span>;
}

// A stored link, shown as text. It is only made clickable when it passes the
// same http(s)-only check the request cards use (saved values are untrusted).
function LinkValue({ value }: { value: string | null }) {
  if (!value) return <NotSet />;
  const href = safeHttpUrl(value);
  if (!href) return <span className="break-all text-zinc-400">{value}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-zinc-200 underline decoration-white/20 underline-offset-2 hover:text-[#38bdf8]"
    >
      {value}
    </a>
  );
}

// Read view of what the venue shows the public. Address is not part of this
// project. Photos are listed as URLs only (no previews); the first one is the
// cover shown on /venues.
export default function VenueProfilePanel({ venue }: { venue: AdminVenueDetail }) {
  const email = safeMailto(venue.contact_email);

  return (
    <section className="glass-panel rounded-2xl p-5" aria-labelledby="profile-heading">
      <h2
        id="profile-heading"
        className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white"
      >
        Profile
      </h2>

      <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Name">{venue.name}</Field>
        <Field label="City">{venue.city}</Field>

        <div className="md:col-span-2">
          <Field label="Description">
            {venue.description?.trim() ? <span className="whitespace-pre-wrap">{venue.description}</span> : <NotSet />}
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label={`Photos (${venue.photos.length}/8)`}>
            {venue.photos.length === 0 ? (
              <NotSet />
            ) : (
              <ol className="flex flex-col gap-1.5">
                {venue.photos.map((url, i) => (
                  <li key={`${i}-${url}`} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        i === 0 ? "bg-[#38bdf8]/15 text-[#38bdf8]" : "bg-white/5 text-zinc-500"
                      }`}
                    >
                      {i === 0 ? "Cover" : i + 1}
                    </span>
                    <span className="break-all text-zinc-300">{url}</span>
                  </li>
                ))}
              </ol>
            )}
          </Field>
        </div>

        <Field label="Instagram">
          <LinkValue value={venue.instagram_url} />
        </Field>
        <Field label="X">
          <LinkValue value={venue.x_url} />
        </Field>
        <Field label="Google Maps">
          <LinkValue value={venue.maps_url} />
        </Field>
        <Field label="Contact email">
          {venue.contact_email ? (
            email ? (
              <a href={email} className="break-all underline decoration-white/20 underline-offset-2 hover:text-[#38bdf8]">
                {venue.contact_email}
              </a>
            ) : (
              <span className="break-all text-zinc-400">{venue.contact_email}</span>
            )
          ) : (
            <NotSet />
          )}
        </Field>
        <Field label="Contact phone">{venue.contact_phone?.trim() ? venue.contact_phone : <NotSet />}</Field>
      </dl>
    </section>
  );
}
