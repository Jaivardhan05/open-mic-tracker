"use client";

import { IconClock, IconGrid, IconBusking, IconStage, IconFreeSpots } from '../icons/NavIcons';
import type { ComponentType } from 'react';

export type SpotTypeFilter = 'all' | 'busking' | 'non_busking';

interface IconProps {
  className?: string;
}

interface FilterPillsProps {
  spotType: SpotTypeFilter;
  onSpotTypeChange: (value: SpotTypeFilter) => void;
  freeOnly: boolean;
  onFreeOnlyToggle: () => void;
  tonightOnly: boolean;
  onTonightOnlyToggle: () => void;
  cities: string[];
  city: string;
  onCityChange: (value: string) => void;
}

function simplePillClass(active: boolean) {
  return `px-4 py-2 rounded-full text-sm font-medium min-h-[44px] motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] ${
    active
      ? 'bg-[#38bdf8] text-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_0_16px_rgba(56,189,248,0.35)]'
      : 'content-glass text-zinc-300 hover:text-white backdrop-blur-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
  }`;
}

function pillClass(active: boolean) {
  return `group relative isolate overflow-hidden rounded-full text-sm font-medium min-h-[44px] pl-4 pr-10 motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] ${
    active
      ? 'bg-[#38bdf8] text-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_0_16px_rgba(56,189,248,0.35)]'
      : 'content-glass text-zinc-300 hover:text-white backdrop-blur-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
  }`;
}

function badgeClass(active: boolean) {
  return `absolute right-1 top-1 bottom-1 w-8 rounded-full flex items-center justify-center motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out group-hover:w-[calc(100%-0.5rem)] ${
    active ? 'bg-black/15 text-black' : 'bg-[#38bdf8]/20 text-[#38bdf8] group-hover:bg-[#38bdf8]/30'
  }`;
}

interface FilterPillProps {
  active: boolean;
  label: string;
  icon: ComponentType<IconProps>;
  onClick: () => void;
}

function FilterPill({ active, label, icon: Icon, onClick }: FilterPillProps) {
  return (
    <button type="button" onClick={onClick} className={pillClass(active)}>
      <span className="relative z-0 motion-safe:transition-opacity motion-safe:duration-150 group-hover:opacity-0">
        {label}
      </span>
      <span className={badgeClass(active)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
      </span>
    </button>
  );
}

const spotTypeConfig: Record<SpotTypeFilter, { label: string; icon: ComponentType<IconProps> }> = {
  all: { label: 'All', icon: IconGrid },
  busking: { label: 'Busking', icon: IconBusking },
  non_busking: { label: 'Non-Busking', icon: IconStage },
};

export function FilterPills({
  spotType,
  onSpotTypeChange,
  freeOnly,
  onFreeOnlyToggle,
  tonightOnly,
  onTonightOnlyToggle,
  cities,
  city,
  onCityChange,
}: FilterPillsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(['all', 'busking', 'non_busking'] as const).map((type) => (
          <FilterPill
            key={type}
            active={spotType === type}
            label={spotTypeConfig[type].label}
            icon={spotTypeConfig[type].icon}
            onClick={() => onSpotTypeChange(type)}
          />
        ))}

        <FilterPill active={freeOnly} label="Free" icon={IconFreeSpots} onClick={onFreeOnlyToggle} />

        <FilterPill active={tonightOnly} label="Tonight" icon={IconClock} onClick={onTonightOnlyToggle} />
      </div>

      {cities.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onCityChange('all')} className={simplePillClass(city === 'all')}>
            All Cities
          </button>
          {cities.map((c) => (
            <button key={c} type="button" onClick={() => onCityChange(c)} className={simplePillClass(city === c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
