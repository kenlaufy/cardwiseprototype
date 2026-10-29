import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useStore, uid } from "@/lib/store";
import { capUsed, nextReset, money, type BonusRule, type CapGroup, type Card, type Channel, type Period } from "@/lib/rewards";
import { today } from "@/lib/demo";
import { CATALOG, CATALOG_CHECKED, catalogDraft } from "@/lib/catalog";
import { CardTile, CARD_COLORS, tileClass } from "@/components/CardTile";
import { CategoryChips, Empty, Field, PageTitle, selectCls } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "My Wallet — CardWise" },
      { name: "description", content: "Manage your cash-back cards, bonus categories, and spending caps." },
      { property: "og:title", content: "My Wallet — CardWise" },
      { property: "og:description", content: "Your cards, bonus rules, and cap progress in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wallet,
});

interface Draft { card: Card; rules: BonusRule[]; caps: CapGroup[]; notes?: string[] }

const newRule = (cardId: string): BonusRule => ({
  id: uid(), cardId, categories: ["groceries"], rate: 3, requiresActivation: false, activated: false, source: "manual", verified: false, lastChecked: new Date().toISOString(),
});

function Wallet() {
  const { state, saveCard, removeCard } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const now = today();
  const matches = CATALOG.filter((t) => `${t.issuer} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));

  const blank =(): Draft => ({ card: { id: uid(), name: "", issuer: "", color: "teal", baseRate: 1, source: "manual" }, rules: [], caps: [] });

  return (
    <div>
      <PageTitle title="My Wallet" sub="Cards you already own. No card numbers needed." action={<Button onClick={() => setPicking(true)}><Plus className="h-4 w-4" /> Add card</Button>} />
      {state.cards.length === 0 && <Empty title="Your wallet is empty" body="Add a card from the catalog or create a custom one." action={<Button onClick={() => setPicking(true)}>Add a card</Button>} />}
      <div className="grid gap-5 sm:grid-cols-2">
        {state.cards.map((c) => {
          const rules = state.rules.filter((r) => r.cardId === c.id);
          const caps = state.capGroups.filter((g) => g.cardId === c.id);
          return (
            <article key={c.id} className="space-y-3 rounded-3xl bg-card p-4 shadow-soft">
              <CardTile card={c} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{c.nickname || c.name}</h2>
                  <p className="text-xs text-muted-foreground">{c.issuer} · <SourceTag s={c.source} /></p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setDraft({ card: c, rules, caps })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => { if (confirm(`Remove ${c.name} and its purchases?`)) { removeCard(c.id); toast.success("Card removed"); } }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {rules.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-2">
                    <b>{r.rate}%</b> <span className="capitalize">{r.categories.join(", ")}</span>
                    {r.merchants?.length ? <span className="text-xs text-muted-foreground">at {r.merchants.join(", ")}</span> : null}
                    {r.startDate && <span className="text-xs text-muted-foreground">{r.startDate} → {r.endDate}</span>}
                    {r.requiresActivation && <span className={`rounded-full px-2 text-xs ${r.activated ? "bg-success-soft" : "bg-warning-soft"}`}>{r.activated ? "Activated" : "Needs activation"}</span>}
                  </li>
                ))}
                <li className="text-muted-foreground">{c.baseRate}% on everything else</li>
              </ul>
              {caps.map((g) => {
                const used = capUsed(state, g, now);
                return (
                  <div key={g.id} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{g.label}</span><span>{money(used)} / {money(g.amount)}</span></div>
                    <Progress value={(used / g.amount) * 100} aria-label={`${g.label} cap used`} />
                    <p className="text-xs text-muted-foreground">{money(g.amount - used)} left · resets {nextReset(now, g.period)}</p>
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add a card</DialogTitle></DialogHeader>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search cards or issuers" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="space-y-4">
            {(["Popular cards", "Generic templates"] as const).map((group) => {
              const list = matches.filter((t) => !!t.generic === (group === "Generic templates"));
              return list.length > 0 && (
                <div key={group} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
                  {list.map((t) => (
                    <button key={t.id} className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left hover:border-accent" onClick={() => { setPicking(false); setDraft(catalogDraft(t, uid)); }}>
                      <span className={`mt-0.5 h-8 w-12 shrink-0 rounded-md ${tileClass(t.color)}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t.name}{!t.generic && <span className="font-normal text-muted-foreground"> · {t.issuer}</span>}</span>
                        <span className="block text-xs text-muted-foreground">{t.summary}{t.annualFee > 0 && ` · $${t.annualFee}/yr fee`}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
            {matches.length === 0 && <p className="text-sm text-muted-foreground">No cards match "{q.trim()}". Try an issuer name, or create a custom card.</p>}
            <p className="text-xs text-muted-foreground">Popular cards use published terms checked {CATALOG_CHECKED}. Issuers change terms, so confirm against your card. Generic templates are starting points to adjust.</p>
          </div>
          <Button variant="outline" onClick={() => { setPicking(false); setDraft(blank()); }}>Create a custom card</Button>
        </DialogContent>
      </Dialog>

      {draft && <CardEditor draft={draft} onClose={() => setDraft(null)} onSave={(d) => { saveCard(d.card, d.rules, d.caps); setDraft(null); toast.success("Card saved"); }} />}
    </div>
  );
}

