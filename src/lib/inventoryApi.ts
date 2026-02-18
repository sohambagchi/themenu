import type { Item, ItemStockKind, ItemType, NewItemInput } from "@/lib/types";

function asStockKind(raw: string): ItemStockKind {
  return raw === "Ingredient" ? "Ingredient" : "Prepared";
}

export function toSupabaseTypeLabel(value: string): ItemType {
  const normalized = value.trim();
  return (normalized.length > 0 ? normalized : "Veg") as ItemType;
}

export async function fetchInventoryItems(stockKind: ItemStockKind) {
  const response = await fetch(`/api/items?stockKind=${stockKind}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to load inventory.");
  }

  const payload = (await response.json()) as { items: Item[] };
  return (payload.items ?? []).map((item) => ({
    ...item,
    stockKind: asStockKind(item.stockKind)
  }));
}

export async function adjustInventoryQuantity(itemId: string, delta: number) {
  const response = await fetch("/api/items/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: itemId, delta })
  });

  if (response.status === 401) {
    throw new Error("Login required to adjust Ingredient stock.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to adjust quantity.");
  }
}

export async function insertItems(
  items: NewItemInput[],
  username?: string,
  password?: string
) {
  const payload: {
    items: NewItemInput[];
    username?: string;
    password?: string;
  } = { items };

  if (username) payload.username = username;
  if (password) payload.password = password;

  const response = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.status === 401) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Login required to add new items. Open /login.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to insert items.");
  }
}

export async function consumeInventoryItems(
  operations: Array<{ id: string; quantity: number }>,
  username?: string,
  password?: string
) {
  const payload: {
    operations: Array<{ id: string; quantity: number }>;
    username?: string;
    password?: string;
  } = { operations };

  if (username) payload.username = username;
  if (password) payload.password = password;

  const response = await fetch("/api/items/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to update stock.");
  }
}

export async function uploadInventoryImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/image", {
    method: "POST",
    body: formData
  });

  if (response.status === 401) {
    throw new Error("Login required to upload photos. Open /login.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to upload photo.");
  }

  const payload = (await response.json()) as { url: string };
  return payload.url;
}
