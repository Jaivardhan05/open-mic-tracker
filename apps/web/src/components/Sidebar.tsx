"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useAuth } from "../context/AuthContext";
import {
  IconHome,
  IconVenues,
  IconInfo,
  IconMail,
  IconChevronCollapse,
  IconLogout,
} from "./icons/NavIcons";

interface SidebarProps {
  onFilter: (query: string) => void;
}

interface NavEntry {
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  href?: string;
  filterQuery?: string;
}

const primaryEntries: NavEntry[] = [
  { label: "Home", icon: IconHome, href: "/home" },
];

const exploreEntries: NavEntry[] = [
  { label: "All Venues", icon: IconVenues, href: "/venues" },
];

const supportEntries: NavEntry[] = [
  { label: "How It Works", icon: IconInfo, href: "/support" },
  { label: "Contact Us", icon: IconMail, href: "/support#contact" },
];

const COLLAPSE_KEY = "openmic_sidebar_collapsed";
const EXPANDED_W = "14rem";
const COLLAPSED_W = "4.5rem";

export default function Sidebar({ onFilter }: SidebarProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY) === "true";
    setCollapsed(stored);
    document.documentElement.style.setProperty("--sidebar-w", stored ? COLLAPSED_W : EXPANDED_W);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_KEY, String(next));
    document.documentElement.style.setProperty("--sidebar-w", next ? COLLAPSED_W : EXPANDED_W);
  }

  function handleEntryClick(entry: NavEntry) {
    if (entry.href) {
      router.push(entry.href);
      return;
    }
    if (entry.filterQuery !== undefined) {
      onFilter(entry.filterQuery);
    }
  }

  function isActive(entry: NavEntry) {
    if (entry.href) {
      return pathname === entry.href.split("#")[0];
    }
    return entry.label === "Home" && pathname === "/home";
  }

  function renderEntry(entry: NavEntry) {
    const active = isActive(entry);
    const Icon = entry.icon;

    return (
      <button
        key={entry.label}
        type="button"
        onClick={() => handleEntryClick(entry)}
        className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] ${
          collapsed ? "justify-center" : ""
        } ${
          active
            ? "bg-[#38bdf8]/10 text-white"
            : "text-zinc-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#38bdf8]" />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#38bdf8]" : ""}`} />
        {!collapsed && <span className="truncate">{entry.label}</span>}
        {collapsed && (
          <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg bg-zinc-900/95 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg ring-1 ring-white/10 motion-safe:transition-opacity motion-safe:duration-150 group-hover:opacity-100">
            {entry.label}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      className={`sidebar-glass fixed bottom-0 left-0 top-14 z-30 hidden flex-col pt-6 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out lg:flex ${
        collapsed ? "w-[4.5rem] px-2" : "w-56 px-3"
      }`}
    >
      <div className="space-y-1">{primaryEntries.map(renderEntry)}</div>

      {collapsed ? (
        <div className="my-4 h-px bg-zinc-800/60" />
      ) : (
        <p className="mb-2 mt-6 px-3 text-xs font-semibold tracking-widest text-zinc-600">EXPLORE</p>
      )}
      <div className="space-y-1">{exploreEntries.map(renderEntry)}</div>

      {collapsed ? (
        <div className="my-4 h-px bg-zinc-800/60" />
      ) : (
        <p className="mb-2 mt-6 px-3 text-xs font-semibold tracking-widest text-zinc-600">SUPPORT</p>
      )}
      <div className="space-y-1">{supportEntries.map(renderEntry)}</div>

      <div className="mt-auto space-y-1 border-t border-zinc-800/50 pt-4">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 motion-safe:transition-all motion-safe:duration-150 motion-safe:active:scale-[0.97] hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <IconChevronCollapse
            className={`h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/auth");
          }}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-400 motion-safe:transition-all motion-safe:duration-150 motion-safe:active:scale-[0.97] hover:bg-red-900/20 hover:text-red-300 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <IconLogout className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}
