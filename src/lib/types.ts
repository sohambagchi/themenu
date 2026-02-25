export type ItemLocation = "Freezer" | "Pantry" | "Fridge";
export type InventoryLabel = "Menu" | "Pantry";
export type DbItemStockKind = "Prepared" | "Ingredient";

export type KnownItemType = "Protein" | "Carb" | "Veg" | "Ferment/Pickle";
export type ItemType = KnownItemType | (string & {});

export type KnownTag =
  | "Spicy"
  | "Cooling"
  | "Dry"
  | "Saucy"
  | "Wet"
  | "Indian"
  | "Italian"
  | "Neutral"
  | "Gravy";

export type TagValue = KnownTag | (string & {});
export type SourcingParseState = "resolved" | "needs_review" | "ignored";
export type ReceiptLineStatus = "shopped" | "weight_adjusted" | "unavailable";

export interface Tag {
  value: TagValue;
}

export interface Item {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  quantity: number; // Number of servings
  dateAdded: string; // ISO date string (YYYY-MM-DD)
  inventoryLabel: InventoryLabel;
  location: ItemLocation;
  type: ItemType;
  ingredients: string[];
  tags: TagValue[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface NewItemInput {
  name: string;
  photoUrl: string | null;
  quantity: number;
  dateAdded: string; // ISO date string
  inventoryLabel: InventoryLabel;
  location: ItemLocation;
  type: ItemType;
  ingredients: string[];
  tags: TagValue[];
}

export interface DbItemRow {
  id: string;
  user_id: string;
  name: string;
  photo_url: string | null;
  quantity: number;
  date_added: string;
  stock_kind: DbItemStockKind;
  location: ItemLocation;
  type: ItemType;
  ingredients: string[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PairingRule {
  id: string;
  userId: string | null; // null means global rule
  triggerItemType: ItemType | null;
  triggerTag: string | null;
  recommendedItemType: ItemType | null;
  recommendedTag: string | null;
  priority: number; // Lower is stronger priority
  reason: string | null;
  isActive: boolean;
}

export interface RecommendationResult {
  item: Item;
  score: number;
  reasons: string[];
}

export interface StagedLineItem {
  id: string;
  source: string;
  rawLine: string;
  rawName: string;
  name: string;
  quantity: number;
  lineQuantity: number;
  embeddedPackCount: number;
  effectiveQuantity: number;
  tokenKey: string;
  tokenHash: string;
  status: ReceiptLineStatus;
  parseState: SourcingParseState;
  parseWarnings: string[];
  matchedRuleId: string | null;
  location: ItemLocation;
  type: ItemType;
  tags: TagValue[];
}

export interface SourcingConversionRule {
  id: string;
  source: string;
  tokenKey: string;
  tokenHash: string;
  canonicalName: string;
  canonicalType: ItemType;
  canonicalLocation: ItemLocation;
  canonicalTags: TagValue[];
  embeddedMultiplierOverride: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingConversionRuleInput {
  source: string;
  tokenKey: string;
  tokenHash: string;
  canonicalName: string;
  canonicalType: ItemType;
  canonicalLocation: ItemLocation;
  canonicalTags: TagValue[];
  embeddedMultiplierOverride: number | null;
}

export interface DbSourcingConversionRuleRow {
  id: string;
  source: string;
  token_key: string;
  token_hash: string;
  canonical_name: string;
  canonical_type: ItemType;
  canonical_location: ItemLocation;
  canonical_tags: string[] | null;
  embedded_multiplier_override: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
