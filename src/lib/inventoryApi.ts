import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DbItemRow, Item, ItemType, TagValue } from "@/lib/types";

const MOCK_ITEMS: Item[] = [
  {
    id: "demo-1",
    userId: "demo",
    name: "Roast Chicken",
    photoUrl:
      "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=80",
    quantity: 2,
    dateAdded: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
    location: "Fridge",
    type: "Protein",
    tags: ["Dry", "Indian", "Spicy"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "demo-2",
    userId: "demo",
    name: "Dal Makhani",
    photoUrl:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
    quantity: 4,
    dateAdded: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString().slice(0, 10),
    location: "Fridge",
    type: "Veg",
    tags: ["Saucy", "Indian", "Gravy"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "demo-3",
    userId: "demo",
    name: "Steamed Rice",
    photoUrl:
      "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
    quantity: 5,
    dateAdded: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10),
    location: "Pantry",
    type: "Carb",
    tags: ["Neutral", "Indian"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "demo-4",
    userId: "demo",
    name: "Cucumber Raita",
    photoUrl:
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80",
    quantity: 3,
    dateAdded: new Date().toISOString().slice(0, 10),
    location: "Fridge",
    type: "Ferment/Pickle",
    tags: ["Cooling", "Wet"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function rowToItem(row: DbItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    photoUrl: row.photo_url,
    quantity: row.quantity,
    dateAdded: row.date_added,
    location: row.location,
    type: row.type,
    tags: (row.tags ?? []) as TagValue[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function itemToRow(item: Item) {
  return {
    user_id: item.userId,
    name: item.name,
    photo_url: item.photoUrl,
    quantity: item.quantity,
    date_added: item.dateAdded,
    location: item.location,
    type: item.type,
    tags: item.tags
  };
}

export function toSupabaseTypeLabel(value: string): ItemType {
  if (value === "Protein" || value === "Carb" || value === "Veg" || value === "Ferment/Pickle") {
    return value;
  }

  return "Veg";
}

export async function fetchInventoryItems() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return MOCK_ITEMS;

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("date_added", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => rowToItem(row as DbItemRow));
}

export async function adjustInventoryQuantity(itemId: string, delta: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: row, error: readError } = await supabase
    .from("items")
    .select("quantity")
    .eq("id", itemId)
    .single();

  if (readError) throw readError;

  const next = Math.max(0, Number(row.quantity) + delta);
  const { error } = await supabase.from("items").update({ quantity: next }).eq("id", itemId);

  if (error) throw error;
}

export async function insertItems(items: Item[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const payload = items.map((item) => itemToRow(item));
  const { error } = await supabase.from("items").insert(payload);

  if (error) throw error;
}
