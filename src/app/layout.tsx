import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import { cookies } from "next/headers";

import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import { DASHBOARD_SESSION_COOKIE, hasValidDashboardSession } from "@/lib/dashboardAuth";

import "./globals.css";

const headingFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"]
});

const bodyFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "The Menu",
  description: "Personal food inventory and deterministic meal pairing."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  const isAuthed = hasValidDashboardSession(sessionValue);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${headingFont.variable} ${bodyFont.variable} antialiased`}>
        <Providers>
          <div className="mx-auto min-h-screen max-w-7xl px-4 pb-10 pt-6 md:px-8">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-4">
              <div>
                <h1 className="font-serif text-4xl tracking-wide">The Menu</h1>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                  Inventory • Pairing • Inputs
                </p>
              </div>

              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em]">
                  <Link href="/" className="rounded border border-edge px-3 py-1.5 text-muted transition hover:text-text">
                    Prepared
                  </Link>
                  <Link
                    href="/ingredients"
                    className="rounded border border-edge px-3 py-1.5 text-muted transition hover:text-text"
                  >
                    Ingredients
                  </Link>
                  <Link
                    href="/sourcing"
                    className="rounded border border-edge px-3 py-1.5 text-muted transition hover:text-text"
                  >
                    Sourcing
                  </Link>
                  <Link
                    href="/mise-en-place"
                    className="rounded border border-edge px-3 py-1.5 text-muted transition hover:text-text"
                  >
                    Mise en Place
                  </Link>
                </nav>
                {isAuthed ? (
                  <form method="post" action="/api/dashboard-auth/logout">
                    <button
                      type="submit"
                      className="rounded border border-edge px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-muted transition hover:text-text"
                    >
                      Logout
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    className="rounded border border-edge px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-muted transition hover:text-text"
                  >
                    Login
                  </Link>
                )}
                <ThemeToggle />
              </div>
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
