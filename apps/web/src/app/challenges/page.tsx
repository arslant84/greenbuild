import { challengeListSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { TopNav } from "../../ui/top-nav";
import { ServiceError } from "../play/service-error";
import { ActiveFilters } from "./_catalog/active-filters";
import { CardGrid } from "./_catalog/card-grid";
import { CatalogHeader } from "./_catalog/catalog-header";
import { apiQuery, readCatalogParams } from "./_catalog/catalog-params";
import { FilterPanel } from "./_catalog/filter-panel";
import { Toolbar } from "./_catalog/toolbar";

export const dynamic = "force-dynamic";

// Figma "Hotfix — Browse Challenge Catalog & Incident Directory" (7:10962), the grid view.
export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = readCatalogParams(await searchParams);
  const list = await apiGet(`/v1/challenges${apiQuery(params)}`, challengeListSchema);
  return (
    <div className="min-h-screen bg-[#131314]">
      {/* The 1280 px frame, centered on wider windows (owner, 2026-10-05). */}
      <div className="mx-auto flex min-h-screen w-[1280px] flex-col">
        <TopNav current="Challenges" />
        <main className="flex-1 px-4 pt-5 pb-5">
          <CatalogHeader catalog={list?.catalog ?? null} />
          <Toolbar params={params} />
          <div className="flex gap-5">
            <FilterPanel params={params} summary={list?.catalog ?? null} total={list?.total ?? null} />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <ActiveFilters params={params} />
              {/* A new key per filter set restarts "Load more" from the first page. */}
              {list ? <CardGrid key={apiQuery(params)} params={params} first={list} /> : <ServiceError />}
            </div>
          </div>
        </main>
        <RuntimeFooter />
      </div>
    </div>
  );
}

// Figma › Footer. Runtime telemetry has no data yet.
function RuntimeFooter() {
  return (
    <footer className="type-label flex items-center justify-between bg-canvas px-4 py-3 text-ink-subtle">
      <span>GREENBUILD RUNTIME // —</span>
      <span className="flex gap-3">
        <span>LATENCY: —</span>
        <span>STATUS: —</span>
        <span>SYSVER: —</span>
      </span>
    </footer>
  );
}
