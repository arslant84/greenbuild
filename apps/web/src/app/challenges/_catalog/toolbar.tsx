"use client";

import { type RefObject, useEffect, useRef } from "react";
import { GridViewIcon, SearchIcon, SelectChevronIcon, TableViewIcon } from "../../../ui/icons-catalog";
import type { CatalogParams } from "./catalog-params";

// useFocusShortcut focuses the search on "/" or Cmd/Ctrl+K, unless the player is typing elsewhere.
function useFocusShortcut(target: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      const slash = event.key === "/" && !typing;
      const commandK = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (slash || commandK) {
        event.preventDefault();
        target.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);
}

// Figma › Command Control Toolbar.
export function Toolbar({ params }: { params: CatalogParams }) {
  return (
    <div className="pb-5">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <SearchForm params={params} />
        <ViewControls />
      </div>
    </div>
  );
}

// Figma › Wide Search Input. It submits with the page's other filters kept.
function SearchForm({ params }: { params: CatalogParams }) {
  const search = useRef<HTMLInputElement>(null);
  useFocusShortcut(search);
  const kept = [...params.skill.map((value) => ["skill", value]), ...params.sla.map((value) => ["sla", value]), ["status", params.status], ["tier", params.tier]];
  return (
    <form action="/challenges" className="relative flex-1">
      {kept.map(([name, value]) => value && <input key={`${name}-${value}`} type="hidden" name={name ?? ""} value={value} />)}
      <SearchIcon className="pointer-events-none absolute top-[11px] left-3 text-[#3c494c]" />
      <input
        ref={search}
        name="q"
        defaultValue={params.q ?? ""}
        maxLength={100}
        aria-label="Search challenges"
        placeholder="Search by incident, skill, or service keyword... [/ to focus]"
        className="h-[38px] w-full rounded-lg bg-canvas pr-24 pl-11 text-[13px] leading-4 text-ink placeholder:text-ink-subtle focus:outline-1 focus:outline-accent-soft"
      />
      <span className="type-label pointer-events-none absolute top-[11px] right-3 rounded bg-surface-raised px-1.5 py-0.5 text-ink-subtle">⌘ K</span>
    </form>
  );
}

// Figma › Filters, Sorter, and Layout Switcher. Only "Recently added" exists, and no frame shows the
// table view, so both stay as the frame draws them without other choices.
function ViewControls() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-[38px] w-[279px] items-center rounded-lg bg-canvas pr-8 pl-3">
        <span className="font-mono text-[13px] leading-[18px] text-ink">Sort: Recently added</span>
        <SelectChevronIcon className="absolute right-4 text-ink-subtle" />
      </span>
      <span className="flex items-center rounded-lg bg-canvas p-1">
        <span className="flex items-center gap-1 rounded bg-control px-2 py-1.5 text-accent-soft" aria-current="true">
          <GridViewIcon />
          <span className="type-label">Grid</span>
        </span>
        <span className="flex cursor-default items-center gap-1 rounded px-2 py-1.5 text-ink-muted" aria-disabled="true">
          <TableViewIcon />
          <span className="type-label">Table</span>
        </span>
      </span>
    </div>
  );
}
