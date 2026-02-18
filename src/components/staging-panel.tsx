"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { insertItems } from "@/lib/inventoryApi";
import { mockOcrScan, parseReceiptText } from "@/lib/staging";
import type { ItemType, NewItemInput, StagedLineItem } from "@/lib/types";

function toInventoryItem(line: StagedLineItem): NewItemInput {
  const now = new Date().toISOString();
  return {
    name: line.name,
    photoUrl: null,
    quantity: line.quantity,
    dateAdded: now.slice(0, 10),
    stockKind: "Ingredient",
    location: line.location,
    type: line.type,
    ingredients: [],
    tags: line.tags
  };
}

export function StagingPanel() {
  const queryClient = useQueryClient();
  const [rawText, setRawText] = useState(mockOcrScan());
  const [staged, setStaged] = useState<StagedLineItem[]>(parseReceiptText(mockOcrScan()));
  const [errorMessage, setErrorMessage] = useState<string>("");

  const commitMutation = useMutation({
    mutationFn: async () => {
      await insertItems(staged.map((line) => toInventoryItem(line)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "Ingredient"] });
      setErrorMessage("");
      setRawText("");
      setStaged([]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Commit failed.");
    }
  });

  const totalQuantity = useMemo(
    () => staged.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [staged]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-edge bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Sourcing</h2>
          <button
            type="button"
            onClick={() => {
              const text = mockOcrScan();
              setRawText(text);
              setStaged(parseReceiptText(text));
            }}
            className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
          >
            Mock OCR
          </button>
        </div>

        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
            Raw OCR Text
          </span>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted">
            Receipt parsing commits to Pantry only.
          </p>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            className="mt-2 h-40 w-full rounded border border-edge bg-canvas p-3 font-mono text-sm text-text outline-none transition focus:border-text"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStaged(parseReceiptText(rawText))}
            className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
          >
            Parse to Staging
          </button>
          <button
            type="button"
            disabled={staged.length === 0 || commitMutation.isPending}
            onClick={() => commitMutation.mutate()}
            className="rounded border border-text bg-text px-3 py-2 text-xs uppercase tracking-[0.14em] text-canvas transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Commit to Pantry
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-edge bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl">Manual Corrections</h3>
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
            Lines: {staged.length} • Total Servings: {totalQuantity}
          </p>
        </div>

        <div className="space-y-3">
          {staged.map((line) => (
            <article key={line.id} className="grid gap-2 rounded border border-edge bg-canvas p-3 md:grid-cols-4">
              <input
                value={line.name}
                onChange={(event) =>
                  setStaged((current) =>
                    current.map((item) =>
                      item.id === line.id ? { ...item, name: event.target.value } : item
                    )
                  )
                }
                className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
              />

              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  setStaged((current) =>
                    current.map((item) =>
                      item.id === line.id
                        ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) }
                        : item
                    )
                  )
                }
                className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
              />

              <select
                value={line.type}
                onChange={(event) =>
                  setStaged((current) =>
                    current.map((item) =>
                      item.id === line.id ? { ...item, type: event.target.value as ItemType } : item
                    )
                  )
                }
                className="select-field rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
              >
                <option>Protein</option>
                <option>Carb</option>
                <option>Veg</option>
                <option>Ferment/Pickle</option>
              </select>

              <input
                value={line.tags.join(", ")}
                onChange={(event) =>
                  setStaged((current) =>
                    current.map((item) =>
                      item.id === line.id
                        ? {
                            ...item,
                            tags: event.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean)
                          }
                        : item
                    )
                  )
                }
                className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
                placeholder="tag1, tag2, tag3"
              />
            </article>
          ))}
        </div>

        {errorMessage && <p className="mt-3 font-mono text-sm text-red-500">{errorMessage}</p>}
      </section>
    </div>
  );
}
