import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, uid } from "@/lib/store";
import { calculateCard, CATEGORIES, money, type Category, type Channel, type Purchase } from "@/lib/rewards";
import { today } from "@/lib/demo";
import { CardTile } from "@/components/CardTile";
import { Empty, Field, PageTitle, selectCls } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — CardWise" },
      { name: "description", content: "Record purchases to track spending caps and estimated cash back." },
      { property: "og:title", content: "Activity — CardWise" },
      { property: "og:description", content: "Your recorded purchases and estimated rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { state, savePurchase, removePurchase } = useStore();
  const [edit, setEdit] = useState<Purchase | null>(null);
  const sorted = [...state.purchases].sort((a, b) => b.date.localeCompare(a.date));
  // Estimated reward per purchase, computed against prior purchases only.
  const est = (p: Purchase) => {
    const card = state.cards.find((c) => c.id === p.cardId);
    if (!card) return 0;
    const prior = state.purchases.filter((x) => x.id !== p.id && (x.date < p.date || (x.date === p.date && state.purchases.indexOf(x) < state.purchases.indexOf(p))));
    return calculateCard({ ...state, purchases: prior }, card, p).reward;
  };
  const total = sorted.reduce((s, p) => s + est(p), 0);

  const blank = (): Purchase | null => (state.cards[0] ? { id: uid(), cardId: state.cards[0].id, amount: 0, category: "groceries", date: today(), channel: "in-store" } : null);

  return (
    <div>
      <PageTitle title="Activity" sub={`${sorted.length} purchases · ${money(total)} estimated cash back`} action={<Button disabled={!state.cards.length} onClick={() => setEdit(blank())}><Plus className="h-4 w-4" /> Add</Button>} />
      {!state.cards.length ? <Empty title="No cards yet" body="Add a card in My Wallet before recording purchases." /> : sorted.length === 0 && <Empty title="No purchases recorded" body="Recorded purchases update your cap progress. Recommendations alone never count as spending." />}
      <ul className="space-y-2">
        {sorted.map((p) => {
          const card = state.cards.find((c) => c.id === p.cardId);
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              {card && <CardTile card={card} small />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.merchant || <span className="capitalize">{p.category}</span>}</p>
                <p className="text-xs capitalize text-muted-foreground">{p.category} · {p.date} · {card?.nickname || card?.name}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{money(p.amount)}</p>
                <p className="text-xs text-accent">+{money(est(p))} est.</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Edit purchase" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete purchase" onClick={() => { removePurchase(p.id); toast.success("Purchase deleted — caps updated"); }}><Trash2 className="h-4 w-4" /></Button>
            </li>
          );
        })}
      </ul>
      {edit && <PurchaseForm p={edit} onClose={() => setEdit(null)} onSave={(p) => { savePurchase(p); setEdit(null); toast.success("Saved — caps updated"); }} />}
    </div>
  );
}

function PurchaseForm({ p, onClose, onSave }: { p: Purchase; onClose: () => void; onSave: (p: Purchase) => void }) {
  const { state } = useStore();
  const [d, setD] = useState({ ...p, amountStr: p.amount ? String(p.amount) : "" });
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const amount = Number(d.amountStr);
    if (!(amount > 0) || amount > 1_000_000) return setErr("Enter an amount greater than $0");
    if (!d.date) return setErr("Pick a date");
    const { amountStr: _a, ...rest } = d;
    onSave({ ...rest, amount, merchant: d.merchant?.trim() || undefined });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{state.purchases.some((x) => x.id === p.id) ? "Edit purchase" : "Add purchase"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)"><Input inputMode="decimal" value={d.amountStr} onChange={(e) => setD({ ...d, amountStr: e.target.value.replace(/[^0-9.]/g, "") })} /></Field>
          <Field label="Date"><Input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
          <Field label="Card"><select className={selectCls} value={d.cardId} onChange={(e) => setD({ ...d, cardId: e.target.value })}>{state.cards.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.name}</option>)}</select></Field>
          <Field label="Category"><select className={selectCls} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Merchant"><Input value={d.merchant ?? ""} maxLength={60} onChange={(e) => setD({ ...d, merchant: e.target.value })} /></Field>
          <Field label="Where"><select className={selectCls} value={d.channel} onChange={(e) => setD({ ...d, channel: e.target.value as Channel })}><option value="in-store">in-store</option><option value="online">online</option></select></Field>
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save</Button></div>
      </DialogContent>
    </Dialog>
  );
}
