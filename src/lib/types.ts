export type ItemLocation = "Freezer" | "Pantry" | "Fridge";

export type ItemType = "Protein" | "Carb" | "Veg" | "Ferment/Pickle";
export type ItemStockKind = "Prepared" | "Ingredient";

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
  stockKind: ItemStockKind;
  location: ItemLocation;
  type: ItemType;
  tags: TagValue[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface NewItemInput {
  name: string;
  photoUrl: string | null;
  quantity: number;
  dateAdded: string; // ISO date string
  stockKind: ItemStockKind;
  location: ItemLocation;
  type: ItemType;
  tags: TagValue[];
}

export interface DbItemRow {
  id: string;
  user_id: string;
  name: string;
  photo_url: string | null;
  quantity: number;
  date_added: string;
  stock_kind: ItemStockKind;
  location: ItemLocation;
  type: ItemType;
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
  name: string;
  quantity: number;
  location: ItemLocation;
  type: ItemType;
  tags: TagValue[];
}
