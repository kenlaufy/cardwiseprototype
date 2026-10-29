import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, CreditCard, Sparkles, Tag, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Welcome } from "./Welcome";
import { Skeleton } from "./ui/skeleton";

const NAV = [
  { to: "/", label: "Best Card", icon: Sparkles },
  { to: "/wallet", label: "My Wallet", icon: CreditCard },
  { to: "/offers", label: "Offers", icon: Tag },
  { to: "/activity", label: "Activity", icon: Activity },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, mode, exit, resetDemo } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!ready)
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (!mode) return <Welcome />;

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 md:flex md:sticky md:top-0 md:h-screen">
        <Brand />
        <nav className="mt-8 space-y-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }} activeOptions={{ exact: true }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 text-xs text-muted-foreground">
          <ModeBadge mode={mode} />
          {mode === "demo" && <button onClick={resetDemo} className="block underline">Reset demo data</button>}
          <button onClick={exit} className="flex items-center gap-1 underline"><LogOut className="h-3 w-3" /> Switch mode</button>
        </div>
      </aside>

      <div className="flex-1 pb-24 md:pb-0">
        <header className="flex items-center justify-between px-5 pt-5 md:hidden">
          <Brand />
          <div className="flex items-center gap-3">
            <ModeBadge mode={mode} />
            <button onClick={exit} aria-label="Switch mode" className="text-muted-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-5 py-6 md:px-10 md:py-10">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => {
          const active = path === n.to;
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${active ? "text-accent" : "text-muted-foreground"}`}>
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
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-hero text-primary-foreground font-display text-lg">c</div>
      <span className="font-display text-xl font-semibold tracking-tight">CardWise</span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: "demo" | "local" }) {
  return mode === "demo" ? (
    <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-foreground">Demo data</span>
  ) : (
    <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-foreground">My wallet · this device</span>
  );
}
