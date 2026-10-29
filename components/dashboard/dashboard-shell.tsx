"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotyLogo } from "@/components/noty-logo";
import { postJson, requestJson } from "@/lib/api/client";
import type { PublicUser } from "@/types/auth.types";
import {
  FolderIcon,
  LogOutIcon,
  NoteIcon,
  TagIcon,
} from "./icons";

const NAV_ITEMS = [
  { href: "/dashboard/notes", label: "Notes", Icon: NoteIcon },
  { href: "/dashboard/projects", label: "Projects", Icon: FolderIcon },
  { href: "/dashboard/tags", label: "Tags", Icon: TagIcon },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    requestJson<PublicUser>("/api/auth/me").then((result) => {
      if (!cancelled && result.ok) {
        setUser(result.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    await postJson("/api/auth/logout", {}, { allowRefresh: false });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col bg-mist/60">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href="/dashboard/notes"
            className="flex items-center gap-2 rounded-md"
            aria-label="noty dashboard"
          >
            <NotyLogo className="h-7 w-7" />
            <span className="font-display text-lg font-semibold tracking-tight">
              noty
            </span>
          </Link>

          <nav
            aria-label="Workspace"
            className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:ml-4 md:w-auto"
          >
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary-strong"
                      : "text-muted hover:bg-mist hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <span className="hidden max-w-40 truncate rounded-lg bg-mist px-3 py-1.5 font-mono text-xs text-muted sm:inline-block">
                @{user.username}
              </span>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-mist hover:text-ink disabled:opacity-60"
            >
              <LogOutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {loggingOut ? "Logging out…" : "Log out"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
