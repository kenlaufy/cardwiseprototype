import { useId, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, Info, Scale, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { feeChecks, feeVerdict, type FeeCheck, type FeeVerdict } from "@/lib/analysis";
import { shortDate } from "@/lib/dates";
import { today } from "@/lib/demo";
import { money, type FeeReview } from "@/lib/rewards";
import { tileClass } from "./CardTile";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

const VERDICT: Record<FeeVerdict, { label: string; icon: LucideIcon; tone: string }> = {
  keep: { label: "Positive scenario", icon: Check, tone: "bg-success-soft" },
  borderline: { label: "Borderline", icon: Scale, tone: "bg-warning-soft" },
  costly: { label: "Negative scenario", icon: AlertTriangle, tone: "bg-destructive/10" },
  early: { label: "Too early to tell", icon: Clock, tone: "bg-muted" },
};

const DECISIONS: { value: FeeReview["decision"]; label: string }[] = [
  { value: "keep", label: "Keep it" },
  { value: "downgrade", label: "Switch to a no-fee version" },
  { value: "cancel", label: "Cancel it" },
  { value: "undecided", label: "Not sure yet" },
];

const signed = (n: number) => `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Annual fee vs this year's cash back, for each card that has a fee, with a review the cardholder can save. */
export function FeeCheckSection() {
  const { state, updateCard } = useStore();
  const now = today();
  const checks = useMemo(() => feeChecks(state, now), [state, now]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const open = checks.find((c) => c.card.id === reviewing);

  if (!state.cards.length) return null;
  if (!checks.length) return null;

  const { since, days } = checks[0]!;
  return (
    <section aria-labelledby="fee-heading" className="mb-6 rounded-3xl bg-card p-5 shadow-soft">
      <h2 id="fee-heading" className="font-display text-xl">
        Annual fee scenarios · experimental
      </h2>
      <p className="text-xs text-muted-foreground">
        Independent estimates, not a recommendation to keep or cancel a card. From from {days} days
        of purchases since {shortDate(since, now)}.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {checks.map((c) => {
          const review = c.card.feeReview;
          return (
            <li key={c.card.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <span aria-hidden className={`h-6 w-9 shrink-0 rounded ${tileClass(c.card.color)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.card.nickname || c.card.name}</p>
                <p className="text-xs text-muted-foreground">
                  {money(c.earned)} cash back this year · {money(c.fee)} fee
                </p>
                {review && review.decision !== "undecided" && (
                  <p className="text-xs text-muted-foreground">
                    Your call on {shortDate(review.reviewedOn, now)}:{" "}
                    <span className="font-medium text-foreground">
                      {DECISIONS.find((d) => d.value === review.decision)?.label}
                    </span>
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <VerdictBadge verdict={c.verdict} net={c.net} />
                <Button size="sm" variant="outline" onClick={() => setReviewing(c.card.id)}>
                  Review
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {open && (
        <FeeReviewDialog
          check={open}
          now={now}
          onClose={() => setReviewing(null)}
          onSave={(feeReview) => {
            if (!updateCard({ ...open.card, feeReview })) return;
            setReviewing(null);
            toast.success("Review saved");
          }}
        />
      )}
    </section>
  );
}

function VerdictBadge({ verdict, net }: { verdict: FeeVerdict; net: number }) {
  const { label, icon: Icon, tone } = VERDICT[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
      {verdict !== "early" && <span className="font-normal tabular-nums">{signed(net)}/yr</span>}
    </span>
  );
}

function advice(verdict: FeeVerdict, net: number) {
  switch (verdict) {
    case "keep":
      return `It earns about ${money(net)} a year more than it costs.`;
    case "borderline":
      return "It roughly pays for itself. Perks you use or a retention offer from the issuer could tip it either way.";
    case "costly":
      return `It costs about ${money(-net)} a year more than it earns you. Consider asking the issuer for a retention offer, or switching to a no-fee version of the card.`;
    case "early":
      return "There's less than a month of purchases recorded this year, so it's too early to judge.";
  }
}

function FeeReviewDialog({
  check,
  now,
  onClose,
  onSave,
}: {
  check: FeeCheck;
  now: string;
  onClose: () => void;
  onSave: (r: FeeReview) => void;
}) {
  const saved = check.card.feeReview;
  const [perks, setPerks] = useState(saved?.perksValue ? String(saved.perksValue) : "");
  const [decision, setDecision] = useState<FeeReview["decision"]>(saved?.decision ?? "undecided");
  const [note, setNote] = useState(saved?.note ?? "");
  const id = useId();
  const name = check.card.nickname || check.card.name;
  const perksValue = Math.max(0, Number(perks) || 0);
  const invalidPerks = !Number.isFinite(perksValue) || perksValue > 1_000_000;
  const value = round2(check.perYear.extra + perksValue);
  const net = round2(value - check.fee);
  const verdict = feeVerdict(net, check.fee, check.days);
  const { icon: Icon, tone } = VERDICT[verdict];
  const scaleMax = Math.max(value, check.fee, 1);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Is {name} worth its {money(check.fee)} fee?
          </DialogTitle>
          <DialogDescription>
            From {check.days} days of purchases since {shortDate(check.since, now)}, scaled to a
            full year at the same pace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3" aria-label="Value compared with fee, per year">
          {[
            { label: "What it adds", amount: value, bar: "bg-accent" },
            { label: "Annual fee", amount: check.fee, bar: "bg-muted-foreground/40" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-sm">
                <span>{row.label}</span>
                <span className="tabular-nums">{money(row.amount)}/yr</span>
              </div>
              <div className="mt-1 h-2.5">
                <div
                  className={`h-full rounded-r-[4px] ${row.bar}`}
                  style={{ width: `${(Math.max(row.amount, 0) / scaleMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <table className="w-full text-sm">
          <caption className="sr-only">How the net value is worked out, per year</caption>
          <tbody className="divide-y divide-border tabular-nums">
            <tr>
              <th scope="row" className="py-2 text-left font-normal">
                Cash back from {name}
              </th>
              <td className="py-2 text-right">{money(check.perYear.earned)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 text-left font-normal">
                Same purchases on {check.baselineLabel}
              </th>
              <td className="py-2 text-right">−{money(check.perYear.baseline)}</td>
            </tr>
            <tr className="font-medium">
              <th scope="row" className="py-2 text-left">
                Extra this card earns
              </th>
              <td className="py-2 text-right">{signed(check.perYear.extra)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <label htmlFor={`${id}-perks`}>Perks you'd pay for anyway</label>
                <span className="block text-xs text-muted-foreground">
                  Credits, insurance, lounge access. Only count what you actually use.
                </span>
              </th>
              <td className="py-2 text-right">
                <Input
                  id={`${id}-perks`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  className="ml-auto w-24 text-right"
                  value={perks}
                  onChange={(e) => setPerks(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2 text-left font-normal">
                Annual fee
              </th>
              <td className="py-2 text-right">−{money(check.fee)}</td>
            </tr>
            <tr className="font-semibold">
              <th scope="row" className="py-2 text-left">
                Net value per year
              </th>
              <td className="py-2 text-right">{signed(net)}</td>
            </tr>
          </tbody>
        </table>

        <p className={`flex gap-2 rounded-xl p-3 text-sm ${tone}`} aria-live="polite">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <b>{VERDICT[verdict].label}.</b> {advice(verdict, net)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          So far this year: {money(check.spent)} spent on this card, earning {money(check.earned)}{" "}
          cash back. Estimates only, not financial advice.
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Your decision</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DECISIONS.map((d) => (
              <label
                key={d.value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary"
              >
                <input
                  type="radio"
                  name={`${id}-decision`}
                  value={d.value}
                  checked={decision === d.value}
                  onChange={() => setDecision(d.value)}
                  className="accent-primary"
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Note (optional)
          </label>
          <Textarea
            id={`${id}-note`}
            rows={2}
            maxLength={280}
            placeholder="e.g. Call in January to ask for a retention offer"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={invalidPerks}
            onClick={() =>
              onSave({ decision, perksValue, note: note.trim() || undefined, reviewedOn: today() })
            }
          >
            Save review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
