import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "greenbuild",
  description: "Daily DevOps challenges that turn proven skill into a public certificate.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* Screens are 1280 px wide until each gets its phone layout (task 56). A converted screen marks its
          root data-responsive, which lifts this minimum, and keeps its own from 1024 px (lg:min-w-[1280px]),
          so only phones and small tablets get the phone layout. */}
      <body className="min-h-screen min-w-[1280px] antialiased has-[[data-responsive]]:min-w-0">{children}</body>
    </html>
  );
}
