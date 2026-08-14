"use client";

import * as React from "react";
import { Check, CheckSquare2, Plus, X } from "lucide-react";
import { bulkAddWatchesAction, quickAddWatchAction } from "@/app/(app)/actions";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  WatchOptionsFields,
  type WatchFormDefaults,
} from "@/components/watch-options-fields";
import { MAX_BULK_WATCHES } from "@/lib/constants";

const STORAGE_KEY = "riftwatch:catalog-selection:v1";
const EMPTY_SELECTION: CatalogSelectedCard[] = [];
const selectionListeners = new Set<() => void>();
let cachedStorageValue: string | null | undefined;
let cachedSelection: CatalogSelectedCard[] = EMPTY_SELECTION;

export type CatalogSelectedCard = {
  id: number;
  name: string;
  printing: string;
};

type CatalogSelectionContextValue = {
  selectedCards: CatalogSelectedCard[];
  isSelected: (id: number) => boolean;
  toggle: (card: CatalogSelectedCard) => void;
  selectMany: (cards: CatalogSelectedCard[]) => void;
  clearMany: (ids: number[]) => void;
  clear: () => void;
};

const CatalogSelectionContext =
  React.createContext<CatalogSelectionContextValue | null>(null);

function readStoredSelection(): CatalogSelectedCard[] {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is CatalogSelectedCard =>
          typeof item === "object" &&
          item !== null &&
          typeof item.id === "number" &&
          Number.isInteger(item.id) &&
          item.id > 0 &&
          typeof item.name === "string" &&
          typeof item.printing === "string",
      )
      .slice(0, MAX_BULK_WATCHES);
  } catch {
    return [];
  }
}

function getSelectionSnapshot() {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored !== cachedStorageValue) {
    cachedStorageValue = stored;
    cachedSelection = readStoredSelection();
  }
  return cachedSelection;
}

function writeSelection(selection: CatalogSelectedCard[]) {
  cachedSelection = selection;
  cachedStorageValue = JSON.stringify(selection);
  sessionStorage.setItem(STORAGE_KEY, cachedStorageValue);
  for (const listener of selectionListeners) listener();
}

function subscribeToSelection(listener: () => void) {
  selectionListeners.add(listener);
  return () => selectionListeners.delete(listener);
}

export function CatalogSelectionProvider({
  children,
  watchedIds = [],
}: {
  children: React.ReactNode;
  watchedIds?: number[];
}) {
  const selected = React.useSyncExternalStore(
    subscribeToSelection,
    getSelectionSnapshot,
    () => EMPTY_SELECTION,
  );

  const selectedIds = React.useMemo(
    () => new Set(selected.map((card) => card.id)),
    [selected],
  );
  const updateSelection = React.useCallback(
    (update: (current: CatalogSelectedCard[]) => CatalogSelectedCard[]) => {
      writeSelection(update(getSelectionSnapshot()).slice(0, MAX_BULK_WATCHES));
    },
    [],
  );
  React.useEffect(() => {
    if (watchedIds.length === 0) return;
    const watched = new Set(watchedIds);
    updateSelection((current) =>
      current.filter((card) => !watched.has(card.id)),
    );
  }, [updateSelection, watchedIds]);
  const value = React.useMemo<CatalogSelectionContextValue>(
    () => ({
      selectedCards: selected,
      isSelected: (id) => selectedIds.has(id),
      toggle: (card) =>
        updateSelection((current) =>
          current.some((item) => item.id === card.id)
            ? current.filter((item) => item.id !== card.id)
            : [...current, card],
        ),
      selectMany: (cards) =>
        updateSelection((current) => {
          const next = new Map(current.map((card) => [card.id, card]));
          for (const card of cards) next.set(card.id, card);
          return [...next.values()];
        }),
      clearMany: (ids) => {
        const removed = new Set(ids);
        updateSelection((current) =>
          current.filter((card) => !removed.has(card.id)),
        );
      },
      clear: () => writeSelection([]),
    }),
    [selected, selectedIds, updateSelection],
  );

  return (
    <CatalogSelectionContext value={value}>{children}</CatalogSelectionContext>
  );
}

function useCatalogSelection() {
  const context = React.use(CatalogSelectionContext);
  if (!context) {
    throw new Error(
      "Catalog selection controls must be rendered inside CatalogSelectionProvider",
    );
  }
  return context;
}

