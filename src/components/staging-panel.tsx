"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StyledSelect } from "@/components/styled-select";
import { insertItems } from "@/lib/inventoryApi";
import { fetchSourcingConversionRules, upsertSourcingConversionRule } from "@/lib/sourcingApi";
import { mockOcrScan, parseReceiptText } from "@/lib/staging";
import type {
  ItemType,
  NewItemInput,
  SourcingConversionRule,
  SourcingConversionRuleInput,
  StagedLineItem
} from "@/lib/types";

const SOURCING_SOURCE = "walmart";

function toInventoryItem(line: StagedLineItem): NewItemInput {
  const now = new Date().toISOString();
  return {
    name: line.name,
    photoUrl: null,
    quantity: line.quantity,
    dateAdded: now.slice(0, 10),
    inventoryLabel: "Pantry",
    location: line.location,
    type: line.type,
    ingredients: [],
    tags: line.tags
  };
}

export function StagingPanel() {
  const queryClient = useQueryClient();
  const [rawText, setRawText] = useState(mockOcrScan());
  const [staged, setStaged] = useState<StagedLineItem[]>(
    parseReceiptText(mockOcrScan(), [], SOURCING_SOURCE)
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  const conversionQuery = useQuery({
    queryKey: ["sourcing-conversions", SOURCING_SOURCE],
    queryFn: () => fetchSourcingConversionRules(SOURCING_SOURCE)
  });

  const parseWithCurrentRules = (text: string, rules?: SourcingConversionRule[]) => {
    setStaged(parseReceiptText(text, rules ?? conversionQuery.data ?? [], SOURCING_SOURCE));
  };

  useEffect(() => {
    if (!conversionQuery.data) return;
    parseWithCurrentRules(rawText, conversionQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversionQuery.data]);

  const resolvedStaged = useMemo(
    () => staged.filter((line) => line.parseState === "resolved"),
    [staged]
  );
  const needsReviewStaged = useMemo(
    () => staged.filter((line) => line.parseState === "needs_review"),
    [staged]
  );
  const ignoredStaged = useMemo(() => staged.filter((line) => line.parseState === "ignored"), [staged]);

  const commitMutation = useMutation({
    mutationFn: async () => {
      await insertItems(resolvedStaged.map((line) => toInventoryItem(line)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "Pantry"] });
      setErrorMessage("");
      setRawText("");
      setStaged([]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Commit failed.");
    }
  });

  const confirmMappingMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const line = staged.find((entry) => entry.id === lineId);
      if (!line) {
        throw new Error("Staged line not found.");
      }
      const computedMultiplier =
        line.lineQuantity > 0 && line.quantity >= line.lineQuantity
          ? Math.trunc(line.quantity / line.lineQuantity)
          : 1;
      const embeddedMultiplierOverride =
        computedMultiplier > 1 && computedMultiplier !== line.embeddedPackCount
          ? computedMultiplier
          : null;

      const payload: SourcingConversionRuleInput = {
        source: line.source,
        tokenKey: line.tokenKey,
        tokenHash: line.tokenHash,
        canonicalName: line.name,
        canonicalType: line.type,
        canonicalLocation: line.location,
        canonicalTags: line.tags,
        embeddedMultiplierOverride
      };

      return upsertSourcingConversionRule(payload);
    },
    onSuccess: (savedRule) => {
      queryClient.setQueryData<SourcingConversionRule[]>(
        ["sourcing-conversions", SOURCING_SOURCE],
        (current) => {
          const next = (current ?? []).filter(
            (rule) => !(rule.source === savedRule.source && rule.tokenHash === savedRule.tokenHash)
          );
          next.unshift(savedRule);
          return next;
        }
      );
      setErrorMessage("");
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Saving mapping failed.");
    }
  });

  const totalQuantity = useMemo(
    () => resolvedStaged.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [resolvedStaged]
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
              parseWithCurrentRules(text);
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
            onClick={() => parseWithCurrentRules(rawText)}
            className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
          >
            Parse to Staging
          </button>
          <button
            type="button"
            disabled={resolvedStaged.length === 0 || commitMutation.isPending}
            onClick={() => commitMutation.mutate()}
            className="rounded border border-text bg-text px-3 py-2 text-xs uppercase tracking-[0.14em] text-canvas transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Commit to Pantry
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-edge bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl">Staging Review</h3>
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
            Resolved: {resolvedStaged.length} • Review: {needsReviewStaged.length} • Ignored:{" "}
            {ignoredStaged.length} • Commit Qty: {totalQuantity}
          </p>
        </div>

        <div className="space-y-3">
          {needsReviewStaged.map((line) => (
            <article key={line.id} className="space-y-2 rounded border border-edge bg-canvas p-3">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                Needs Review • {line.status.replace("_", " ")} • Line Qty {line.lineQuantity} •
                Pack {line.embeddedPackCount} • Effective {line.effectiveQuantity}
              </p>
              <p className="font-mono text-xs text-muted">{line.rawLine}</p>
              <div className="grid gap-2 md:grid-cols-4">
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

                <StyledSelect
                  value={line.type}
                  onChange={(nextValue) =>
                    setStaged((current) =>
                      current.map((item) =>
                        item.id === line.id ? { ...item, type: nextValue as ItemType } : item
                      )
                    )
                  }
                  options={["Protein", "Carb", "Veg", "Ferment/Pickle"]}
                  buttonClassName="bg-card px-2 py-1"
                  ariaLabel="Ingredient type"
                />

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
              </div>
              <button
                type="button"
                onClick={() => confirmMappingMutation.mutate(line.id)}
                disabled={confirmMappingMutation.isPending}
                className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Mapping
              </button>
              {line.parseWarnings.length > 0 && (
                <p className="font-mono text-xs text-amber-500">{line.parseWarnings.join(" ")}</p>
              )}
            </article>
          ))}

          {resolvedStaged.map((line) => (
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

              <StyledSelect
                value={line.type}
                onChange={(nextValue) =>
                  setStaged((current) =>
                    current.map((item) =>
                      item.id === line.id ? { ...item, type: nextValue as ItemType } : item
                    )
                  )
                }
                options={["Protein", "Carb", "Veg", "Ferment/Pickle"]}
                buttonClassName="bg-card px-2 py-1"
                ariaLabel="Ingredient type"
              />

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

          {ignoredStaged.map((line) => (
            <article key={line.id} className="space-y-1 rounded border border-edge bg-canvas p-3 opacity-75">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                Ignored • {line.status.replace("_", " ")} • Line Qty {line.lineQuantity}
              </p>
              <p className="text-sm text-muted">{line.rawName}</p>
              {line.parseWarnings.length > 0 && (
                <p className="font-mono text-xs text-muted">{line.parseWarnings.join(" ")}</p>
              )}
            </article>
          ))}
        </div>

        {conversionQuery.isLoading && (
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-muted">
            Loading conversion rules...
          </p>
        )}

        {errorMessage && <p className="mt-3 font-mono text-sm text-red-500">{errorMessage}</p>}
      </section>
    </div>
  );
}
