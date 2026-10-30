import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ChartColumn,
  CreditCard,
  Shuffle,
  Sparkles,
  Tag,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { useShuffleDemo } from "@/hooks/use-shuffle-demo";
import { Welcome } from "./Welcome";
import { Skeleton } from "./ui/skeleton";

const NAV = [
  { to: "/", label: "Best Card", icon: Sparkles },
  { to: "/wallet", label: "My Wallet", icon: CreditCard },
  { to: "/offers", label: "Offers", icon: Tag },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/analyzer", label: "Analyzer", icon: ChartColumn },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, mode, state, exit, resetDemo, storageError, unsaved, retrySave, reloadWallet } =
    useStore();
  const shuffle = useShuffleDemo();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!ready)
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (!mode && path !== "/about" && path !== "/settings") return <Welcome />;
  if (!mode)
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        <Link to="/" className="inline-block">
          <Brand />
        </Link>
        <main id="main-content">{children}</main>
      </div>
    );

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 md:flex md:sticky md:top-0 md:h-screen">
        <Brand />
        <nav className="mt-8 space-y-1" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}
              activeOptions={{ exact: true }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 text-xs text-muted-foreground">
          <Link to="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Data & privacy
          </Link>
          <Link to="/about" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> About & support
          </Link>
          <p role="status">{unsaved ? "Changes not saved" : "Saved on this device"}</p>
          <ModeBadge mode={mode} />
          {mode === "demo" && state.demoPersona && (
            <p>
              Playing as <b className="text-foreground">{state.demoPersona}</b>
            </p>
          )}
          {mode === "demo" && (
            <button onClick={shuffle} className="flex items-center gap-1 underline">
              <Shuffle className="h-3 w-3" /> Shuffle spending
            </button>
          )}
          {mode === "demo" && (
            <button onClick={resetDemo} className="block underline">
              Reset demo data
            </button>
          )}
          <button onClick={exit} className="flex items-center gap-1 underline">
            <LogOut className="h-3 w-3" /> Switch mode
          </button>
        </div>
      </aside>

      <div className="flex-1 pb-24 md:pb-0">
        <header className="flex items-center justify-between px-5 pt-5 md:hidden">
          <Brand />
          <div className="flex items-center gap-3">
            <ModeBadge mode={mode} />
            <Link to="/settings" aria-label="Data & privacy">
              <Settings className="h-5 w-5" />
            </Link>
            <button onClick={exit} aria-label="Switch mode" className="text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-3xl px-5 py-6 md:px-10 md:py-10">
          {storageError && (
            <div
              role="alert"
              className="mb-5 space-y-2 rounded-xl border border-warning bg-warning-soft p-4 text-sm"
            >
              <p>{storageError}</p>
              <div className="flex flex-wrap gap-4">
                <button onClick={retrySave} className="underline">
                  Retry saving
                </button>
                <Link to="/settings" className="underline">
                  Back up or recover
                </Link>
                <button
                  onClick={() => {
                    if (
                      !unsaved ||
                      confirm("Reload the saved wallet? Export any unsaved changes first.")
                    )
                      reloadWallet();
                  }}
                  className="underline"
                >
                  Reload saved copy
                </button>
              </div>
            </div>
          )}
          {children}
          <footer className="mt-10 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
            <Link to="/settings">Data & privacy</Link>
            <Link to="/about">About & support</Link>
            <span>Estimates only · USD</span>
          </footer>
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map((n) => {
          const active = path === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${active ? "text-accent" : "text-muted-foreground"}`}
            >
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-hero text-primary-foreground font-display text-lg">
        c
      </div>
      <span className="font-display text-xl font-semibold tracking-tight">CardWise</span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: "demo" | "local" }) {
  return mode === "demo" ? (
    <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-foreground">
      Demo data
    </span>
  ) : (
    <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-foreground">
      My wallet · this device
    </span>
  );
}
