"use client";

import { useEffect, useRef, useState } from "react";

import type { AdminVenueDetail } from "@repo/types";
import { photoUrlError } from "@repo/types/photoHosts.js";

import CtaButton from "@/components/CtaButton";
import type { AdminVenueChanges } from "@/hooks/useAdminVenue";

import PhotoUrlListEditor from "./PhotoUrlListEditor";

const NAME_MIN = 2;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1000;
const LINK_MAX = 2048;
const EMAIL_MAX = 254;
const PHONE_MAX = 32;

interface VenueProfileEditorProps {
  venue: AdminVenueDetail;
  onSave: (changes: AdminVenueChanges) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  /** Lets the page warn before its own links leave with unsaved edits. */
  onDirtyChange: (dirty: boolean) => void;
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  type?: string;
  maxLength: number;
}

function TextField({ id, label, value, onChange, error, disabled, type = "text", maxLength }: TextFieldProps) {
  return (
    <div>
      <div className="float-field">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          disabled={disabled}
          maxLength={maxLength + 50}
          className="float-input"
          aria-invalid={error ? true : undefined}
        />
        <label className="float-label" htmlFor={id}>
          {label}
        </label>
        <span className="float-bar" aria-hidden="true" />
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}

function linkError(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (!/^https?:\/\//i.test(v)) return "Must start with http:// or https://";
  if (v.length > LINK_MAX) return `At most ${LINK_MAX} characters`;
  return undefined;
}

// Edit mode for the Profile panel. Seeds its form from the venue once (an
// action elsewhere on the page that refetches the venue does not wipe your
// typing), sends only the fields that changed, and keeps you here with the
// server's message if the save fails. Address is not part of this.
export default function VenueProfileEditor({ venue, onSave, onCancel, onDirtyChange }: VenueProfileEditorProps) {
  const [name, setName] = useState(venue.name);
  const [city, setCity] = useState(venue.city);
  const [description, setDescription] = useState(venue.description ?? "");
  const [photos, setPhotos] = useState<string[]>(venue.photos);
  const [instagram, setInstagram] = useState(venue.instagram_url ?? "");
  const [x, setX] = useState(venue.x_url ?? "");
  const [maps, setMaps] = useState(venue.maps_url ?? "");
  const [email, setEmail] = useState(venue.contact_email ?? "");
  const [phone, setPhone] = useState(venue.contact_phone ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous guard: state-based `disabled` can lose to a fast double-click.
  const saveLockRef = useRef(false);
  // What the form started from; changes are measured against this.
  const baseRef = useRef(venue);

  const cities = venue.allowed_cities.includes(venue.city) ? venue.allowed_cities : [venue.city, ...venue.allowed_cities];

  const base = baseRef.current;
  const changes: AdminVenueChanges = {};
  if (name.trim() !== base.name) changes.name = name.trim();
  if (city !== base.city) changes.city = city;
  if (description.trim() !== (base.description ?? "").trim()) changes.description = description.trim();
  if (instagram.trim() !== (base.instagram_url ?? "")) changes.instagram_url = instagram.trim();
  if (x.trim() !== (base.x_url ?? "")) changes.x_url = x.trim();
  if (maps.trim() !== (base.maps_url ?? "")) changes.maps_url = maps.trim();
  if (email.trim() !== (base.contact_email ?? "")) changes.contact_email = email.trim();
  if (phone.trim() !== (base.contact_phone ?? "")) changes.contact_phone = phone.trim();
  const trimmedPhotos = photos.map((p) => p.trim());
  if (trimmedPhotos.length !== base.photos.length || trimmedPhotos.some((p, i) => p !== base.photos[i])) {
    changes.photos = trimmedPhotos;
  }
  const dirty = Object.keys(changes).length > 0;

  const nameLength = name.trim().length;
  const nameError = nameLength < NAME_MIN || nameLength > NAME_MAX ? `Use ${NAME_MIN}-${NAME_MAX} characters.` : undefined;
  const descriptionError = description.length > DESCRIPTION_MAX ? `At most ${DESCRIPTION_MAX} characters.` : undefined;
  const emailTrimmed = email.trim();
  const emailError =
    emailTrimmed === ""
      ? undefined
      : emailTrimmed.length > EMAIL_MAX
        ? `At most ${EMAIL_MAX} characters`
        : !/^[^@]+@[^@]+\.[^@]+$/.test(emailTrimmed)
          ? "Enter a valid email address"
          : undefined;
  const phoneError = phone.trim().length > PHONE_MAX ? `At most ${PHONE_MAX} characters` : undefined;
  const instagramError = linkError(instagram);
  const xError = linkError(x);
  const mapsError = linkError(maps);
  // The server checks photos only when they are sent, so an untouched legacy
  // photo (e.g. an old localhost URL) must not block saving other fields.
  const photosOk = !changes.photos || trimmedPhotos.every((p) => p !== "" && photoUrlError(p) === null);

  const valid =
    !nameError && !descriptionError && !emailError && !phoneError && !instagramError && !xError && !mapsError && photosOk;
  const canSave = dirty && valid && !isSaving;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // Closing or reloading the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saveLockRef.current || !canSave) return;
    saveLockRef.current = true;
    setIsSaving(true);
    setError("");
    const result = await onSave(changes);
    if (!result.success) {
      setError(result.error ?? "Couldn't save. Try again.");
      setIsSaving(false);
      saveLockRef.current = false;
    }
    // Success: the panel leaves edit mode.
  }

  function handleCancel() {
    if (isSaving) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onCancel();
  }

  return (
    <form onSubmit={handleSave} noValidate className="mt-4 flex flex-col gap-5">
      <TextField id="edit-name" label="Name" value={name} onChange={setName} error={nameError} disabled={isSaving} maxLength={NAME_MAX} />

      <div>
        <label
          htmlFor="edit-city"
          className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500"
        >
          City
        </label>
        <select
          id="edit-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={isSaving}
          className="float-input mt-1"
        >
          {cities.map((c) => (
            <option key={c} value={c} className="bg-zinc-900 text-white">
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="float-field">
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder=" "
            rows={3}
            disabled={isSaving}
            className="float-input resize-none"
            aria-describedby="edit-description-count"
          />
          <label className="float-label" htmlFor="edit-description">
            Description
          </label>
          <span className="float-bar" aria-hidden="true" />
        </div>
        <p
          id="edit-description-count"
          className={`mt-1 text-right text-[11px] ${descriptionError ? "text-red-400" : "text-zinc-600"}`}
        >
          {description.length}/{DESCRIPTION_MAX}
        </p>
      </div>

      <PhotoUrlListEditor initial={venue.photos} onChange={setPhotos} disabled={isSaving} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField id="edit-instagram" label="Instagram" type="url" value={instagram} onChange={setInstagram} error={instagramError} disabled={isSaving} maxLength={LINK_MAX} />
        <TextField id="edit-x" label="X" type="url" value={x} onChange={setX} error={xError} disabled={isSaving} maxLength={LINK_MAX} />
        <TextField id="edit-maps" label="Google Maps" type="url" value={maps} onChange={setMaps} error={mapsError} disabled={isSaving} maxLength={LINK_MAX} />
        <TextField id="edit-email" label="Contact email" type="email" value={email} onChange={setEmail} error={emailError} disabled={isSaving} maxLength={EMAIL_MAX} />
        <TextField id="edit-phone" label="Contact phone" type="tel" value={phone} onChange={setPhone} error={phoneError} disabled={isSaving} maxLength={PHONE_MAX} />
      </div>

      <p className="text-xs text-zinc-500">
        Saved changes go live straight away. The owner is not notified of admin edits.
      </p>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1 sm:flex-row sm:gap-x-5">
        <CtaButton type="submit" className="min-h-[44px] justify-center sm:justify-start" disabled={!canSave}>
          {isSaving ? "Saving…" : "Save changes"}
        </CtaButton>
        <CtaButton
          type="button"
          className="min-h-[44px] justify-center sm:justify-start"
          disabled={isSaving}
          onClick={handleCancel}
        >
          Cancel
        </CtaButton>
      </div>
    </form>
  );
}
