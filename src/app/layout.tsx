import type { Metadata } from "next";
import { IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import { cookies } from "next/headers";

import { HeaderNav } from "@/components/header-nav";
import { Providers } from "@/components/providers";
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
          <div className="mx-auto min-h-screen max-w-7xl px-4 pb-8 pt-5 md:px-8 md:pb-10 md:pt-6">
            <header className="mb-6 border-b border-edge pb-4 md:mb-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-serif text-3xl tracking-wide md:text-4xl">The Menu</h1>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                    Inventory • Pairing • Inputs
                  </p>
                </div>
                <HeaderNav isAuthed={isAuthed} />
              </div>
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
