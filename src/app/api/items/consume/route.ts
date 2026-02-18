import { NextResponse } from "next/server";

import {
  getDashboardOwnerUserId,
  hasValidDashboardCredentials,
  requireDashboardSession
} from "@/lib/dashboardAuth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface ConsumeOperation {
  id: string;
  quantity: number;
}

function normalizeOperations(input: unknown): ConsumeOperation[] {
  if (!Array.isArray(input)) return [];

  const merged = new Map<string, number>();
  for (const row of input) {
    const id = String((row as { id?: unknown }).id ?? "");
    const quantityRaw = Number((row as { quantity?: unknown }).quantity ?? 0);
    const quantity = Math.max(0, Math.trunc(quantityRaw));

    if (!id || quantity <= 0) continue;
    merged.set(id, (merged.get(id) ?? 0) + quantity);
  }

  return Array.from(merged.entries()).map(([id, quantity]) => ({ id, quantity }));
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as {
    username?: string;
    password?: string;
    operations?: unknown;
  };

  const username = String(payload.username ?? "");
  const password = String(payload.password ?? "");
  const hasSession = await requireDashboardSession();

  if (!hasSession && !hasValidDashboardCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
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

  const quantityById = new Map<string, number>();
  for (const row of rows ?? []) {
    quantityById.set(String((row as { id: string }).id), Number((row as { quantity: number }).quantity));
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
    const current = quantityById.get(operation.id) ?? 0;
    const next = Math.max(0, current - operation.quantity);

    const { error: writeError } = await supabase
      .from("items")
      .update({ quantity: next })
      .eq("id", operation.id)
      .eq("user_id", ownerUserId);

    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: operations.length });
}