function SourceTag({ s }: { s: Card["source"] }) {
  return <span>{s === "demo" ? "Demo data" : s === "catalog" ? "From catalog" : s === "verified" ? "Verified" : "Manually entered"}</span>;
}

function CardEditor({ draft, onClose, onSave }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [err, setErr] = useState<string | null>(null);
  const setCard = (p: Partial<Card>) => setD({ ...d, card: { ...d.card, ...p } });
  const setRule = (id: string, p: Partial<BonusRule>) => setD({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, ...p, lastChecked: new Date().toISOString() } : r)) });
  const setCap = (id: string, p: Partial<CapGroup>) => setD({ ...d, caps: d.caps.map((g) => (g.id === id ? { ...g, ...p } : g)) });

  const submit = () => {
    if (!d.card.name.trim()) return setErr("Card name is required");
    if (!(d.card.baseRate >= 0 && d.card.baseRate <= 20)) return setErr("Base rate must be between 0% and 20%");
    for (const r of d.rules) {
      if (!r.categories.length) return setErr("Each bonus rule needs at least one category");
      if (!(r.rate > 0 && r.rate <= 30)) return setErr("Bonus rates must be between 0% and 30%");
      if (r.startDate && r.endDate && r.endDate < r.startDate) return setErr("A rule ends before it starts");
    }
    for (const g of d.caps) if (!(g.amount > 0)) return setErr("Caps must be greater than $0");
    onSave(d);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{draft.card.name ? "Edit card" : "Custom card"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {d.card.source === "catalog" && (
            <div className="space-y-1 rounded-xl bg-muted p-3 text-xs">
              {d.notes?.map((n) => <p key={n}>{n}</p>)}
              <p className="text-muted-foreground">Published terms checked {CATALOG_CHECKED}. Confirm against your card before relying on them.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Card name"><Input value={d.card.name} maxLength={50} onChange={(e) => setCard({ name: e.target.value })} /></Field>
            <Field label="Issuer"><Input value={d.card.issuer} maxLength={50} onChange={(e) => setCard({ issuer: e.target.value })} /></Field>
            <Field label="Nickname"><Input value={d.card.nickname ?? ""} maxLength={30} onChange={(e) => setCard({ nickname: e.target.value })} /></Field>
            <Field label="Base cash back %"><Input type="number" step="0.1" value={d.card.baseRate} onChange={(e) => setCard({ baseRate: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Color">
            <div className="flex gap-2">
              {CARD_COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={d.card.color === c} onClick={() => setCard({ color: c })} className={`h-8 w-8 rounded-full ${tileClass(c)} ${d.card.color === c ? "ring-2 ring-ring ring-offset-2" : ""}`} />)}
            </div>
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Spending caps</h3><Button size="sm" variant="ghost" onClick={() => setD({ ...d, caps: [...d.caps, { id: uid(), cardId: d.card.id, label: "Bonus cap", amount: 1500, period: "quarter" }] })}><Plus className="h-3 w-3" /> Cap</Button></div>
            {d.caps.map((g) => (
              <div key={g.id} className="grid grid-cols-[1fr_90px_100px_auto] gap-2">
                <Input aria-label="Cap label" value={g.label} onChange={(e) => setCap(g.id, { label: e.target.value })} />
                <Input aria-label="Cap amount" type="number" value={g.amount} onChange={(e) => setCap(g.id, { amount: Number(e.target.value) })} />
                <select aria-label="Reset period" className={selectCls} value={g.period} onChange={(e) => setCap(g.id, { period: e.target.value as Period })}><option value="month">monthly</option><option value="quarter">quarterly</option><option value="year">yearly</option></select>
                <Button size="icon" variant="ghost" aria-label="Remove cap" onClick={() => setD({ ...d, caps: d.caps.filter((x) => x.id !== g.id), rules: d.rules.map((r) => (r.capGroupId === g.id ? { ...r, capGroupId: undefined } : r)) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Point several rules at one cap to make it shared.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Bonus rules</h3><Button size="sm" variant="ghost" onClick={() => setD({ ...d, rules: [...d.rules, newRule(d.card.id)] })}><Plus className="h-3 w-3" /> Rule</Button></div>
            {d.rules.map((r) => (
              <div key={r.id} className="space-y-3 rounded-xl border border-border p-3">
                <CategoryChips multi value={r.categories} onChange={(v) => setRule(r.id, { categories: v })} />
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Rate %"><Input type="number" step="0.5" value={r.rate} onChange={(e) => setRule(r.id, { rate: Number(e.target.value) })} /></Field>
                  <Field label="Channel"><select className={selectCls} value={r.channel ?? ""} onChange={(e) => setRule(r.id, { channel: (e.target.value || undefined) as Channel | undefined })}><option value="">any</option><option value="online">online</option><option value="in-store">in-store</option></select></Field>
                  <Field label="Cap"><select className={selectCls} value={r.capGroupId ?? ""} onChange={(e) => setRule(r.id, { capGroupId: e.target.value || undefined })}><option value="">none</option>{d.caps.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Field>
                  <Field label="Starts"><Input type="date" value={r.startDate ?? ""} onChange={(e) => setRule(r.id, { startDate: e.target.value || undefined })} /></Field>
                  <Field label="Ends"><Input type="date" value={r.endDate ?? ""} onChange={(e) => setRule(r.id, { endDate: e.target.value || undefined })} /></Field>
                  <Field label="Merchants only"><Input placeholder="optional" value={r.merchants?.join(", ") ?? ""} onChange={(e) => setRule(r.id, { merchants: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined })} /></Field>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><Switch checked={r.requiresActivation} onCheckedChange={(v) => setRule(r.id, { requiresActivation: v, activated: v ? r.activated : false })} /> Requires activation</label>
                  {r.requiresActivation && <label className="flex items-center gap-2"><Switch checked={r.activated} onCheckedChange={(v) => setRule(r.id, { activated: v })} /> I've activated it</label>}
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setD({ ...d, rules: d.rules.filter((x) => x.id !== r.id) })}>Remove</Button>
                </div>
                <p className="text-xs text-muted-foreground">Source: {r.source === "demo" ? "demo data" : r.source === "catalog" ? "published terms, unverified" : r.verified ? "verified" : "manually entered, unverified"} · last checked {r.lastChecked.slice(0, 10)}</p>
              </div>
            ))}
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save card</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
