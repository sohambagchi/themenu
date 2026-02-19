import { NextResponse } from "next/server";

import {
  getDashboardOwnerUserId,
  hasValidDashboardCredentials,
  requireDashboardSession
} from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { getRequestIp } from "@/lib/requestMeta";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface ConsumeOperation {
  id: string;
  quantity: number;
}

const MAX_OPERATIONS_PER_REQUEST = 100;
const MAX_QUANTITY_PER_OPERATION = 5000;

function normalizeOperations(input: unknown): ConsumeOperation[] {
  if (!Array.isArray(input)) return [];

  const merged = new Map<string, number>();
  for (const row of input) {
    const id = String((row as { id?: unknown }).id ?? "").trim();
    const quantityRaw = Number((row as { quantity?: unknown }).quantity ?? 0);
    const quantity = Math.min(MAX_QUANTITY_PER_OPERATION, Math.max(0, Math.trunc(quantityRaw)));

    if (!id || id.length > 128 || quantity <= 0) continue;
    if (merged.size >= MAX_OPERATIONS_PER_REQUEST && !merged.has(id)) continue;
    merged.set(id, (merged.get(id) ?? 0) + quantity);
  }

  return Array.from(merged.entries())
    .slice(0, MAX_OPERATIONS_PER_REQUEST)
    .map(([id, quantity]) => ({ id, quantity }));
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        username?: string;
        password?: string;
        operations?: unknown;
      }
    | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const username = String(payload.username ?? "").trim();
  const password = String(payload.password ?? "");
  const hasSession = await requireDashboardSession();

  if (!hasSession) {
    const ip = getRequestIp(request);
    const rateLimit = checkRateLimit({
      key: `inline-consume-auth:${ip}`,
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
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
  }

  const operations = normalizeOperations(payload.operations);
  if (operations.length === 0) {
    return NextResponse.json({ error: "No valid operations provided." }, { status: 400 });
  }

  const ids = operations.map((operation) => operation.id);
  const { data: rows, error: readError } = await supabase
    .from("items")
    .select("id,quantity")
    .eq("user_id", ownerUserId)
    .in("id", ids);

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const quantityById = new Map<string, { quantity: number }>();
  for (const row of rows ?? []) {
    quantityById.set(String((row as { id: string }).id), {
      quantity: Number((row as { quantity: number }).quantity)
    });
  }

  for (const operation of operations) {
    if (!quantityById.has(operation.id)) {
      return NextResponse.json(
        { error: `Item not found in your inventory: ${operation.id}` },
        { status: 400 }
      );
    }
  }

  for (const operation of operations) {
    const current = quantityById.get(operation.id);
    if (!current) continue;
    const next = Math.max(0, current.quantity - operation.quantity);

    if (next === 0) {
      const { error: deleteError } = await supabase
        .from("items")
        .delete()
        .eq("id", operation.id)
        .eq("user_id", ownerUserId);

      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      continue;
    }

    const { error: writeError } = await supabase
      .from("items")
      .update({ quantity: next })
      .eq("id", operation.id)
      .eq("user_id", ownerUserId);

    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: operations.length });
}
