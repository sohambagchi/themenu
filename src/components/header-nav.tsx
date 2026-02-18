"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "/", label: "Menu" },
  { href: "/ingredients", label: "Pantry" },
  { href: "/sourcing", label: "Sourcing" },
  { href: "/mise-en-place", label: "Mise en Place" }
];

function navLinkClass(active: boolean) {
  return `rounded border px-3 py-1.5 transition ${
    active
      ? "border-text text-text"
      : "border-edge text-muted hover:border-text hover:text-text"
  }`;
}

export function HeaderNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="w-full md:w-auto">
      <div className="hidden items-center gap-2 md:flex">
        <nav className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navLinkClass(pathname === link.href)}
            >
              {link.label}
            </Link>
          ))}
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

      <div className="md:hidden">
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            className="rounded border border-edge px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-muted transition hover:border-text hover:text-text"
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>

        {mobileOpen && (
          <div id="mobile-nav-panel" className="mt-3 rounded-lg border border-edge bg-card p-3">
            <nav className="grid gap-2 font-mono text-xs uppercase tracking-[0.15em]">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${navLinkClass(pathname === link.href)} text-center`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 border-t border-edge pt-3">
              {isAuthed ? (
                <form method="post" action="/api/dashboard-auth/logout">
                  <button
                    type="submit"
                    className="w-full rounded border border-edge px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-muted transition hover:border-text hover:text-text"
                  >
                    Logout
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="block w-full rounded border border-edge px-3 py-2 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted transition hover:border-text hover:text-text"
                  onClick={() => setMobileOpen(false)}
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
