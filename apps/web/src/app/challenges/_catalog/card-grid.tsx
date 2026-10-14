"use client";

import { type CatalogEntry, type ChallengeList, challengeListSchema } from "@greenbuild/shared";
import { useState } from "react";
import { FilterMatchIcon, LoadMoreIcon } from "../../../ui/icons-catalog";
import { apiQuery, type CatalogParams } from "./catalog-params";
import { CatalogCard } from "./catalog-card";

interface CardGridProps {
  params: CatalogParams;
  first: ChallengeList;
}

// useMoreCards appends the next page; the page's filters stay as they were when it loaded.
function useMoreCards({ params, first }: CardGridProps) {
  const [entries, setEntries] = useState<CatalogEntry[]>(first.challenges);
  const [cursor, setCursor] = useState(first.next_cursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadMore = async (): Promise<void> => {
    if (!cursor) return;
    setLoading(true);
    const response = await fetch(`/api/challenges${apiQuery(params, cursor)}`).catch(() => null);
    const page = response?.ok ? challengeListSchema.safeParse(await response.json()) : null;
    setFailed(!page?.success);
    if (page?.success) {
      setEntries((shown) => [...shown, ...page.data.challenges]);
      setCursor(page.data.next_cursor);
    }
    setLoading(false);
  };
  return { entries, cursor, loading, failed, loadMore };
}

// Figma › Quick Metrics Strip, the 3-column grid view, and Pagination / Footer Loading Area.
export function CardGrid(props: CardGridProps) {
  const { entries, cursor, loading, failed, loadMore } = useMoreCards(props);
  const { total, catalog } = props.first;
  return (
    <>
      <div className="flex items-center justify-between rounded-lg bg-canvas px-3 py-1">
        <span className="flex items-center gap-2 text-accent-soft">
          <FilterMatchIcon />
          <span className="type-label text-ink-muted">Showing {total} challenges matching active criteria</span>
        </span>
        <span className="type-label text-ink-muted">{entries.length > 0 ? `Displaying 1–${entries.length} of ${total}` : `Displaying 0 of ${total}`}</span>
      </div>
      {entries.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(296px,1fr))] gap-3 py-2">
          {entries.map((entry) => (
            <CatalogCard key={entry.slug} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="type-label py-8 text-center text-ink-subtle">No challenges match the active filters.</p>
      )}
      <LoadMoreBar shown={entries.length} total={total} catalogSize={catalog.challenges} state={failed ? "failed" : loading ? "loading" : cursor ? "more" : "done"} onLoad={() => void loadMore()} />
    </>
  );
}

interface LoadMoreBarProps {
  shown: number;
  total: number;
  catalogSize: number;
  state: "more" | "loading" | "failed" | "done";
  onLoad: () => void;
}

// Figma › Pagination / Footer Loading Area.
function LoadMoreBar({ shown, total, catalogSize, state, onLoad }: LoadMoreBarProps) {
  const label = { more: `Load more challenges (${total - shown} remaining)`, loading: "Loading…", failed: "Could not load more. Try again", done: "All challenges shown" }[state];
  return (
    <div className="flex items-center justify-between rounded-xl bg-canvas/60 p-5">
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-accent" />
        <span className="type-label text-ink-subtle">
          Showing {shown} of {total} filtered ({catalogSize} total system challenges)
        </span>
      </span>
      <button
        type="button"
        onClick={onLoad}
        disabled={state === "loading" || state === "done"}
        className="flex h-[34px] w-[353px] items-center justify-center gap-2 rounded-lg bg-surface-raised font-mono text-[13px] leading-[18px] text-ink disabled:opacity-50"
      >
        {label}
        <LoadMoreIcon />
      </button>
    </div>
  );
}
