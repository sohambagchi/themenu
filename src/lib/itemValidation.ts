import type { ItemLocation, NewItemInput, TagValue } from "@/lib/types";
import { parseInventoryLabel } from "@/lib/inventoryLabels";
import { normalizeQuantityUnit, parseQuantityUnknown } from "@/lib/quantity";

const VALID_LOCATIONS = new Set<ItemLocation>(["Freezer", "Pantry", "Fridge"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_ITEMS_PER_REQUEST = 100;
const MAX_NAME_LENGTH = 120;
const MAX_TYPE_LENGTH = 64;
const MAX_PHOTO_URL_LENGTH = 2048;
const MAX_ARRAY_FIELD_ITEMS = 30;
const MAX_ARRAY_FIELD_VALUE_LENGTH = 64;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidIsoDate(value: string) {
  if (!ISO_DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function normalizePhotoUrl(raw: unknown) {
  if (raw === null || raw === undefined) return null;

  const value = normalizeText(raw);
  if (!value) return null;
  if (value.length > MAX_PHOTO_URL_LENGTH) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeList(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  const next: string[] = [];
  for (const value of raw) {
    if (next.length >= MAX_ARRAY_FIELD_ITEMS) break;
    const text = normalizeText(value);
    if (!text) continue;
    next.push(text.slice(0, MAX_ARRAY_FIELD_VALUE_LENGTH));
  }
  return next;
}

function normalizeItem(raw: unknown): NewItemInput | null {
  if (!raw || typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;
  const name = normalizeText(row.name).slice(0, MAX_NAME_LENGTH);
  const type = normalizeText(row.type).slice(0, MAX_TYPE_LENGTH);
  const inventoryLabel = parseInventoryLabel(row.inventoryLabel);
  const location = normalizeText(row.location) as ItemLocation;
  const dateAdded = normalizeText(row.dateAdded);
  const quantityUnit = normalizeQuantityUnit(row.quantityUnit ?? "");
  const photoUrl = normalizePhotoUrl(row.photoUrl);
  const ingredients = normalizeList(row.ingredients);
  const tags = normalizeList(row.tags) as TagValue[];

  if (!name) return null;
  if (!type) return null;
  if (!inventoryLabel) return null;
  if (!VALID_LOCATIONS.has(location)) return null;
  if (!isValidIsoDate(dateAdded)) return null;
  const parsedQuantity = parseQuantityUnknown(row.quantity ?? 0);
  if (!Number.isFinite(parsedQuantity ?? NaN) || (parsedQuantity ?? 0) <= 0 || (parsedQuantity ?? 0) > 5000) {
    return null;
  }
  if (quantityUnit === null) return null;
  if (row.photoUrl && !photoUrl) return null;

  return {
    name,
    photoUrl,
    quantity: parsedQuantity ?? 0,
    quantityUnit,
    dateAdded,
    inventoryLabel,
    location,
    type,
    ingredients,
    tags
  };
}

export function normalizeNewItemInputList(raw: unknown) {
  if (!Array.isArray(raw)) {
    return { ok: false as const, error: "Items payload must be an array." };
  }

  if (raw.length === 0) {
    return { ok: false as const, error: "No items provided." };
  }

  if (raw.length > MAX_ITEMS_PER_REQUEST) {
    return {
      ok: false as const,
      error: `Too many items in one request. Max ${MAX_ITEMS_PER_REQUEST}.`
    };
  }

  const normalized: NewItemInput[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "stockKind" in (item as Record<string, unknown>) &&
      !("inventoryLabel" in (item as Record<string, unknown>))
    ) {
      return {
        ok: false as const,
        error: "stockKind is deprecated. Use inventoryLabel=Menu|Pantry."
      };
    }

    const next = normalizeItem(item);
    if (!next) {
      return { ok: false as const, error: "One or more items are invalid." };
    }
    normalized.push(next);
  }

  return { ok: true as const, items: normalized };
}
