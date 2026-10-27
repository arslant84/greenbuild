"use client";

import { usePathname } from "next/navigation";
import { ServiceError } from "./play/service-error";

// Any screen that throws shows Figma's E2: 500 Server Error card, whose Retry reloads that screen.
export default function ScreenError() {
  return (
    <main data-responsive className="flex min-h-screen items-center justify-center bg-[#131314] px-4">
      <ServiceError retryHref={usePathname()} />
    </main>
  );
}
