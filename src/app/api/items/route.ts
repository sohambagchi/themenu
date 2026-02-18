import { NextResponse } from "next/server";

import {
  getDashboardOwnerUserId,
  hasValidDashboardCredentials,
  requireDashboardSession
} from "@/lib/dashboardAuth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DbItemRow, Item, ItemStockKind, NewItemInput, TagValue } from "@/lib/types";

function rowToItem(row: DbItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    photoUrl: row.photo_url,
    quantity: row.quantity,
    dateAdded: row.date_added,
    stockKind: row.stock_kind,
    location: row.location,
    type: row.type,
    ingredients: row.ingredients ?? [],
    tags: (row.tags ?? []) as TagValue[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function itemToInsertRow(item: NewItemInput, ownerUserId: string) {
  return {
    user_id: ownerUserId,
    name: item.name,
    photo_url: item.photoUrl,
    quantity: Math.max(0, Math.trunc(item.quantity)),
    date_added: item.dateAdded,
    stock_kind: item.stockKind,
    location: item.location,
    type: item.type,
    ingredients: item.ingredients ?? [],
    tags: item.tags
  };
}

function toStockKind(raw: string | null): ItemStockKind {
  return raw === "Ingredient" ? "Ingredient" : "Prepared";
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const stockKind = toStockKind(searchParams.get("stockKind"));

  let query = supabase
    .from("items")
    .select("*")
    .eq("user_id", ownerUserId)
    .eq("stock_kind", stockKind);

  if (stockKind === "Ingredient") {
    query = query.gt("quantity", 0);
  }

  const { data, error } = await query.order("date_added", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map((row: any) => rowToItem(row as DbItemRow)) });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    items?: NewItemInput[];
    username?: string;
    password?: string;
  };
  const hasSession = await requireDashboardSession();
  const hasCreds = hasValidDashboardCredentials(
    String(payload.username ?? ""),
    String(payload.password ?? "")
  );

  if (!hasSession && !hasCreds) {
    return NextResponse.json(
      { error: "Login required. Provide valid username/password." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const items = Array.isArray(payload.items) ? payload.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "No items provided." }, { status: 400 });
  }

  const insertRows = items.map((item) => itemToInsertRow(item, ownerUserId));
  const { error } = await supabase.from("items").insert(insertRows);

  if (error) {
    if ((error as { code?: string }).code === "23503") {
      return NextResponse.json(
        {
          error:
            "DASHBOARD_OWNER_USER_ID must match an existing auth.users.id. Create/select an Auth user and set that id in env."
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
