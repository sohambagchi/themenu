import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Playfair_Display } from "next/font/google";

import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${headingFont.variable} ${bodyFont.variable} antialiased`}>
        <Providers>
          <div className="mx-auto min-h-screen max-w-7xl px-4 pb-10 pt-6 md:px-8">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-4">
              <div>
                <h1 className="font-serif text-4xl tracking-wide">The Menu</h1>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                  Inventory • Pairing • Staging
                </p>
              </div>

              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em]">
                  <Link href="/" className="rounded border border-edge px-3 py-1.5 text-muted transition hover:text-text">
                    The Pass
                  </Link>
                  <Link
                    href="/staging"
                    className="rounded border border-edge px-3 py-1.5 text-muted transition hover:text-text"
                  >
                    Staging
                  </Link>
                </nav>
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
