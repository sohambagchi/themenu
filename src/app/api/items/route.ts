import { NextResponse } from "next/server";

import {
  getDashboardOwnerUserId,
  hasValidDashboardCredentials,
  isDashboardPublicReadEnabled,
  requireDashboardSession
} from "@/lib/dashboardAuth";
import { normalizeNewItemInputList } from "@/lib/itemValidation";
import {
  dbStockKindToInventoryLabel,
  inventoryLabelToDbStockKind,
  parseInventoryLabel
} from "@/lib/inventoryLabels";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { getRequestIp } from "@/lib/requestMeta";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DbItemRow, Item, NewItemInput, TagValue } from "@/lib/types";

function rowToItem(row: DbItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    photoUrl: row.photo_url,
    quantity: Number(row.quantity),
    quantityUnit: row.quantity_unit ?? "",
    dateAdded: row.date_added,
    inventoryLabel: dbStockKindToInventoryLabel(row.stock_kind),
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
    quantity: Math.max(0, item.quantity),
    quantity_unit: item.quantityUnit,
    date_added: item.dateAdded,
    stock_kind: inventoryLabelToDbStockKind(item.inventoryLabel),
    location: item.location,
    type: item.type,
    ingredients: item.ingredients ?? [],
    tags: item.tags
  };
}

function isMissingQuantityUnitSchemaCacheError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST204" &&
    error.message?.includes("Could not find the 'quantity_unit' column of 'items' in the schema cache")
  );
}

export async function GET(request: Request) {
  if (!isDashboardPublicReadEnabled()) {
    const hasSession = await requireDashboardSession();
    if (!hasSession) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.has("stockKind") && !searchParams.has("inventoryLabel")) {
    return NextResponse.json(
      { error: "stockKind is deprecated. Use inventoryLabel=Menu|Pantry." },
      { status: 410 }
    );
  }

  const inventoryLabel = parseInventoryLabel(searchParams.get("inventoryLabel"));
  if (!inventoryLabel) {
    return NextResponse.json(
      { error: "inventoryLabel must be either Menu or Pantry." },
      { status: 400 }
    );
  }
  const dbStockKind = inventoryLabelToDbStockKind(inventoryLabel);

  const query = supabase
    .from("items")
    .select("*")
    .eq("user_id", ownerUserId)
    .eq("stock_kind", dbStockKind)
    .gt("quantity", 0);

  const { data, error } = await query.order("date_added", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map((row: any) => rowToItem(row as DbItemRow)) });
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        items?: NewItemInput[];
        username?: string;
        password?: string;
      }
    | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const hasSession = await requireDashboardSession();

  if (!hasSession) {
    const username = String(payload.username ?? "").trim();
    const password = String(payload.password ?? "");
    const ip = getRequestIp(request);

    const rateLimit = checkRateLimit({
      key: `inline-item-auth:${ip}`,
      max: 20,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many auth attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
        }
      );
    }

    if (!hasValidDashboardCredentials(username, password)) {
      return NextResponse.json(
        { error: "Login required. Provide valid username/password." },
        { status: 401 }
      );
    }
  }

  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const normalized = normalizeNewItemInputList(payload.items);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const insertRows = normalized.items.map((item) => itemToInsertRow(item, ownerUserId));
  let usedQuantityUnitFallback = false;
  let { error } = await supabase.from("items").insert(insertRows);

  if (isMissingQuantityUnitSchemaCacheError(error as { code?: string; message?: string } | null)) {
    const fallbackInsertRows = insertRows.map(({ quantity_unit, ...rest }) => rest);
    ({ error } = await supabase.from("items").insert(fallbackInsertRows));
    usedQuantityUnitFallback = !error;
  }

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
  if (usedQuantityUnitFallback) {
    console.warn("[items.create] Insert succeeded after dropping quantity_unit due to schema cache drift.");
    return NextResponse.json({
      ok: true,
      warnings: [
        {
          code: "ITEMS_QUANTITY_UNIT_SCHEMA_CACHE_MISMATCH",
          message:
            "Item created, but quantity_unit was omitted because the database schema cache is stale. Apply migrations and refresh the schema cache."
        }
      ]
    });
  }

  return NextResponse.json({ ok: true });
}