export function CatalogCardActions({
  card,
  watched = false,
}: {
  card: CatalogSelectedCard;
  watched?: boolean;
}) {
  const selection = useCatalogSelection();
  const checked = selection.isSelected(card.id);

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
      <div className="pointer-events-auto rounded-lg border border-white/15 bg-slate-950/90 p-2 shadow-lg backdrop-blur">
        <Checkbox
          checked={checked}
          disabled={watched}
          onChange={() => selection.toggle(card)}
          label={
            watched
              ? `${card.name}, ${card.printing}, already in watchlist`
              : `Select ${card.name}, ${card.printing}`
          }
          labelClassName="sr-only"
        />
      </div>
      <ActionForm
        action={quickAddWatchAction}
        className="pointer-events-auto"
        onSuccess={() => selection.clearMany([card.id])}
      >
        <input type="hidden" name="blueprintId" value={card.id} />
        <ActionSubmitButton
          size="icon"
          disabled={watched}
          className="size-9 border border-white/15 bg-slate-950/90 text-cyan-200 shadow-lg backdrop-blur hover:bg-cyan-300 hover:text-slate-950"
          aria-label={
            watched
              ? `${card.name} is already in your watchlist`
              : `Add ${card.name} to watchlist with default options`
          }
          title={
            watched
              ? "Already in your watchlist"
              : "Add to watchlist with default options"
          }
          pendingLabel={<span className="sr-only">Adding…</span>}
        >
          {watched ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
        </ActionSubmitButton>
      </ActionForm>
    </div>
  );
}

export function CatalogPageSelection({
  cards,
}: {
  cards: CatalogSelectedCard[];
}) {
  const selection = useCatalogSelection();
  const selectedOnPage = cards.filter((card) => selection.isSelected(card.id));
  const allSelected =
    cards.length > 0 && selectedOnPage.length === cards.length;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Checkbox
        checked={allSelected}
        onChange={() =>
          allSelected
            ? selection.clearMany(cards.map((card) => card.id))
            : selection.selectMany(cards)
        }
        label="Select this page"
        containerClassName="text-xs"
      />
      {selection.selectedCards.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyan-200">
            {selection.selectedCards.length} selected across the catalog
          </span>
          <button
            type="button"
            onClick={selection.clear}
            className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            aria-label="Clear all selected cards"
          >
            <X className="size-3" /> Clear selection
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogBulkWatchDialog({
  defaults,
}: {
  defaults?: WatchFormDefaults;
}) {
  const selection = useCatalogSelection();
  const [open, setOpen] = React.useState(false);
  const selectedCount = selection.selectedCards.length;
  const onSuccess = React.useCallback(() => {
    selection.clear();
    setOpen(false);
  }, [selection]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={selectedCount ? "secondary" : "outline"}
          className="shrink-0"
          disabled={!selectedCount}
          aria-label="Add selected cards to watchlist"
        >
          <CheckSquare2 className="size-3.5" />
          <span className="hidden sm:inline">Watch selected</span>
          {selectedCount ? (
            <span className="grid size-5 place-items-center rounded-full bg-cyan-300 text-[11px] font-semibold text-slate-950">
              {selectedCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <DialogTitle>
            Add {selectedCount} card{selectedCount === 1 ? "" : "s"} to your
            watchlist
          </DialogTitle>
          <DialogDescription>
            These filters will be applied to every selected printing, including
            selections made on other catalog pages.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={bulkAddWatchesAction}
          onSuccess={onSuccess}
          className="flex min-h-0 flex-1 flex-col"
        >
          {selection.selectedCards.map((card) => (
            <input
              key={card.id}
              type="hidden"
              name="blueprintIds"
              value={card.id}
            />
          ))}
          <input
            type="hidden"
            name="blueprintId"
            value={selection.selectedCards[0]?.id ?? ""}
          />
          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              <span className="min-w-0 truncate">
                {selection.selectedCards
                  .slice(0, 3)
                  .map((card) => card.name)
                  .join(", ")}
                {selectedCount > 3 ? ` and ${selectedCount - 3} more` : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  selection.clear();
                  setOpen(false);
                }}
                className="shrink-0 cursor-pointer text-slate-500 transition-colors hover:text-white"
                aria-label="Clear selected cards"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <WatchOptionsFields idPrefix="bulk-watch" defaults={defaults} />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 border-t bg-slate-950 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <ActionSubmitButton
              disabled={!selectedCount}
              pendingLabel="Adding watches…"
            >
              Add {selectedCount} watch{selectedCount === 1 ? "" : "es"}
            </ActionSubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
