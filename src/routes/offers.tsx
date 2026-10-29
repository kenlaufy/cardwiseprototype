import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useStore, uid, type Prefs } from "@/lib/store";
import { buildReminders } from "@/lib/reminders";
import { type Offer } from "@/lib/rewards";
import { addDays, today } from "@/lib/demo";
import { CategoryChips, Empty, Field, PageTitle, selectCls } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Offers & Reminders — CardWise" },
      { name: "description", content: "Track card offers, activation deadlines, and cap reminders." },
      { property: "og:title", content: "Offers & Reminders — CardWise" },
      { property: "og:description", content: "Never miss an activation deadline or bonus cap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OffersPage,
});

const PREF_LABELS: Record<keyof Prefs, string> = { activation: "Activation deadlines", expiring: "Offers nearing expiration", caps: "Approaching a bonus cap", categoryChanges: "Category changes" };

function OffersPage() {
  const { state, saveOffer, removeOffer, dismiss, setPrefs, setRuleActivated } = useStore();
  const [edit, setEdit] = useState<Offer | null>(null);
  const now = today();
  const reminders = buildReminders(state, state.prefs, state.dismissed, now);
  const groups = {
    Current: state.offers.filter((o) => o.startDate <= now && o.endDate >= now),
    Upcoming: state.offers.filter((o) => o.startDate > now),
    Expired: state.offers.filter((o) => o.endDate < now),
  };
  const cardName = (id: string) => state.cards.find((c) => c.id === id)?.nickname || state.cards.find((c) => c.id === id)?.name || "Card";
  const pendingRules = state.rules.filter((r) => r.requiresActivation && !r.activated && (!r.endDate || r.endDate >= now));

  return (
    <div className="space-y-8">
      <PageTitle title="Offers" sub="Activation only counts once you confirm it." action={<Button disabled={!state.cards.length} onClick={() => setEdit({ id: uid(), cardId: state.cards[0]?.id ?? "", title: "", categories: [], rate: 5, startDate: now, endDate: addDays(now, 30), requiresActivation: true, activated: false, stackable: false, source: "manual" })}><Plus className="h-4 w-4" /> Offer</Button>} />

      <section className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl"><Bell className="h-4 w-4" /> Reminders</h2>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs">In-app only · no notification service connected</span>
        </div>
        {reminders.length === 0 ? <p className="text-sm text-muted-foreground">You're all caught up.</p> : (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-xl bg-warning-soft p-3">
                <div className="flex-1"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.detail}</p></div>
                <button aria-label="Dismiss reminder" onClick={() => dismiss(r.id)}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Reminder preferences</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(PREF_LABELS) as (keyof Prefs)[]).map((k) => (
              <label key={k} className="flex items-center gap-2"><Switch checked={state.prefs[k]} onCheckedChange={(v) => setPrefs({ ...state.prefs, [k]: v })} /> {PREF_LABELS[k]}</label>
            ))}
          </div>
        </details>
      </section>

      {pendingRules.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl">Bonus categories to activate</h2>
          {pendingRules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex-1"><p className="font-medium capitalize">{r.rate}% on {r.categories.join(" & ")}</p><p className="text-xs text-muted-foreground">{cardName(r.cardId)}{r.startDate && ` · ${r.startDate} → ${r.endDate}`}</p></div>
              <Button size="sm" variant="outline" onClick={() => { setRuleActivated(r.id, true); toast.success("Marked as activated"); }}>I've activated this</Button>
            </div>
          ))}
        </section>
      )}

      {state.offers.length === 0 && <Empty title="No offers yet" body="Add offers from your card issuer's app to include them in recommendations." />}
      {Object.entries(groups).map(([label, list]) => list.length > 0 && (
        <section key={label} className="space-y-2">
          <h2 className="font-display text-xl">{label}</h2>
          {list.map((o) => (
            <article key={o.id} className={`rounded-2xl border border-border bg-card p-4 ${label === "Expired" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">{cardName(o.cardId)} · {o.categories.join(", ") || "any category"}{o.merchants?.length ? ` · at ${o.merchants.join(", ")}` : ""}</p>
                  <p className="mt-1 text-sm">{o.rate}% extra{o.maxReward != null && ` up to $${o.maxReward}`} · {o.stackable ? "stacks with bonuses" : "doesn't stack"} · {o.startDate} → {o.endDate}</p>
                  <p className="text-xs text-muted-foreground">{o.source === "demo" ? "Demo data" : o.source === "verified" ? "Verified" : "Manually entered"}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Delete offer" onClick={() => removeOffer(o.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {o.requiresActivation && label !== "Expired" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {o.activated ? <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium">Activated (confirmed by you)</span> : <>
                    <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium">Not activated — excluded from recommendations</span>
                    {o.activationUrl && <Button size="sm" variant="outline" asChild><a href={o.activationUrl} target="_blank" rel="noreferrer">Issuer activation <ExternalLink className="h-3 w-3" /></a></Button>}
                    <Button size="sm" onClick={() => { saveOffer({ ...o, activated: true }); toast.success("Marked as activated"); }}>I've activated it</Button>
                  </>}
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
      {edit && <OfferForm o={edit} onClose={() => setEdit(null)} onSave={(o) => { saveOffer(o); setEdit(null); toast.success("Offer saved"); }} />}
    </div>
  );
}

function OfferForm({ o, onClose, onSave }: { o: Offer; onClose: () => void; onSave: (o: Offer) => void }) {
  const { state } = useStore();
  const [d, setD] = useState(o);
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (!d.title.trim()) return setErr("Give the offer a title");
    if (!(d.rate > 0 && d.rate <= 100)) return setErr("Rate must be between 0% and 100%");
    if (d.endDate < d.startDate) return setErr("Offer ends before it starts");
    if (d.activationUrl && !/^https:\/\//.test(d.activationUrl)) return setErr("Activation link must start with https://");
    onSave(d);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add offer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Title"><Input value={d.title} maxLength={60} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
          <Field label="Card"><select className={selectCls} value={d.cardId} onChange={(e) => setD({ ...d, cardId: e.target.value })}>{state.cards.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.name}</option>)}</select></Field>
          <Field label="Categories (none = any)"><CategoryChips multi value={d.categories} onChange={(v) => setD({ ...d, categories: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Extra %"><Input type="number" value={d.rate} onChange={(e) => setD({ ...d, rate: Number(e.target.value) })} /></Field>
            <Field label="Max reward $"><Input type="number" value={d.maxReward ?? ""} onChange={(e) => setD({ ...d, maxReward: e.target.value ? Number(e.target.value) : undefined })} /></Field>
            <Field label="Starts"><Input type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} /></Field>
            <Field label="Ends"><Input type="date" value={d.endDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} /></Field>
          </div>
          <Field label="Merchants (optional, comma separated)"><Input value={d.merchants?.join(", ") ?? ""} onChange={(e) => setD({ ...d, merchants: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined })} /></Field>
          <Field label="Issuer activation link"><Input placeholder="https://" value={d.activationUrl ?? ""} onChange={(e) => setD({ ...d, activationUrl: e.target.value || undefined })} /></Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><Switch checked={d.requiresActivation} onCheckedChange={(v) => setD({ ...d, requiresActivation: v })} /> Requires activation</label>
            <label className="flex items-center gap-2"><Switch checked={d.stackable} onCheckedChange={(v) => setD({ ...d, stackable: v })} /> Stacks with bonuses</label>
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
