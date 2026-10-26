import { type ChallengeList, challengeListSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { TopNav } from "../../ui/top-nav";
import { ServiceError } from "../play/service-error";
import { ActiveFilters } from "./_catalog/active-filters";
import { CardGrid } from "./_catalog/card-grid";
import { CatalogHeader } from "./_catalog/catalog-header";
import { apiQuery, type CatalogParams, readCatalogParams } from "./_catalog/catalog-params";
import { FilterPanel } from "./_catalog/filter-panel";
import { Toolbar } from "./_catalog/toolbar";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

// Figma "Hotfix — Browse Challenge Catalog & Incident Directory" (7:10962), the grid view. Below 1024 px the
// Stitch phone screen "Greenbuild — Challenge Catalog (Phone)": the filters open from a Filters button (task 56).
export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = readCatalogParams(await searchParams);
  const list = await apiGet(`/v1/challenges${apiQuery(params)}`, challengeListSchema);
  return (
    <div data-responsive className="flex min-h-screen flex-col bg-[#131314] lg:min-w-[1280px]">
      <TopNav current="Challenges" />
      {/* The content and its header and footer bars span the whole window (owner, 2026-10-14). */}
      <main className="frame flex-1 px-4 pt-5 pb-5">
        <CatalogHeader catalog={list?.catalog ?? null} />
        <Toolbar params={params} />
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-5">
          <CatalogFilters params={params} list={list} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <ActiveFilters params={params} />
            {/* A new key per filter set restarts "Load more" from the first page. */}
            {list ? <CardGrid key={apiQuery(params)} params={params} first={list} /> : <ServiceError retryHref="/challenges" />}
          </div>
        </div>
      </main>
      <RuntimeFooter />
    </div>
  );
}

// Figma › Footer. Runtime telemetry has no data yet. It stays at the window's bottom (owner, 2026-10-14).
function RuntimeFooter() {
  return (
    <footer className="sticky bottom-0 z-10 bg-canvas">
      <div className="type-label frame flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-ink-subtle">
        <span>GREENBUILD RUNTIME // —</span>
        <span className="flex flex-wrap gap-3">
          <span>LATENCY: —</span>
          <span>STATUS: —</span>
          <span>SYSVER: —</span>
        </span>
      </div>
    </footer>
  );
}

// The filter panel: a column beside the cards on desktop, behind the Filters button on a phone.
function CatalogFilters({ params, list }: { params: CatalogParams; list: ChallengeList | null }) {
  const summary = list?.catalog ?? null;
  const total = list?.total ?? null;
  return (
    <>
      <PhoneFilters>
        <FilterPanel params={params} summary={summary} total={total} className="flex w-full" />
      </PhoneFilters>
      <FilterPanel params={params} summary={summary} total={total} className="hidden w-[280px] shrink-0 self-start lg:flex" />
    </>
  );
}

// Stitch phone screen › the Filters button: a native disclosure, so the same panel opens without script.
function PhoneFilters({ children }: { children: ReactNode }) {
  return (
    <details className="lg:hidden">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl bg-surface px-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Filters
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
