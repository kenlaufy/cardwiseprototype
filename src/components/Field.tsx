import type { ReactNode } from "react";
import { CATEGORIES, type Category } from "@/lib/rewards";

export function Field({ label, children, error, htmlFor }: { label: string; children: ReactNode; error?: string; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export const selectCls = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";

export function CategoryChips({ value, onChange, multi }: { value: Category[]; onChange: (v: Category[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {CATEGORIES.map((c) => {
        const on = value.includes(c);
        return (
          <button type="button" key={c} aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== c) : [...value, c]) : [c])}
            className={`rounded-full border px-3.5 py-2 text-sm capitalize transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-accent"}`}>
            {c}
          </button>
        );
      })}
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
