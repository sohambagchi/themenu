"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getDaysAged } from "@/lib/date";
import { adjustInventoryQuantity, fetchInventoryItems } from "@/lib/inventoryApi";
import { getRecommendations } from "@/lib/recommendationEngine";
import type { Item, ItemType } from "@/lib/types";

const typeOptions: Array<"All" | ItemType> = ["All", "Protein", "Carb", "Veg", "Ferment/Pickle"];

export function Dashboard() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<"All" | ItemType>("All");
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventoryItems
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustInventoryQuantity(id, delta),
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: ["inventory"] });
      const previousItems = queryClient.getQueryData<Item[]>(["inventory"]);

      queryClient.setQueryData<Item[]>(["inventory"], (current = []) =>
        current.map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
      );

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["inventory"], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const items = inventoryQuery.data ?? [];

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags) set.add(tag);
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
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
    if (!selectedItem) return [];
    return getRecommendations(selectedItem, items);
  }, [selectedItem, items]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-edge bg-card p-5">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="flex min-w-40 flex-col gap-1.5 text-xs uppercase tracking-[0.15em] text-muted">
            Course
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "All" | ItemType)}
              className="rounded border border-edge bg-canvas px-3 py-2 text-sm text-text outline-none transition focus:border-text"
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-40 flex-col gap-1.5 text-xs uppercase tracking-[0.15em] text-muted">
            Tags
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="rounded border border-edge bg-canvas px-3 py-2 text-sm text-text outline-none transition focus:border-text"
            >
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </div>

        {inventoryQuery.isLoading && (
          <p className="font-mono text-sm text-muted">Loading inventory...</p>
        )}

        {inventoryQuery.isError && (
          <p className="font-mono text-sm text-red-500">Could not load inventory.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className={`overflow-hidden rounded-md border bg-canvas transition ${
                selectedItemId === item.id ? "border-text shadow-card" : "border-edge"
              }`}
            >
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

              <div className="space-y-4 p-4">
                <div>
                  <h3 className="font-serif text-xl">{item.name}</h3>
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    {item.type} • {item.location}
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-muted">Days Aged: {getDaysAged(item.dateAdded)}</span>
                  <span className="font-mono">Qty: {item.quantity}</span>
                </div>

                <div className="flex gap-2">
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
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className="ml-auto rounded border border-edge px-3 py-1 text-xs uppercase tracking-[0.12em] text-muted transition hover:border-text hover:text-text"
                  >
                    Pair
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

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
    </div>
  );
}
