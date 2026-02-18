import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  DASHBOARD_SESSION_COOKIE,
  getSanitizedNextPath,
  hasValidDashboardSession
} from "@/lib/dashboardAuth";

export const metadata: Metadata = {
  title: "Dashboard Login | The Menu"
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = getSanitizedNextPath(params.next ?? "/");
  const hasError = params.error === "invalid";
  const isRateLimited = params.error === "rate_limited";
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;

  if (hasValidDashboardSession(sessionValue)) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-lg border border-edge bg-card p-6 shadow-card">
        <h1 className="font-serif text-3xl">The Menu</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Static Dashboard Access
        </p>

        <form method="post" action="/api/dashboard-auth/login" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />

          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Username</span>
            <input
              name="username"
              type="text"
              required
              className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
            />
          </label>

          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-2 w-full rounded border border-edge bg-canvas px-3 py-2 text-sm outline-none transition focus:border-text"
            />
          </label>

          {hasError && <p className="font-mono text-xs text-red-500">Invalid username or password.</p>}
          {isRateLimited && (
            <p className="font-mono text-xs text-red-500">
              Too many login attempts. Wait a few minutes and try again.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded border border-text bg-text px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-canvas"
          >
            Enter Dashboard
          </button>
        </form>
      </section>
    </main>
  );
}
