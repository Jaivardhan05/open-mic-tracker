"use client";

import { IconClose } from "@/components/icons/NavIcons";

export const VENUE_SEARCH_MAX = 100;

interface VenueFilterBarProps {
  search: string;
  onSearchChange: (next: string) => void;
  city: string;
  cities: string[];
  onCityChange: (next: string) => void;
}

// Name search plus a city dropdown. The status filter lives in the summary
// strip tiles. Search is by venue name only.
export default function VenueFilterBar({
  search,
  onSearchChange,
  city,
  cities,
  onCityChange,
}: VenueFilterBarProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      <div className="float-field w-full md:max-w-md">
        <input
          id="admin-venues-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          maxLength={VENUE_SEARCH_MAX}
          placeholder=" "
          className="float-input pr-8"
          autoComplete="off"
        />
        <label className="float-label" htmlFor="admin-venues-search">
          Search venues by name...
        </label>
        <span className="float-bar" aria-hidden="true" />
        {search !== "" ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="w-full md:w-56">
        <label
          htmlFor="admin-venues-city"
          className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500"
        >
          City
        </label>
        <select
          id="admin-venues-city"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="float-input mt-1"
        >
          <option value="" className="bg-zinc-900 text-white">
            All cities
          </option>
          {cities.map((c) => (
            <option key={c} value={c} className="bg-zinc-900 text-white">
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
