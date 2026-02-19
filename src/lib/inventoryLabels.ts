import type { DbItemStockKind, InventoryLabel } from "@/lib/types";

const NORMALIZED_VALUE_TO_LABEL: Record<string, InventoryLabel> = {
  menu: "Menu",
  pantry: "Pantry"
};

export function dbStockKindToInventoryLabel(stockKind: DbItemStockKind): InventoryLabel {
  return stockKind === "Ingredient" ? "Pantry" : "Menu";
}

export function inventoryLabelToDbStockKind(label: InventoryLabel): DbItemStockKind {
  return label === "Pantry" ? "Ingredient" : "Prepared";
}

export function parseInventoryLabel(raw: unknown): InventoryLabel | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return NORMALIZED_VALUE_TO_LABEL[normalized] ?? null;
}
