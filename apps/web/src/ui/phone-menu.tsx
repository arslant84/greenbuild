import type { ReactNode } from "react";
import { MenuIcon } from "./icons-landing";

// The menu button that replaces a header's navigation below 1024 px (task 56, the Stitch phone screens): a
// native disclosure, so it works without script. Its content is the header's own links.
export function PhoneMenu({ children }: { children: ReactNode }) {
  return (
    <details className="relative lg:hidden">
      <summary aria-label="Menu" className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-[#3c494c99] bg-surface text-ink [&::-webkit-details-marker]:hidden">
        <MenuIcon />
      </summary>
      <div className="absolute top-11 right-0 z-20 w-48 rounded-lg border border-[#3c494c99] bg-surface p-4">{children}</div>
    </details>
  );
}
