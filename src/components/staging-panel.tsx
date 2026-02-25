"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StyledSelect } from "@/components/styled-select";
import { insertItems } from "@/lib/inventoryApi";
import { formatQuantityValue, parseQuantityInput, QUANTITY_UNIT_OPTIONS } from "@/lib/quantity";
import {
  extractSourcingPdfText,
  fetchSourcingConversionRules,
  upsertSourcingConversionRule
} from "@/lib/sourcingApi";
import { mockOcrScan, parseReceiptText } from "@/lib/staging";
import type {
  ItemType,
  NewItemInput,
  QuantityUnit,
  SourcingConversionRule,
  SourcingConversionRuleInput,
  StagedLineItem,
  TagValue
} from "@/lib/types";

const SOURCING_SOURCE = "walmart";
const DEFAULT_TYPE_OPTIONS: ItemType[] = ["Protein", "Carb", "Veg", "Ferment/Pickle"];
const CUSTOM_TYPES_STORAGE_KEY = "themenu_custom_sourcing_types";
const MAX_TYPE_LENGTH = 64;

function toInventoryItem(line: StagedLineItem): NewItemInput {
  const now = new Date().toISOString();
  return {
    name: line.name,
    photoUrl: null,
    quantity: line.quantity,
    quantityUnit: line.quantityUnit,
    dateAdded: now.slice(0, 10),
    inventoryLabel: "Pantry",
    location: line.location,
    type: line.type,
    ingredients: [],
    tags: line.tags
  };
}

function parseTagInput(raw: string): TagValue[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean) as TagValue[];
}

function formatTagInput(tags: TagValue[]) {
  return tags.join(", ");
}

