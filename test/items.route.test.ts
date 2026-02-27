import { afterEach, beforeAll, expect, mock, test } from "bun:test";

type JsonObject = Record<string, unknown>;

const state: {
  hasValidDashboardCredentials: (username: string, password: string) => boolean;
  requireDashboardSession: () => Promise<boolean>;
  isAllowedRequestOrigin: () => boolean;
  getRequestIp: () => string;
  checkRateLimit: () => { allowed: boolean; retryAfterSeconds: number };
  insertResponses: Array<{ error: { message: string; code?: string } | null }>;
  insertRows: JsonObject[];
} = {
  hasValidDashboardCredentials: () => true,
  requireDashboardSession: async () => true,
  isAllowedRequestOrigin: () => true,
  getRequestIp: () => "127.0.0.1",
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  insertResponses: [{ error: null }],
  insertRows: []
};

function resetState() {
  state.hasValidDashboardCredentials = () => true;
  state.requireDashboardSession = async () => true;
  state.isAllowedRequestOrigin = () => true;
  state.getRequestIp = () => "127.0.0.1";
  state.checkRateLimit = () => ({ allowed: true, retryAfterSeconds: 0 });
  state.insertResponses = [{ error: null }];
  state.insertRows = [];
}

mock.module("@/lib/dashboardAuth", () => ({
  getDashboardOwnerUserId: () => "owner-user-id",
  hasValidDashboardCredentials: (username: string, password: string) =>
    state.hasValidDashboardCredentials(username, password),
  isDashboardPublicReadEnabled: () => true,
  requireDashboardSession: () => state.requireDashboardSession()
}));

mock.module("@/lib/origin", () => ({
  isAllowedRequestOrigin: () => state.isAllowedRequestOrigin()
}));

mock.module("@/lib/requestMeta", () => ({
  getRequestIp: () => state.getRequestIp()
}));

mock.module("@/lib/rateLimit", () => ({
  checkRateLimit: () => state.checkRateLimit()
}));

mock.module("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "items") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: (rows: JsonObject[]) => {
          state.insertRows.push(rows[0] ?? {});
          return Promise.resolve(state.insertResponses.shift() ?? { error: null });
        }
      };
    }
  })
}));

let POST: (request: Request) => Promise<Response>;

beforeAll(async () => {
  const route = await import("../src/app/api/items/route");
  POST = route.POST;
});

afterEach(() => {
  resetState();
});

test("POST retries insert without quantity_unit when column is missing in schema cache", async () => {
  state.insertResponses = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'quantity_unit' column of 'items' in the schema cache"
      }
    },
    { error: null }
  ];

  const response = await POST(
    new Request("http://localhost/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            name: "Yogurt",
            photoUrl: null,
            quantity: 1,
            quantityUnit: "lb",
            dateAdded: "2026-02-26",
            inventoryLabel: "Pantry",
            location: "Fridge",
            type: "Veg",
            ingredients: [],
            tags: []
          }
        ]
      })
    })
  );

  const payload = (await response.json()) as {
    error?: string;
    ok?: boolean;
    warnings?: Array<{ code: string; message: string }>;
  };

  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  expect(payload.warnings?.[0]?.code).toBe("ITEMS_QUANTITY_UNIT_SCHEMA_CACHE_MISMATCH");
  expect(state.insertRows.length).toBe(2);
  expect(state.insertRows[0]?.quantity_unit).toBe("lb");
  expect(state.insertRows[1]?.quantity_unit).toBeUndefined();
});

test("POST does not retry for non-matching PGRST204 errors", async () => {
  state.insertResponses = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'quantity' column of 'items' in the schema cache"
      }
    },
    { error: null }
  ];

  const response = await POST(
    new Request("http://localhost/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            name: "Yogurt",
            photoUrl: null,
            quantity: 1,
            quantityUnit: "lb",
            dateAdded: "2026-02-26",
            inventoryLabel: "Pantry",
            location: "Fridge",
            type: "Veg",
            ingredients: [],
            tags: []
          }
        ]
      })
    })
  );

  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(500);
  expect(payload.error).toBe("Could not find the 'quantity' column of 'items' in the schema cache");
  expect(state.insertRows.length).toBe(1);
});

test("POST does not retry for non-PGRST204 errors", async () => {
  state.insertResponses = [
    {
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint"
      }
    },
    { error: null }
  ];

  const response = await POST(
    new Request("http://localhost/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            name: "Yogurt",
            photoUrl: null,
            quantity: 1,
            quantityUnit: "lb",
            dateAdded: "2026-02-26",
            inventoryLabel: "Pantry",
            location: "Fridge",
            type: "Veg",
            ingredients: [],
            tags: []
          }
        ]
      })
    })
  );

  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(500);
  expect(payload.error).toBe("duplicate key value violates unique constraint");
  expect(state.insertRows.length).toBe(1);
});

test("POST returns retry failure when fallback insert also fails", async () => {
  state.insertResponses = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'quantity_unit' column of 'items' in the schema cache"
      }
    },
    {
      error: {
        code: "22001",
        message: "value too long for type character varying(10)"
      }
    }
  ];

  const response = await POST(
    new Request("http://localhost/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            name: "Yogurt",
            photoUrl: null,
            quantity: 1,
            quantityUnit: "lb",
            dateAdded: "2026-02-26",
            inventoryLabel: "Pantry",
            location: "Fridge",
            type: "Veg",
            ingredients: [],
            tags: []
          }
        ]
      })
    })
  );

  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(500);
  expect(payload.error).toBe("value too long for type character varying(10)");
  expect(state.insertRows.length).toBe(2);
});
