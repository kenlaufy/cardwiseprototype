import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { useStore, uid } from "@/lib/store";
import {
  CATEGORIES,
  cardReady,
  merchantCertainty,
  money,
  rankCards,
  type Category,
  type Channel,
} from "@/lib/rewards";
import { isDate } from "@/lib/persistence";
import { today } from "@/lib/demo";
import { CardTile } from "@/components/CardTile";
import { Empty, Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Best Card — CardWise" },
      {
        name: "description",
        content: "Compare your cash-back cards for a purchase, with clear assumptions.",
      },
      { property: "og:title", content: "Which card should I use? — CardWise" },
    ],
  }),
  component: BestCard,
});
function BestCard() {
  const { state, savePurchase, removePurchase } = useStore();
  const [amountStr, setAmountStr] = useState("100"),
    [category, setCategory] = useState<Category>("groceries"),
    [merchant, setMerchant] = useState(""),
    [date, setDate] = useState(today()),
    [channel, setChannel] = useState<Channel>("in-store");
  const [more, setMore] = useState(false),
    [open, setOpen] = useState<string | null>(null),
    [recordedId, setRecordedId] = useState<string | null>(null);
  const recording = useRef(false);
  const change = (fn: () => void) => {
    fn();
    setRecordedId(null);
    recording.current = false;
  };
  const amount = Number(amountStr),
    amountError = !amountStr
      ? "Enter an amount"
      : !Number.isFinite(amount) || amount <= 0
        ? "Enter an amount greater than $0"
        : amount > 1_000_000
          ? "Maximum amount is $1,000,000"
          : Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
            ? "Use at most two decimal places"
            : undefined;
  const dateError = !isDate(date) ? "Choose a valid date" : undefined;
  const input = useMemo(
    () => ({
      amount: amountError ? 0 : amount,
      category,
      merchant: merchant.trim() || undefined,
      date,
      channel,
    }),
    [amountError, amount, category, merchant, date, channel],
  );
  const ranked = useMemo(
    () => (dateError ? [] : rankCards(state, input)),
    [dateError, state, input],
  );
  const best = ranked[0],
    certainty = merchantCertainty(merchant, category),
    needsSetup = state.cards.filter((c) => !c.archived && !cardReady(c, date));
  const activeCards = state.cards.filter((c) => !c.archived);
  if (!activeCards.length)
    return (
      <Empty
        title="Choose the cards you already own"
        body="Add a card, confirm its terms and current cap usage, then compare a purchase."
        action={
          <Button asChild>
            <Link to="/wallet">Set up my wallet</Link>
          </Button>
        }
      />
    );
  const record = (cardId: string) => {
    if (recording.current || recordedId) return;
    if (amountError || dateError || date > today()) {
      toast.error(
        amountError ??
          dateError ??
          "Future purchases are estimates only. Record it once it happens.",
      );
      return;
    }
    recording.current = true;
    const id = uid();
    const saved = savePurchase({
      id,
      cardId,
      amount,
      category,
      merchant: merchant.trim() || undefined,
      date,
      channel,
    });
    setRecordedId(id);
    const undo = () => {
      removePurchase(id);
      setRecordedId(null);
      recording.current = false;
    };
    if (saved)
      toast.success("Purchase saved — cap balances updated", {
        action: { label: "Undo", onClick: undo },
        duration: 8000,
      });
    else
      toast.error(
        "Purchase kept in this session. It has not been saved to this browser. Export a backup.",
      );
  };
  const tied = best ? ranked.filter((r) => r.reward === best.reward) : [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Which card should I use?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare a purchase. Recording it is optional.
        </p>
      </div>
      {needsSetup.length > 0 && (
        <div className="rounded-xl bg-warning-soft p-3 text-sm">
          {needsSetup.length} {needsSetup.length === 1 ? "card needs" : "cards need"} setup or a
          terms review before being included.{" "}
          <Link to="/wallet" className="font-semibold underline">
            Review wallet
          </Link>
        </div>
      )}
      <section
        aria-label="Purchase details"
        className="space-y-4 rounded-3xl bg-card p-4 shadow-soft sm:p-5"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)" error={amountError}>
            <Input
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => change(() => setAmountStr(e.target.value))}
              className="h-12 text-2xl"
            />
          </Field>
          <Field label="Merchant (optional)">
            <Input
              value={merchant}
              onChange={(e) => change(() => setMerchant(e.target.value))}
              placeholder="e.g. Safeway"
              maxLength={60}
              className="h-12"
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c, i) => more || i < 3 || c === category).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => change(() => setCategory(c))}
                className={`rounded-full border px-3 py-2 text-sm capitalize ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {c}
              </button>
            ))}
            <button
              aria-expanded={more}
              onClick={() => setMore(!more)}
              className="rounded-full border border-border px-3 py-2 text-sm"
            >
              {more ? "Fewer categories" : "More categories"}
            </button>
          </div>
        </fieldset>
      </section>
      {!amountError && !dateError && best && (
        <section
          aria-live="polite"
          aria-label="Recommended card"
          className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-lift"
        >
          <div className="flex items-center gap-3">
            <div className="w-20 shrink-0">
              <CardTile card={best.card} small />
            </div>
            <div className="min-w-0">
              <p className="text-xs opacity-80">
                {tied.length > 1 ? "Same estimated reward" : "Recommended"}
              </p>
              <h2 className="font-display text-2xl leading-tight">
                Use {tied.map((t) => t.card.nickname || t.card.name).join(" or ")}
              </h2>
              <p className="mt-1">
                Estimated cash back <b>{money(best.reward)}</b>
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm opacity-90">{best.explanation}</p>
          {best.assumptions?.map((a) => (
            <p key={a} className="mt-2 text-sm">
              {a}{" "}
              <Link to="/wallet" className="underline">
                Update usage
              </Link>
            </p>
          ))}
          <Button
            variant="secondary"
            className="mt-4 w-full"
            disabled={!!recordedId || date > today()}
            onClick={() => record(best.card.id)}
          >
            {recordedId ? (
              <>
                <Check className="h-4 w-4" />
                Recorded this purchase
              </>
            ) : date > today() ? (
              "Future purchase — estimate only"
            ) : (
              "Record this purchase"
            )}
          </Button>
          {recordedId && (
            <button
              className="mt-3 text-sm underline"
              onClick={() => {
                removePurchase(recordedId);
                setRecordedId(null);
                recording.current = false;
              }}
            >
              Undo recording
            </button>
          )}
        </section>
      )}
      {!best && !dateError && (
        <Empty
          title="Finish setting up a card"
          body="Confirm your card terms in My Wallet to include it in recommendations."
          action={
            <Button asChild>
              <Link to="/wallet">Review my cards</Link>
            </Button>
          }
        />
      )}
      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
        {certainty.reason} Estimates exclude fees and interest.
      </p>
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">Date & purchase channel</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Purchase date" error={dateError}>
            <Input
              type="date"
              value={date}
              onChange={(e) => change(() => setDate(e.target.value))}
            />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Where</legend>
            <div className="flex gap-2">
              {(["in-store", "online"] as Channel[]).map((c) => (
                <Button
                  key={c}
                  variant={channel === c ? "default" : "outline"}
                  aria-pressed={channel === c}
                  onClick={() => change(() => setChannel(c))}
                >
                  {c === "online" ? "Online" : "In-store"}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
      {!amountError && ranked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">All eligible cards</h2>
          {ranked.map((r) => (
            <article key={r.card.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{r.card.nickname || r.card.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{r.explanation}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{money(r.reward)}</p>
                  <p className="text-xs text-muted-foreground">{r.effectiveRate}%</p>
                </div>
              </div>
              {r.potential && (
                <p className="mt-2 flex gap-1.5 rounded-lg bg-warning-soft p-2 text-xs">
                  <Lock className="h-3 w-3 shrink-0" />
                  Not counted: {r.potential.reason} for an estimated {money(r.potential.reward)}.
                </p>
              )}
              <button
                aria-expanded={open === r.card.id}
                onClick={() => setOpen(open === r.card.id ? null : r.card.id)}
                className="mt-3 flex items-center gap-1 text-xs font-medium underline"
              >
                How we calculated this <ChevronDown className="h-3 w-3" />
              </button>
              {open === r.card.id && (
                <div className="mt-3 space-y-2 rounded-lg bg-muted p-3 text-xs">
                  {r.steps.map((step, i) => (
                    <p key={i}>{step}</p>
                  ))}
                  {r.appliedRule && (
                    <p>
                      Rule source: {r.appliedRule.source} ·{" "}
                      {r.appliedRule.verified ? "source checked" : "confirm against your account"} ·
                      checked {r.appliedRule.lastChecked.slice(0, 10)}
                    </p>
                  )}
                  <p>
                    Uses recorded spending through this purchase date. Issuers decide final
                    eligibility.
                  </p>
                  {r.card.sourceUrls?.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block underline"
                    >
                      Read issuer terms
                    </a>
                  ))}
                  {r.card.id !== best?.card.id && (
                    <button
                      disabled={!!recordedId || date > today()}
                      onClick={() => record(r.card.id)}
                      className="underline disabled:opacity-50"
                    >
                      Record with this card instead
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
