import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, uid } from "@/lib/store";
import { CATEGORIES, money, type Category, type Channel, type Purchase } from "@/lib/rewards";
import { earnedByPurchase } from "@/lib/analysis";
import { isDate } from "@/lib/persistence";
import { today } from "@/lib/demo";
import { CardTile } from "@/components/CardTile";
import { Empty, Field, PageTitle, selectCls } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — CardWise" },
      {
        name: "description",
        content: "Record purchases to track spending caps and estimated cash back.",
      },
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
  const earned = earnedByPurchase(state);
  const est = (p: Purchase) => earned.get(p.id) ?? 0;
  const total = sorted.reduce((s, p) => s + est(p), 0);

  const blank = (): Purchase | null =>
    state.cards.find((c) => !c.archived)
      ? {
          id: uid(),
          cardId: state.cards.find((c) => !c.archived)!.id,
          amount: 0,
          category: "groceries",
          date: today(),
          channel: "in-store",
        }
      : null;

  return (
    <div>
      <PageTitle
        title="Activity"
        sub={`${sorted.length} purchases · ${money(total)} estimated cash back`}
        action={
          <Button disabled={!state.cards.some((c) => !c.archived)} onClick={() => setEdit(blank())}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      {!state.cards.length ? (
        <Empty title="No cards yet" body="Add a card in My Wallet before recording purchases." />
      ) : (
        sorted.length === 0 && (
          <Empty
            title="No purchases recorded"
            body="Recorded purchases update your cap progress. Recommendations alone never count as spending."
          />
        )
      )}
      <ul className="space-y-2">
        {sorted.map((p) => {
          const card = state.cards.find((c) => c.id === p.cardId);
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              {card && <CardTile card={card} small />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.merchant || <span className="capitalize">{p.category}</span>}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {p.category} · {p.date} · {card?.nickname || card?.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{money(p.amount)}</p>
                <p className="text-xs text-accent">+{money(est(p))} est.</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit purchase"
                onClick={() => setEdit(p)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete purchase"
                onClick={() => {
                  if (removePurchase(p.id))
                    toast.success("Purchase removed — caps updated", {
                      action: { label: "Undo", onClick: () => savePurchase(p) },
                      duration: 8000,
                    });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      {edit && (
        <PurchaseForm
          p={edit}
          onClose={() => setEdit(null)}
          onSave={(p, useCurrentTerms) => {
            if (savePurchase(p, useCurrentTerms)) {
              setEdit(null);
              toast.success("Saved on this device — caps updated");
            }
          }}
        />
      )}
    </div>
  );
}

function PurchaseForm({
  p,
  onClose,
  onSave,
}: {
  p: Purchase;
  onClose: () => void;
  onSave: (p: Purchase, useCurrentTerms: boolean) => void;
}) {
  const { state } = useStore();
  const [d, setD] = useState({ ...p, amountStr: p.amount ? String(p.amount) : "" });
  const [useCurrentTerms, setUseCurrentTerms] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const amount = Number(d.amountStr);
    if (!(amount > 0) || amount > 1_000_000) return setErr("Enter an amount greater than $0");
    if (!isDate(d.date) || d.date > today())
      return setErr("Choose a valid date on or before today");
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)
      return setErr("Use at most two decimal places");
    const { amountStr: _a, ...rest } = d;
    onSave({ ...rest, amount, merchant: d.merchant?.trim() || undefined }, useCurrentTerms);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state.purchases.some((x) => x.id === p.id) ? "Edit purchase" : "Add purchase"}
          </DialogTitle>
          <DialogDescription>
            Past purchases keep their recorded rule version. Backdated entries use available saved
            rules. Correcting an amount or date updates later cap and offer balances.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)">
            <Input
              inputMode="decimal"
              value={d.amountStr}
              onChange={(e) => setD({ ...d, amountStr: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={d.date}
              onChange={(e) => setD({ ...d, date: e.target.value })}
            />
          </Field>
          <Field label="Card">
            <select
              className={selectCls}
              value={d.cardId}
              onChange={(e) => setD({ ...d, cardId: e.target.value })}
            >
              {state.cards
                .filter((c) => !c.archived || c.id === p.cardId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname || c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              className={selectCls}
              value={d.category}
              onChange={(e) => setD({ ...d, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Merchant">
            <Input
              value={d.merchant ?? ""}
              maxLength={60}
              onChange={(e) => setD({ ...d, merchant: e.target.value })}
            />
          </Field>
          <Field label="Where">
            <select
              className={selectCls}
              value={d.channel}
              onChange={(e) => setD({ ...d, channel: e.target.value as Channel })}
            >
              <option value="in-store">in-store</option>
              <option value="online">online</option>
            </select>
          </Field>
        </div>
        {state.purchases.some((x) => x.id === p.id) && (
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={useCurrentTerms}
              onChange={(e) => setUseCurrentTerms(e.target.checked)}
            />
            Recalculate this purchase using current card rules. This may also change later cap and
            offer usage.
          </label>
        )}
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
