# ADR-008: Screens follow the owner's Figma file exactly

Status: Accepted (owner, 2026-10-12). Decided by the owner on 2026-10-02.

## Context

The plan's task 12 asked for a page "without design". The owner has a full Figma file ("HotFix") for the player screens and wants the product to look like it from the first slice.

## Decision

- Every screen reproduces its Figma frame: layout, spacing, sizes, colours, typography, components and states. The frame's node data is read, not just a screenshot.
- Brand text in the UI is "greenbuild" wherever Figma says "hotfix".
- Blocks whose data does not exist yet are built in place and show neutral empty values (—, 0, "No attempts yet", disabled buttons), never the frame's sample numbers.
- A screen without a frame waits for one ("block: needs a Figma frame (owner)"); its server part is planned separately.
- UI is Tailwind CSS 4 with tokens from Figma, fonts through Fontsource and icons exported from Figma. shadcn/ui is dropped and Framer Motion deferred (decision D4).
- Frames are 1280 px wide; until responsive frames exist, the screens keep that width (owner, 2026-10-05).

## Consequences

- No design work in code, and no drift between the design and the product.
- Some features are blocked on frames (hint view, resume, sign-in age checkbox, responsive layout).
