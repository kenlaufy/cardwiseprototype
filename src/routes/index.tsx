import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { useStore, uid } from "@/lib/store";
import { merchantCertainty, money, rankCards, type Category, type Channel } from "@/lib/rewards";
import { today } from "@/lib/demo";
import { CardTile } from "@/components/CardTile";
import { CategoryChips, Empty, Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Best Card — CardWise" },
      { name: "description", content: "Enter a purchase and see which of your cards earns the most cash back." },
      { property: "og:title", content: "Best Card — CardWise" },
      { property: "og:description", content: "Which card should you use for this purchase? Find out in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BestCard,
});

function BestCard() {
  const { state, savePurchase } = useStore();
  const [amountStr, setAmountStr] = useState("100");
  const [category, setCategory] = useState<Category>("groceries");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(today());
  const [channel, setChannel] = useState<Channel>("in-store");
  const [confirmed, setConfirmed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const amount = Number(amountStr);
  const amountError = amountStr === "" ? "Enter an amount" : !Number.isFinite(amount) || amount <= 0 ? "Amount must be greater than $0" : amount > 1_000_000 ? "That's above our limit" : undefined;
  const input = { amount: amountError ? 0 : amount, category, merchant: merchant || undefined, date, channel };
  const ranked = useMemo(() => rankCards(state, input), [state, amount, category, merchant, date, channel, amountError]); // eslint-disable-line react-hooks/exhaustive-deps
  const certainty = merchantCertainty(merchant, category);
  const uncertain = !certainty.certain && !confirmed;

  if (state.cards.length === 0)
    return (
      <Empty title="Add your first card" body="Add the cards you already carry and we'll tell you which to use." action={<Button asChild><Link to="/wallet">Go to My Wallet</Link></Button>} />
    );

  const best = ranked[0]!;
  const tied = ranked.filter((r) => r.reward === best.reward);

  const record = (cardId: string) => {
    if (amountError) { toast.error(amountError); return; }
    savePurchase({ id: uid(), cardId, amount, category, merchant: merchant || undefined, date, channel });
    toast.success("Purchase recorded — caps updated");
  };

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-3xl bg-card p-5 shadow-soft md:p-6">
        <Field label="Purchase amount" htmlFor="amt" error={amountError}>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl text-muted-foreground">$</span>
            <input id="amt" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-16 w-full rounded-2xl border border-input bg-background pl-10 pr-4 font-display text-4xl outline-none focus:ring-2 focus:ring-ring" aria-invalid={!!amountError} />
          </div>
        </Field>
        <Field label="Category">
          <CategoryChips value={[category]} onChange={(v) => { setCategory(v[0] ?? "other"); setConfirmed(false); }} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Merchant (optional)" htmlFor="m">
            <Input id="m" value={merchant} onChange={(e) => { setMerchant(e.target.value); setConfirmed(false); }} placeholder="e.g. Safeway" maxLength={60} />
          </Field>
          <Field label="Date" htmlFor="d">
            <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
          </Field>
          <Field label="Where">
            <div className="grid grid-cols-2 rounded-md border border-input p-0.5">
              {(["in-store", "online"] as Channel[]).map((c) => (
                <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)} className={`rounded px-2 py-1.5 text-sm capitalize ${channel === c ? "bg-primary text-primary-foreground" : ""}`}>{c}</button>
              ))}
            </div>
          </Field>
        </div>
        {uncertain && (
          <div className="flex flex-col gap-2 rounded-xl bg-warning-soft p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{certainty.reason} Estimates assume <b className="capitalize">{category}</b>.</p>
            <Button size="sm" variant="outline" onClick={() => setConfirmed(true)}>Confirm {category}</Button>
          </div>
        )}
      </section>

      {!amountError && (
        <section aria-live="polite" className="overflow-hidden rounded-3xl bg-hero p-5 text-primary-foreground shadow-lift md:p-6">
          <div className="flex gap-4">
            <div className="w-28 shrink-0"><CardTile card={best.card} /></div>
            <div className="min-w-0">
              <p className="text-sm opacity-80">{tied.length > 1 ? `Tie between ${tied.length} cards` : "Recommended"}</p>
              <h2 className="font-display text-2xl leading-tight">Use {tied.map((t) => t.card.nickname || t.card.name).join(" or ")}</h2>
              <p className="mt-1 text-lg">Estimated cash back: <b>{money(best.reward)}</b>{uncertain && <span className="ml-1 text-xs opacity-80">(category unconfirmed)</span>}</p>
            </div>
          </div>
          <p className="mt-3 text-sm opacity-90">{best.explanation}</p>
          <Button variant="secondary" className="mt-4 w-full sm:w-auto" onClick={() => record(best.card.id)}>Record this purchase</Button>
        </section>
      )}

      {!amountError && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">All cards, ranked by estimated cash back</h3>
          {ranked.map((r, i) => (
            <div key={r.card.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
                <CardTile card={r.card} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.card.nickname || r.card.name}</p>
                  <p className="text-sm text-muted-foreground">{r.explanation}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg">{money(r.reward)}</p>
                  <p className="text-xs text-muted-foreground">{r.effectiveRate}%</p>
                </div>
              </div>
              {r.potential && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs"><Lock className="h-3 w-3" /> Not counted: {r.potential.reason} to earn {money(r.potential.reward)}.</p>
              )}
              <button onClick={() => setOpen(open === r.card.id ? null : r.card.id)} className="mt-2 flex items-center gap-1 text-xs font-medium text-accent" aria-expanded={open === r.card.id}>
                How we calculated this <ChevronDown className={`h-3 w-3 transition ${open === r.card.id ? "rotate-180" : ""}`} />
              </button>
              {open === r.card.id && (
                <div className="mt-2 space-y-1 rounded-lg bg-muted p-3 text-xs">
                  {r.steps.map((s) => <p key={s}>{s}</p>)}
                  {r.appliedRule && <p className="text-muted-foreground">Rule source: {r.appliedRule.source}{r.appliedRule.verified ? " · verified" : " · unverified"} · checked {r.appliedRule.lastChecked.slice(0, 10)}</p>}
                  <p className="text-muted-foreground">Estimate only. Issuers decide final category coding.</p>
                  {i > 0 && <button className="font-medium text-accent underline" onClick={() => record(r.card.id)}>Record with this card instead</button>}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
