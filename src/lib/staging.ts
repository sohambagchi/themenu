import { toSupabaseTypeLabel } from "@/lib/inventoryApi";
import type { ItemLocation, ItemType, StagedLineItem, TagValue } from "@/lib/types";

const defaultLocation: ItemLocation = "Pantry";
const defaultType: ItemType = "Veg";

export function mockOcrScan() {
  return `2x Chicken Tikka
1x Mint Raita
3x Cooked Rice
1x Lemon Pickle`;
}

function inferType(name: string): ItemType {
  const value = name.toLowerCase();
  if (value.includes("chicken") || value.includes("fish") || value.includes("paneer")) {
    return "Protein";
  }
  if (value.includes("rice") || value.includes("bread") || value.includes("naan")) {
    return "Carb";
  }
  if (value.includes("pickle") || value.includes("raita")) {
    return "Ferment/Pickle";
  }
  return defaultType;
}

function inferTags(name: string): TagValue[] {
  const lower = name.toLowerCase();
  const tags: TagValue[] = [];

  if (lower.includes("tikka") || lower.includes("masala")) tags.push("Spicy", "Indian");
  if (lower.includes("raita") || lower.includes("curd")) tags.push("Cooling", "Wet", "Indian");
  if (lower.includes("rice")) tags.push("Neutral", "Indian");
  if (lower.includes("pickle")) tags.push("Indian");

  return tags;
}

export function parseReceiptText(rawText: string): StagedLineItem[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(\d+)\s*x?\s*(.+)$/i);
      const quantity = match ? Number(match[1]) : 1;
      const name = (match ? match[2] : line).trim();

      return {
        id: `staged-${index + 1}`,
        name,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        location: defaultLocation,
        type: toSupabaseTypeLabel(inferType(name)),
        tags: inferTags(name)
      };
    });
}
