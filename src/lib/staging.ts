import { toSupabaseTypeLabel } from "@/lib/inventoryApi";
import type {
  ItemLocation,
  ItemType,
  ReceiptLineStatus,
  SourcingConversionRule,
  StagedLineItem,
  TagValue
} from "@/lib/types";

const DEFAULT_SOURCE = "walmart";
const DEFAULT_LOCATION: ItemLocation = "Pantry";
const DEFAULT_TYPE: ItemType = "Veg";

const STATUS_QTY_RE = /^(Shopped|Weight-adjusted|Unavailable)\s+Qty\s+(\d+)$/i;
const PRICE_RE = /^\$?\d+\.\d{2}$/;

const NON_ITEM_BLOCK_PATTERNS = [
  /^Feb \d{1,2}, \d{4} order$/i,
  /^Order#\s+/i,
  /^Subtotal$/i,
  /^Tax$/i,
  /^Total$/i,
  /^Driver tip$/i,
  /^Free delivery from store$/i,
  /^Charge history/i,
  /^Payment$/i,
  /^method$/i,
  /^Ending in /i,
  /^Your payment method has a temporary hold/i
];

const STOP_TOKENS = new Set([
  "and",
  "the",
  "fresh",
  "whole",
  "all",
  "natural",
  "shelf",
  "stable",
  "refrigerated",
  "serving",
  "servings",
  "container",
  "size",
  "per",
  "oz",
  "fl",
  "lb",
  "lbs",
  "bag",
  "can",
  "cans",
  "tray",
  "each",
  "count",
  "pack",
  "ct",
  "pint",
  "gallon",
  "half"
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeReceiptLines(rawText: string) {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const lines: string[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const current = rawLines[index];
    const next = rawLines[index + 1];
    const statusMatch = current.match(/^(Shopped|Weight-adjusted|Unavailable)$/i);
    const qtyMatch = next?.match(/^Qty\s+(\d+)$/i);

    if (statusMatch && qtyMatch) {
      lines.push(`${statusMatch[1]} Qty ${qtyMatch[1]}`);
      index += 1;
      continue;
    }

    lines.push(current);
  }

  return lines;
}

function isNonItemBlock(block: string) {
  return NON_ITEM_BLOCK_PATTERNS.some((pattern) => pattern.test(block));
}

function parseStatus(raw: string): { status: ReceiptLineStatus; quantity: number } | null {
  const match = raw.match(STATUS_QTY_RE);
  if (!match) return null;

  const statusRaw = match[1].toLowerCase();
  const quantity = Number(match[2]);
  if (!Number.isFinite(quantity) || quantity < 0) return null;

  if (statusRaw === "shopped") return { status: "shopped", quantity };
  if (statusRaw === "weight-adjusted") return { status: "weight_adjusted", quantity };
  return { status: "unavailable", quantity };
}

function parsePriceCents(raw: string | undefined) {
  if (!raw || !PRICE_RE.test(raw)) return null;
  const numeric = Number(raw.replace("$", ""));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

function extractEmbeddedPackCount(rawName: string) {
  const patterns = [
    /\((\d+)\s*pack\)/i,
    /\b(\d+)\s*pack\b/i,
    /\((\d+)\s*count\)/i,
    /\b(\d+)\s*count\b/i,
    /\b(\d+)\s*ct\b/i
  ];

  for (const pattern of patterns) {
    const match = rawName.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 1) return Math.trunc(value);
  }

  return 1;
}

function inferType(name: string): ItemType {
  const value = name.toLowerCase();
  if (
    value.includes("chicken") ||
    value.includes("fish") ||
    value.includes("paneer") ||
    value.includes("beef") ||
    value.includes("sausage") ||
    value.includes("pork") ||
    value.includes("salmon")
  ) {
    return "Protein";
  }
  if (value.includes("rice") || value.includes("bread") || value.includes("naan") || value.includes("pasta")) {
    return "Carb";
  }
  if (value.includes("pickle") || value.includes("raita") || value.includes("yogurt")) {
    return "Ferment/Pickle";
  }
  return DEFAULT_TYPE;
}

function inferTags(name: string): TagValue[] {
  const lower = name.toLowerCase();
  const tags: TagValue[] = [];

  if (lower.includes("masala") || lower.includes("hot")) tags.push("Spicy");
  if (lower.includes("yogurt")) tags.push("Cooling");
  if (lower.includes("broth") || lower.includes("cream")) tags.push("Wet");
  if (lower.includes("fresh")) tags.push("Neutral");

  return tags;
}

function sanitizeName(rawName: string) {
  return normalizeWhitespace(
    rawName
      .replace(/^\(\d+\s*pack\)\s*/i, "")
      .replace(/,\s*,/g, ", ")
  );
}

function tokenize(rawName: string) {
  const cleaned = rawName
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ");

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !STOP_TOKENS.has(token))
    .sort();

  const deduped = tokens.filter((token, index) => token !== tokens[index - 1]);
  const tokenKey = deduped.join(" ");
  return { tokens: deduped, tokenKey };
}

function stableHash(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function tokenKeyToHash(tokenKey: string) {
  return stableHash(tokenKey);
}

function buildRuleLookup(source: string, rules: SourcingConversionRule[]) {
  const lookup = new Map<string, SourcingConversionRule>();
  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (rule.source !== source) continue;
    lookup.set(rule.tokenHash, rule);
  }
  return lookup;
}

export function tokenizeReceiptName(rawName: string) {
  const tokenized = tokenize(rawName);
  return {
    tokenKey: tokenized.tokenKey,
    tokenHash: tokenKeyToHash(tokenized.tokenKey),
    embeddedPackCount: extractEmbeddedPackCount(rawName)
  };
}

export function mockOcrScan() {
  return `Feb 23, 2026 order
Order# 2000146-63547968

(4 pack) Kettle & Fire Beef Cooking Broth, Shelf-Stable, 32 oz

Shopped Qty 1

$15.92

Fresh Banana, Each

Weight-adjusted Qty 5

$0.88`;
}

export function parseReceiptText(
  rawText: string,
  rules: SourcingConversionRule[] = [],
  source = DEFAULT_SOURCE
): StagedLineItem[] {
  const lines = normalizeReceiptLines(rawText);
  const ruleLookup = buildRuleLookup(source, rules);
  const staged: StagedLineItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const statusLine = lines[index];
    const parsedStatus = parseStatus(statusLine);
    if (!parsedStatus) continue;

    let rawNameLine = "";
    for (let candidateIndex = index - 1; candidateIndex >= 0; candidateIndex -= 1) {
      const candidate = lines[candidateIndex];
      if (!candidate) continue;
      if (isNonItemBlock(candidate)) continue;
      if (PRICE_RE.test(candidate)) continue;
      if (/^Qty\s+\d+$/i.test(candidate)) continue;
      if (/^(Shopped|Weight-adjusted|Unavailable)$/i.test(candidate)) continue;
      if (parseStatus(candidate)) continue;
      rawNameLine = candidate;
      break;
    }

    if (!rawNameLine) continue;

    const rawName = normalizeWhitespace(rawNameLine);
    const displayName = sanitizeName(rawName);
    const tokenized = tokenizeReceiptName(rawName);
    const matchedRule = ruleLookup.get(tokenized.tokenHash) ?? null;
    const multiplier = matchedRule?.embeddedMultiplierOverride ?? tokenized.embeddedPackCount;
    const effectiveQuantity = Math.max(0, parsedStatus.quantity * Math.max(1, multiplier));
    const parseWarnings: string[] = [];
    const priceLine = lines.slice(index + 1, index + 4).find((line) => PRICE_RE.test(line));
    if (!priceLine) {
      parseWarnings.push("Price line not found near status line.");
    }

    let parseState: StagedLineItem["parseState"] = "needs_review";
    if (parsedStatus.status === "unavailable") {
      parseState = "ignored";
      parseWarnings.push("Marked unavailable on receipt.");
    } else if (!matchedRule) {
      parseWarnings.push("No confirmed conversion rule.");
    } else {
      parseState = "resolved";
    }

    const name = matchedRule?.canonicalName ?? displayName;
    const quantityUnit = matchedRule?.canonicalQuantityUnit ?? "";
    const type = toSupabaseTypeLabel(matchedRule?.canonicalType ?? inferType(displayName));
    const location = matchedRule?.canonicalLocation ?? DEFAULT_LOCATION;
    const tags = matchedRule?.canonicalTags?.length
      ? matchedRule.canonicalTags
      : inferTags(displayName);

    staged.push({
      id: `staged-${staged.length + 1}`,
      source,
      rawLine: [rawName, statusLine, priceLine ?? ""].filter(Boolean).join(" | "),
      rawName,
      name,
      quantity: effectiveQuantity,
      quantityUnit,
      lineQuantity: parsedStatus.quantity,
      embeddedPackCount: tokenized.embeddedPackCount,
      effectiveQuantity,
      tokenKey: tokenized.tokenKey,
      tokenHash: tokenized.tokenHash,
      status: parsedStatus.status,
      parseState,
      parseWarnings,
      matchedRuleId: matchedRule?.id ?? null,
      location,
      type,
      tags
    });
  }

  return staged;
}
