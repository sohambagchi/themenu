"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getDaysAged } from "@/lib/date";
import {
  adjustInventoryQuantity,
  consumeInventoryItems,
  fetchInventoryItems
} from "@/lib/inventoryApi";
import { getRecommendations } from "@/lib/recommendationEngine";
import { StyledSelect } from "@/components/styled-select";
import type { Item, ItemStockKind, ItemType } from "@/lib/types";

const DEFAULT_TYPE_OPTIONS: ItemType[] = ["Protein", "Carb", "Veg", "Ferment/Pickle"];

interface ActionItem {
  item: Item;
  quantity: number;
}

function formatIngredientSummary(ingredients: string[], limit = 3) {
  if (ingredients.length === 0) return "";
  if (ingredients.length <= limit) return ingredients.join(", ");
  const shown = ingredients.slice(0, limit).join(", ");
  return `${shown} +${ingredients.length - limit}`;
}

export function Dashboard({ stockKind }: { stockKind: ItemStockKind }) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<"All" | ItemType>("All");
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [actionMap, setActionMap] = useState<Record<string, number>>({});
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [actionUsername, setActionUsername] = useState("");
  const [actionPassword, setActionPassword] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const isIngredientView = stockKind === "Ingredient";
  const actionLabel = isIngredientView ? "Tray" : "Order";
  const actionVerb = isIngredientView ? "Cooked" : "Eat";

  const inventoryQuery = useQuery({
    queryKey: ["inventory", stockKind],
    queryFn: () => fetchInventoryItems(stockKind)
  });

  const sessionQuery = useQuery({
    queryKey: ["dashboard-session"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard-auth/session", { cache: "no-store" });
      if (!response.ok) return { authed: false };
      return (await response.json()) as { authed: boolean };
    }
  });

  const canManualAdjust = sessionQuery.data?.authed === true;

  const adjustMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustInventoryQuantity(id, delta),
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: ["inventory", stockKind] });
      const previousItems = queryClient.getQueryData<Item[]>(["inventory", stockKind]);

      queryClient.setQueryData<Item[]>(["inventory", stockKind], (current = []) =>
        current
          .map((item) =>
            item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
          )
          .filter((item) => item.quantity > 0)
      );

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["inventory", stockKind], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", stockKind] });
    }
  });

  const consumeMutation = useMutation({
    mutationFn: ({
      operations,
      username,
      password
    }: {
      operations: Array<{ id: string; quantity: number }>;
      username?: string;
      password?: string;
    }) => consumeInventoryItems(operations, username, password),
    onSuccess: () => {
      setActionMap({});
      setActionUsername("");
      setActionPassword("");
      setAuthPromptOpen(false);
      setActionNotice(`${actionVerb} complete. Stock updated.`);
      queryClient.invalidateQueries({ queryKey: ["inventory", stockKind] });
    },
    onError: (error) => {
      setActionNotice(error instanceof Error ? error.message : "Failed to update stock.");
    }
  });

  const items = inventoryQuery.data ?? [];
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags) set.add(tag);
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_TYPE_OPTIONS);
    for (const item of items) set.add(item.type);
    return ["All", ...Array.from(set)] as Array<"All" | ItemType>;
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchType = typeFilter === "All" || item.type === typeFilter;
        const matchTag = tagFilter === "All" || item.tags.includes(tagFilter);
        return matchType && matchTag;
      }),
    [items, typeFilter, tagFilter]
  );

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) ?? null,
    [filteredItems, selectedItemId]
  );

  const recommendations = useMemo(() => {
    if (!selectedItem || stockKind !== "Prepared") return [];
    return getRecommendations(selectedItem, items);
  }, [selectedItem, items, stockKind]);

  const actionItems = useMemo<ActionItem[]>(() => {
    const entries: ActionItem[] = [];
    for (const [id, quantityRaw] of Object.entries(actionMap)) {
      const item = itemById.get(id);
      if (!item) continue;
      const quantity = Math.min(item.quantity, Math.max(0, quantityRaw));
      if (quantity <= 0) continue;
      entries.push({ item, quantity });
    }
    entries.sort((a, b) => a.item.name.localeCompare(b.item.name));
    return entries;
  }, [actionMap, itemById]);

  const actionTotal = actionItems.reduce((sum, row) => sum + row.quantity, 0);

  const updateActionQuantity = (itemId: string, nextQuantity: number) => {
    setActionMap((current) => {
      const maxAllowed = Math.max(0, itemById.get(itemId)?.quantity ?? 0);
      const safeNext = Math.min(maxAllowed, Math.max(0, Math.trunc(nextQuantity)));
      if (safeNext <= 0) {
        if (!(itemId in current)) return current;
        const copy = { ...current };
        delete copy[itemId];
        return copy;
      }
      return { ...current, [itemId]: safeNext };
    });
  };

  const addToAction = (item: Item) => {
    if (item.quantity <= 0) return;
    const currentQty = actionMap[item.id] ?? 0;
    const nextQty = Math.min(item.quantity, currentQty + 1);
    updateActionQuantity(item.id, nextQty);
  };

  const submitAction = (username?: string, password?: string) => {
    if (actionItems.length === 0) return;
    setActionNotice("");
    consumeMutation.mutate({
      operations: actionItems.map((row) => ({
        id: row.item.id,
        quantity: row.quantity
      })),
      username,
      password
    });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-edge bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl">{actionLabel}</h2>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            Items: {actionItems.length} • Servings: {actionTotal}
          </p>
        </div>

        {actionItems.length === 0 ? (
          <p className="mt-3 font-mono text-sm text-muted">
            Select items from inventory to prepare your {actionLabel.toLowerCase()}.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {actionItems.map((row) => (
              <article
                key={row.item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-edge bg-canvas p-3"
              >
                <div>
                  <p className="font-serif text-lg">{row.item.name}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    Available: {row.item.quantity}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateActionQuantity(row.item.id, row.quantity - 1)}
                    className="rounded border border-edge px-3 py-1 font-mono text-sm transition hover:border-text"
                  >
                    -
                  </button>
                  <span className="min-w-8 text-center font-mono text-sm">{row.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateActionQuantity(row.item.id, row.quantity + 1)}
                    className="rounded border border-edge px-3 py-1 font-mono text-sm transition hover:border-text"
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionItems.length === 0}
            onClick={() => {
              setActionNotice("");
              if (sessionQuery.data?.authed) {
                submitAction();
                return;
              }

              setAuthPromptOpen(true);
            }}
            className="rounded border border-text bg-text px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionVerb}
          </button>
          <button
            type="button"
            disabled={actionItems.length === 0}
            onClick={() => {
              setActionMap({});
              setActionNotice("");
            }}
            className="rounded border border-edge px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear {actionLabel}
          </button>
        </div>

        {authPromptOpen && (
          <form
            className="mt-4 grid gap-3 rounded border border-edge bg-canvas p-4 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitAction(actionUsername, actionPassword);
            }}
          >
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Username</span>
              <input
                value={actionUsername}
                onChange={(event) => setActionUsername(event.target.value)}
                required
                className="mt-2 w-full rounded border border-edge bg-card px-3 py-2 text-sm outline-none transition focus:border-text"
              />
            </label>

            <label className="block">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Password</span>
              <input
                value={actionPassword}
                onChange={(event) => setActionPassword(event.target.value)}
                type="password"
                required
                className="mt-2 w-full rounded border border-edge bg-card px-3 py-2 text-sm outline-none transition focus:border-text"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={consumeMutation.isPending}
                className="rounded border border-text bg-text px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-canvas disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm {actionVerb}
              </button>
              <button
                type="button"
                onClick={() => setAuthPromptOpen(false)}
                className="rounded border border-edge px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {actionNotice && <p className="mt-3 font-mono text-sm text-muted">{actionNotice}</p>}
      </section>

      <section className="rounded-lg border border-edge bg-card p-5">
        <div className="mb-5">
          <h2 className="font-serif text-2xl">
            {stockKind === "Prepared" ? "Menu" : "Pantry"}
          </h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
            {stockKind === "Prepared"
              ? "Finished dishes and batch-cooked meals."
              : "Raw inventory from groceries and pantry restock."}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="flex min-w-40 flex-col gap-1.5 text-xs uppercase tracking-[0.15em] text-muted">
            Course
            <StyledSelect
              value={typeFilter}
              onChange={(nextValue) => setTypeFilter(nextValue as "All" | ItemType)}
              options={typeOptions}
              buttonClassName="bg-canvas"
              ariaLabel="Course filter"
            />
          </label>

          <label className="flex min-w-40 flex-col gap-1.5 text-xs uppercase tracking-[0.15em] text-muted">
            Tags
            <StyledSelect
              value={tagFilter}
              onChange={(nextValue) => setTagFilter(nextValue)}
              options={availableTags}
              buttonClassName="bg-canvas"
              ariaLabel="Tag filter"
            />
          </label>
        </div>

        {inventoryQuery.isLoading && (
          <p className="font-mono text-sm text-muted">Loading inventory...</p>
        )}

        {inventoryQuery.isError && (
          <p className="font-mono text-sm text-red-500">
            {inventoryQuery.error instanceof Error
              ? inventoryQuery.error.message
              : "Could not load inventory."}
          </p>
        )}

        <div className={isIngredientView ? "space-y-3" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className={`rounded-md border bg-canvas transition ${
                selectedItemId === item.id ? "border-text shadow-card" : "border-edge"
              }`}
            >
              {!isIngredientView && (
                <div className="relative h-36 w-full bg-black/10">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-muted">
                      No Photo
                    </div>
                  )}
                </div>
              )}

              <div className={`${isIngredientView ? "space-y-3" : "space-y-4"} p-4`}>
                <div>
                  <h3 className="font-serif text-xl">{item.name}</h3>
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    {item.type} • {item.location}
                  </p>
                  {!isIngredientView && item.ingredients.length > 0 && (
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted">
                      Ingredients: {formatIngredientSummary(item.ingredients)}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-muted">Days Aged: {getDaysAged(item.dateAdded)}</span>
                  <span className="font-mono">Qty: {item.quantity}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canManualAdjust && (
                    <>
                      <button
                        type="button"
                        onClick={() => adjustMutation.mutate({ id: item.id, delta: -1 })}
                        className="rounded border border-edge px-3 py-1 font-mono text-sm transition hover:border-text"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustMutation.mutate({ id: item.id, delta: 1 })}
                        className="rounded border border-edge px-3 py-1 font-mono text-sm transition hover:border-text"
                      >
                        +
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={item.quantity <= 0}
                    onClick={() => addToAction(item)}
                    className="rounded border border-edge px-3 py-1 text-xs uppercase tracking-[0.12em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add to {actionLabel}
                  </button>
                  {stockKind === "Prepared" && (
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className="rounded border border-edge px-3 py-1 text-xs uppercase tracking-[0.12em] text-muted transition hover:border-text hover:text-text"
                    >
                      Pair
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {stockKind === "Prepared" && (
        <section className="rounded-lg border border-edge bg-card p-5">
          <h2 className="font-serif text-2xl">Pairing</h2>
          {!selectedItem && (
            <p className="mt-3 font-mono text-sm text-muted">
              Select an item using the Pair action to view deterministic recommendations.
            </p>
          )}
          {selectedItem && (
            <>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">
                Selected: {selectedItem.name}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {recommendations.map((entry) => (
                  <article key={entry.item.id} className="rounded border border-edge bg-canvas p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-serif text-lg">{entry.item.name}</h3>
                      <span className="rounded border border-edge px-2 py-1 font-mono text-xs">
                        {entry.score}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted">
                      {entry.item.type} • Qty {entry.item.quantity}
                    </p>
                    <p className="mt-3 text-sm text-muted">{entry.reasons[0]}</p>
                  </article>
                ))}
              </div>
              {recommendations.length === 0 && (
                <p className="mt-4 font-mono text-sm text-muted">
                  No deterministic matches found under the current inventory.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