export function StagingPanel() {
  const queryClient = useQueryClient();
  const pdfFilePickerRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState(mockOcrScan());
  const [staged, setStaged] = useState<StagedLineItem[]>(
    parseReceiptText(mockOcrScan(), [], SOURCING_SOURCE)
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [mappingLineIdPending, setMappingLineIdPending] = useState<string | null>(null);

  const conversionQuery = useQuery({
    queryKey: ["sourcing-conversions", SOURCING_SOURCE],
    queryFn: () => fetchSourcingConversionRules(SOURCING_SOURCE)
  });
  const sessionQuery = useQuery({
    queryKey: ["dashboard-session"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard-auth/session", { cache: "no-store" });
      if (!response.ok) return { authed: false };
      return (await response.json()) as { authed: boolean };
    }
  });

  const parseWithCurrentRules = (text: string, rules?: SourcingConversionRule[]) => {
    setTagDrafts({});
    setStaged(parseReceiptText(text, rules ?? conversionQuery.data ?? [], SOURCING_SOURCE));
  };

  const onStagedQuantityInput = (lineId: string, rawValue: string) => {
    setQuantityDrafts((current) => ({ ...current, [lineId]: rawValue }));
    const parsed = parseQuantityInput(rawValue);
    if (parsed === null || parsed <= 0) return;
    setStaged((current) =>
      current.map((entry) => (entry.id === lineId ? { ...entry, quantity: parsed } : entry))
    );
  };

  const onStagedQuantityBlur = (lineId: string) => {
    const line = staged.find((entry) => entry.id === lineId);
    if (!line) return;
    setQuantityDrafts((current) => ({
      ...current,
      [lineId]: formatQuantityValue(line.quantity)
    }));
  };

  const addCustomType = () => {
    const normalized = customTypeInput.trim();
    if (!normalized) return;

    if (normalized.length > MAX_TYPE_LENGTH) {
      setErrorMessage(`Type must be ${MAX_TYPE_LENGTH} characters or fewer.`);
      return;
    }

    setCustomTypes((current) => {
      const normalizedLower = normalized.toLowerCase();
      const existsInDefaults = DEFAULT_TYPE_OPTIONS.some(
        (value) => value.toLowerCase() === normalizedLower
      );
      const existsInCustom = current.some((value) => value.toLowerCase() === normalizedLower);
      if (existsInDefaults || existsInCustom) return current;
      return [...current, normalized];
    });

    setCustomTypeInput("");
    setErrorMessage("");
  };

  useEffect(() => {
    const raw = window.localStorage.getItem(CUSTOM_TYPES_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return;
      setCustomTypes(
        parsed.filter(
          (entry) =>
            typeof entry === "string" &&
            entry.trim().length > 0 &&
            entry.trim().length <= MAX_TYPE_LENGTH
        )
      );
    } catch {
      // Ignore invalid local storage value.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_TYPES_STORAGE_KEY, JSON.stringify(customTypes));
  }, [customTypes]);

  useEffect(() => {
    if (!conversionQuery.data) return;
    parseWithCurrentRules(rawText, conversionQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversionQuery.data]);

  useEffect(() => {
    setQuantityDrafts((current) => {
      const next: Record<string, string> = {};
      for (const line of staged) {
        next[line.id] = current[line.id] ?? formatQuantityValue(line.quantity);
      }
      return next;
    });
  }, [staged]);

  useEffect(() => {
    setTagDrafts((current) => {
      const next: Record<string, string> = {};
      for (const line of staged) {
        next[line.id] = current[line.id] ?? formatTagInput(line.tags);
      }
      return next;
    });
  }, [staged]);

  const allTypeOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_TYPE_OPTIONS);
    for (const value of customTypes) set.add(value);
    for (const line of staged) set.add(line.type);
    return Array.from(set);
  }, [customTypes, staged]);

  const onStagedTypeInput = (lineId: string, rawValue: string) => {
    const normalized = rawValue.slice(0, MAX_TYPE_LENGTH);
    setStaged((current) =>
      current.map((item) => (item.id === lineId ? { ...item, type: normalized as ItemType } : item))
    );
  };

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

  const pdfParseMutation = useMutation({
    mutationFn: async (file: File) => extractSourcingPdfText(file, SOURCING_SOURCE),
    onSuccess: (text) => {
      setRawText(text);
      parseWithCurrentRules(text);
      setErrorMessage("");
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "PDF parsing failed.");
    }
  });

  const confirmMappingMutation = useMutation({
    onMutate: (lineId: string) => {
      setMappingLineIdPending(lineId);
      setErrorMessage("");
    },
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
        canonicalQuantityUnit: line.quantityUnit,
        canonicalType: line.type,
        canonicalLocation: line.location,
        canonicalTags: parseTagInput(tagDrafts[lineId] ?? formatTagInput(line.tags)),
        embeddedMultiplierOverride
      };

      return upsertSourcingConversionRule(payload);
    },
    onSuccess: (savedRule, lineId) => {
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
      queryClient.invalidateQueries({ queryKey: ["sourcing-conversions", SOURCING_SOURCE] });
      setStaged((current) => {
        const savedMultiplier = savedRule.embeddedMultiplierOverride;
        const target = current.find((entry) => entry.id === lineId);
        if (!target) return current;

        return current.map((entry) => {
          if (entry.source !== savedRule.source || entry.tokenHash !== savedRule.tokenHash) {
            return entry;
          }

          const multiplier = savedMultiplier ?? entry.embeddedPackCount;
          const effectiveQuantity = Math.max(0, entry.lineQuantity * Math.max(1, multiplier));
          const parseWarnings = entry.parseWarnings.filter(
            (warning) => warning !== "No confirmed conversion rule."
          );

          return {
            ...entry,
            name: savedRule.canonicalName,
            quantityUnit: savedRule.canonicalQuantityUnit,
            type: savedRule.canonicalType,
            location: savedRule.canonicalLocation,
            tags: savedRule.canonicalTags,
            quantity: effectiveQuantity,
            effectiveQuantity,
            parseState: entry.status === "unavailable" ? "ignored" : "resolved",
            parseWarnings,
            matchedRuleId: savedRule.id
          };
        });
      });
      setTagDrafts({});
      setErrorMessage("");
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Saving mapping failed.");
    },
    onSettled: () => {
      setMappingLineIdPending(null);
    }
  });

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
          <button
            type="button"
            onClick={() => pdfFilePickerRef.current?.click()}
            disabled={pdfParseMutation.isPending}
            className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload Walmart PDF
          </button>
          <input
            ref={pdfFilePickerRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setErrorMessage("");
              pdfParseMutation.mutate(file);
            }}
          />
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
            {ignoredStaged.length}
          </p>
        </div>

        {sessionQuery.data?.authed && (
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={customTypeInput}
              onChange={(event) => setCustomTypeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addCustomType();
              }}
              className="w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text md:max-w-sm"
              placeholder="Add custom type"
            />
            <button
              type="button"
              onClick={addCustomType}
              className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text"
            >
              Add Type
            </button>
          </div>
        )}

        <div className="space-y-3">
          {needsReviewStaged.map((line) => {
            const isMappingPending = mappingLineIdPending === line.id;
            return (
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
                    disabled={isMappingPending}
                    className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
                  />

                  <div className="flex rounded border border-edge bg-card">
                    <input
                      type="text"
                      value={quantityDrafts[line.id] ?? formatQuantityValue(line.quantity)}
                      onChange={(event) => onStagedQuantityInput(line.id, event.target.value)}
                      onBlur={() => onStagedQuantityBlur(line.id)}
                      disabled={isMappingPending}
                      className="w-full bg-card px-2 py-1 text-sm outline-none"
                    />
                    <div className="min-w-[88px] border-l border-edge">
                      <StyledSelect
                        value={line.quantityUnit}
                        onChange={(nextValue) =>
                          setStaged((current) =>
                            current.map((item) =>
                              item.id === line.id
                                ? { ...item, quantityUnit: nextValue as QuantityUnit }
                                : item
                            )
                          )
                        }
                        options={QUANTITY_UNIT_OPTIONS}
                        disabled={isMappingPending}
                        buttonClassName="h-full rounded-none border-0 bg-card px-2 py-1 text-xs"
                        ariaLabel="Quantity unit"
                      />
                    </div>
                  </div>

                  {sessionQuery.data?.authed ? (
                    <div className="grid gap-2">
                      <StyledSelect
                        value={line.type}
                        onChange={(nextValue) => onStagedTypeInput(line.id, nextValue)}
                        options={allTypeOptions}
                        disabled={isMappingPending}
                        buttonClassName="bg-card px-2 py-1"
                        ariaLabel="Ingredient type"
                      />
                      <input
                        value={line.type}
                        list={`staging-type-options-${line.id}`}
                        onChange={(event) => onStagedTypeInput(line.id, event.target.value)}
                        disabled={isMappingPending}
                        className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
                        placeholder="Custom type/category"
                      />
                      <datalist id={`staging-type-options-${line.id}`}>
                        {allTypeOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>
                  ) : (
                    <StyledSelect
                      value={line.type}
                      onChange={(nextValue) =>
                        setStaged((current) =>
                          current.map((item) =>
                            item.id === line.id ? { ...item, type: nextValue as ItemType } : item
                          )
                        )
                      }
                      options={allTypeOptions}
                      disabled={isMappingPending}
                      buttonClassName="bg-card px-2 py-1"
                      ariaLabel="Ingredient type"
                    />
                  )}

                  <input
                    value={tagDrafts[line.id] ?? formatTagInput(line.tags)}
                    onChange={(event) =>
                      setTagDrafts((current) => ({ ...current, [line.id]: event.target.value }))
                    }
                    onBlur={() => {
                      const raw = tagDrafts[line.id] ?? formatTagInput(line.tags);
                      setStaged((current) =>
                        current.map((item) =>
                          item.id === line.id
                            ? {
                                ...item,
                                tags: parseTagInput(raw)
                              }
                            : item
                        )
                      );
                      setTagDrafts((current) => {
                        return { ...current, [line.id]: formatTagInput(parseTagInput(raw)) };
                      });
                    }}
                    disabled={isMappingPending}
                    className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => confirmMappingMutation.mutate(line.id)}
                  disabled={mappingLineIdPending === line.id}
                  className="rounded border border-edge px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted transition hover:border-text hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mappingLineIdPending === line.id ? "Saving Mapping..." : "Confirm Mapping"}
                </button>
                {line.parseWarnings.length > 0 && (
                  <p className="font-mono text-xs text-amber-500">{line.parseWarnings.join(" ")}</p>
                )}
              </article>
            );
          })}

          {resolvedStaged.map((line) => (
            <article key={line.id} className="space-y-2 rounded border border-edge bg-canvas p-3">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                Resolved • Qty {formatQuantityValue(line.quantity)} {line.quantityUnit}
              </p>
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

                <div className="flex rounded border border-edge bg-card">
                  <input
                    type="text"
                    value={quantityDrafts[line.id] ?? formatQuantityValue(line.quantity)}
                    onChange={(event) => onStagedQuantityInput(line.id, event.target.value)}
                    onBlur={() => onStagedQuantityBlur(line.id)}
                    className="w-full bg-card px-2 py-1 text-sm outline-none"
                  />
                  <div className="min-w-[88px] border-l border-edge">
                    <StyledSelect
                      value={line.quantityUnit}
                      onChange={(nextValue) =>
                        setStaged((current) =>
                          current.map((item) =>
                            item.id === line.id
                              ? { ...item, quantityUnit: nextValue as QuantityUnit }
                              : item
                          )
                        )
                      }
                      options={QUANTITY_UNIT_OPTIONS}
                      buttonClassName="h-full rounded-none border-0 bg-card px-2 py-1 text-xs"
                      ariaLabel="Quantity unit"
                    />
                  </div>
                </div>

              {sessionQuery.data?.authed ? (
                <div className="grid gap-2">
                  <StyledSelect
                    value={line.type}
                    onChange={(nextValue) => onStagedTypeInput(line.id, nextValue)}
                    options={allTypeOptions}
                    buttonClassName="bg-card px-2 py-1"
                    ariaLabel="Ingredient type"
                  />
                  <input
                    value={line.type}
                    list={`staging-type-options-${line.id}`}
                    onChange={(event) => onStagedTypeInput(line.id, event.target.value)}
                    className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
                    placeholder="Custom type/category"
                  />
                  <datalist id={`staging-type-options-${line.id}`}>
                    {allTypeOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <StyledSelect
                  value={line.type}
                  onChange={(nextValue) =>
                    setStaged((current) =>
                      current.map((item) =>
                        item.id === line.id ? { ...item, type: nextValue as ItemType } : item
                      )
                    )
                  }
                  options={allTypeOptions}
                  buttonClassName="bg-card px-2 py-1"
                  ariaLabel="Ingredient type"
                />
              )}

              <input
                value={tagDrafts[line.id] ?? formatTagInput(line.tags)}
                onChange={(event) =>
                  setTagDrafts((current) => ({ ...current, [line.id]: event.target.value }))
                }
                onBlur={() => {
                  const raw = tagDrafts[line.id] ?? formatTagInput(line.tags);
                  setStaged((current) =>
                    current.map((item) =>
                      item.id === line.id
                        ? {
                            ...item,
                            tags: parseTagInput(raw)
                          }
                        : item
                    )
                  );
                  setTagDrafts((current) => {
                    return { ...current, [line.id]: formatTagInput(parseTagInput(raw)) };
                  });
                }}
                className="rounded border border-edge bg-card px-2 py-1 text-sm outline-none focus:border-text"
                placeholder="tag1, tag2, tag3"
              />
              </div>
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
        {pdfParseMutation.isPending && (
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-muted">
            Parsing PDF...
          </p>
        )}

        {errorMessage && <p className="mt-3 font-mono text-sm text-red-500">{errorMessage}</p>}
      </section>
    </div>
  );
}
