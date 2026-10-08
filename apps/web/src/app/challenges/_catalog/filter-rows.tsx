import Link from "next/link";
import type { ReactNode } from "react";

// Figma draws unchecked boxes as the browser's default white box; checked ones in the accent color.
function Box({ checked, round }: { checked: boolean; round?: boolean }) {
  const shape = round ? "rounded-full" : "rounded-[2.5px]";
  if (round) {
    return (
      <span className={`flex size-[13px] shrink-0 items-center justify-center border bg-white ${shape} ${checked ? "border-accent-soft" : "border-[#767676]"}`}>
        {checked && <span className="size-2 rounded-full bg-accent-soft" />}
      </span>
    );
  }
  return <span className={`size-[13px] shrink-0 ${shape} ${checked ? "bg-accent-soft" : "border border-[#767676] bg-white"}`} />;
}

interface FilterRowProps {
  href: string | null;
  checked: boolean;
  label: ReactNode;
  // A number, a badge, or null for no data yet.
  count: ReactNode;
  round?: boolean;
  tight?: boolean;
  countClass?: string;
}

// FilterRow is one choice in the filter panel: a link to the catalog with that choice toggled, or a
// plain row when the choice has no data yet.
export function FilterRow({ href, checked, label, count, round, tight, countClass = "text-ink-subtle" }: FilterRowProps) {
  const body = (
    <>
      <span className={`flex items-center ${tight ? "gap-1" : "gap-2"}`}>
        <Box checked={checked} {...(round ? { round } : {})} />
        {label}
      </span>
      {typeof count === "object" && count !== null ? count : <span className={`type-label ${countClass}`}>{count ?? "—"}</span>}
    </>
  );
  const look = `flex items-center justify-between rounded ${tight ? "p-1" : "p-1.5"}`;
  return href ? (
    <Link href={href} className={`${look} hover:bg-control/40`} aria-pressed={checked} scroll={false}>
      {body}
    </Link>
  ) : (
    <span className={`${look} opacity-60`} aria-disabled="true">
      {body}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <span className="type-label font-semibold tracking-[0.5px] text-ink-muted uppercase">{children}</span>;
}

export function RowText({ children, className = "text-ink" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[13px] leading-[18px] ${className}`}>{children}</span>;
}
