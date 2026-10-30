import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { analyze, RANGES, type Analysis, type RangeId } from "@/lib/analysis";
import { monthLabel, shortDate } from "@/lib/dates";
import { today } from "@/lib/demo";
import { money } from "@/lib/rewards";
import { tileClass } from "@/components/CardTile";
import { Empty, PageTitle } from "@/components/Field";
import { ShuffleDemoBanner } from "@/components/ShuffleDemo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/analyzer")({
  head: () => ({
    meta: [
      { title: "Analyzer — CardWise" },
      {
        name: "description",
        content: "See where your money goes and how much cash back your cards earn on it.",
      },
      { property: "og:title", content: "Analyzer — CardWise" },
      {
        property: "og:description",
        content: "Your spending by category and month, and the cash back you're leaving behind.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyzerPage,
});

const wholeDollars = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const rate = (earned: number, spent: number) =>
  spent > 0 ? `${((earned / spent) * 100).toFixed(1)}%` : "–";

function AnalyzerPage() {
  const { state } = useStore();
  const [range, setRange] = useState<RangeId>("3m");
  const now = today();
  const a = useMemo(() => analyze(state, range, now), [state, range, now]);
  const card = (id: string) => state.cards.find((c) => c.id === id);
  const cardName = (id: string) => card(id)?.nickname || card(id)?.name || "Card";

  if (!state.cards.length)
    return (
      <div>
        <PageTitle title="Analyzer" />
        <Empty
          title="Add your cards first"
          body="The analyzer looks at the purchases you record on your cards."
          action={
            <Button asChild>
              <Link to="/wallet">Go to My Wallet</Link>
            </Button>
          }
        />
      </div>
    );

  const top = a.byCategory[0];
  const largestOpportunity = a.missed[0] ? a.missed[0].best.reward - a.missed[0].earned : 0;

  return (
    <div className="space-y-8">
      <PageTitle
        title="Analyzer"
        sub="Where your money goes, and how much cash back it earns. Based on the purchases you've recorded."
      />

      <ShuffleDemoBanner />

      <div
        role="group"
        aria-label="Time period"
        className="grid w-full grid-cols-4 rounded-xl border border-input bg-card p-1 sm:inline-grid sm:w-auto"
      >
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
            className={`whitespace-nowrap rounded-lg px-1 py-1.5 text-[13px] font-medium transition sm:px-3 sm:text-sm ${range === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {a.purchases.length === 0 ? (
        <Empty
          title="No purchases in this period"
          body="Record purchases from Best Card or Activity, or pick a longer period."
          action={
            <Button asChild>
              <Link to="/activity">Go to Activity</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="spending-heading" className="space-y-4">
            <h2 id="spending-heading" className="font-display text-2xl">
              Spending
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Total spent"
                value={money(a.spent)}
                sub={`${a.purchases.length} ${a.purchases.length === 1 ? "purchase" : "purchases"} since ${shortDate(a.start, now)}`}
              />
              <Stat label="Average purchase" value={money(a.spent / a.purchases.length)} />
              {top && (
                <Stat
                  label="Top category"
                  value={<span className="capitalize">{top.category}</span>}
                  sub={`${money(top.spent)} · ${pct(top.spent, a.spent)}% of spending`}
                />
              )}
            </div>

            <Panel title="By category">
              <CategoryBars rows={a.byCategory} total={a.spent} />
            </Panel>

            {a.byMonth.length > 1 && <MonthPanel rows={a.byMonth} now={now} />}
          </section>

          <section aria-labelledby="rewards-heading" className="space-y-4">
            <h2 id="rewards-heading" className="font-display text-2xl">
              Rewards
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Estimated cash back"
                value={money(a.earned)}
                sub={`${rate(a.earned, a.spent)} of your spending`}
              />
              <Stat
                label="Purchases to review"
                value={String(a.missed.length)}
                sub="Independent comparisons using balances at the time"
              />
              <Stat
                label="Largest individual opportunity"
                value={money(largestOpportunity)}
                sub="Other opportunities may overlap; they cannot be added as guaranteed savings"
              />
            </div>

            <Panel title="By card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="pb-2 font-normal">
                      Card
                    </th>
                    <th scope="col" className="hidden pb-2 text-right font-normal sm:table-cell">
                      Purchases
                    </th>
                    <th scope="col" className="pb-2 text-right font-normal">
                      Spent
                    </th>
                    <th scope="col" className="pb-2 text-right font-normal">
                      Cash back
                    </th>
                    <th scope="col" className="pb-2 text-right font-normal">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {a.byCard.map((r) => (
                    <tr key={r.card.id}>
                      <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <Swatch color={r.card.color} />
                          <span className="min-w-0">{r.card.nickname || r.card.name}</span>
                        </span>
                      </th>
                      <td className="hidden py-2.5 text-right sm:table-cell">{r.count}</td>
                      <td className="py-2.5 pl-2 text-right">{money(r.spent)}</td>
                      <td className="py-2.5 pl-2 text-right">{money(r.earned)}</td>
                      <td className="py-2.5 pl-2 text-right">{rate(r.earned, r.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel
              title="Alternatives by category"
              sub="Independent purchase comparisons using actual historical balances. A category may include several cards; these rates are estimates, not a single achievable plan."
            >
              <ul className="divide-y divide-border">
                {a.byCategory.map((c) => {
                  const switchFrom = c.usedCardId && c.bestCardId && c.usedCardId !== c.bestCardId;
                  return (
                    <li
                      key={c.category}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">{c.category}</p>
                        <p className="text-xs text-muted-foreground">{money(c.spent)} spent</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="flex items-center justify-end gap-2 text-sm">
                          {card(c.bestCardId) && <Swatch color={card(c.bestCardId)!.color} />}
                          {cardName(c.bestCardId)}
                          <span className="text-muted-foreground">
                            {rate(c.bestEarned, c.spent)}
                          </span>
                        </p>
                        {switchFrom && (
                          <p className="mt-1 text-xs">
                            <span className="rounded-full bg-warning-soft px-2 py-0.5">
                              You mostly used {cardName(c.usedCardId)} ({rate(c.earned, c.spent)})
                            </span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {a.missed.length > 0 && (
              <Panel
                title="Individual purchases to review"
                sub="Each comparison changes only that purchase. Changing earlier spending can affect later caps and offers. These amounts are not additive."
              >
                <ul className="divide-y divide-border">
                  {a.missed.slice(0, 5).map((m) => (
                    <li
                      key={m.purchase.id}
                      className="flex items-start justify-between gap-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {m.purchase.merchant || (
                            <span className="capitalize">{m.purchase.category}</span>
                          )}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {money(m.purchase.amount)} · {shortDate(m.purchase.date, now)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Put on {cardName(m.purchase.cardId)} for {money(m.earned)}.{" "}
                          {m.best.card.nickname || m.best.card.name} was estimated at{" "}
                          {money(m.best.reward)}.
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        +{money(m.best.reward - m.earned)}
                      </span>
                    </li>
                  ))}
                </ul>
                {a.missed.length > 5 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    And {a.missed.length - 5} more. Check Best Card before you pay to catch these.
                  </p>
                )}
              </Panel>
            )}

            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              Based on recorded purchases and their saved rules. This beta does not recommend new
              cards or predict a globally optimal spending plan.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Panel({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Swatch({ color, large }: { color: string; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={`shrink-0 rounded ${large ? "h-6 w-9" : "h-3.5 w-5"} ${tileClass(color)}`}
    />
  );
}

function CategoryBars({ rows, total }: { rows: Analysis["byCategory"]; total: number }) {
  const max = Math.max(...rows.map((r) => r.spent), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.category}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              <span className="capitalize">{r.category}</span>{" "}
              <span className="text-xs text-muted-foreground">
                · {r.count} {r.count === 1 ? "purchase" : "purchases"}
              </span>
            </span>
            <span className="tabular-nums">
              {money(r.spent)}{" "}
              <span className="text-xs text-muted-foreground">{pct(r.spent, total)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5">
            <div
              className="h-full rounded-r-[4px] bg-accent"
              style={{ width: `${Math.max((r.spent / max) * 100, 0.5)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MonthPanel({ rows, now }: { rows: Analysis["byMonth"]; now: string }) {
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...rows.map((r) => r.spent), 1);
  const peak = rows.findIndex((r) => r.spent === max);
  const labelEvery = Math.ceil(rows.length / 12);

  return (
    <Panel
      title="By month"
      action={
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? "Show chart" : "Show table"}
        </Button>
      }
    >
      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-2 font-normal">
                Month
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Spent
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Cash back
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {rows.map((r) => (
              <tr key={r.month}>
                <th scope="row" className="py-2 text-left font-normal">
                  {monthLabel(r.month, "")}
                </th>
                <td className="py-2 text-right">{money(r.spent)}</td>
                <td className="py-2 text-right">{money(r.earned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          <ul
            aria-label="Spending by month"
            className="flex h-52 items-end gap-1 border-b border-border pt-14"
          >
            {rows.map((r, i) => {
              const h = (r.spent / max) * 100;
              const align =
                i === 0
                  ? "left-0"
                  : i === rows.length - 1
                    ? "right-0"
                    : "left-1/2 -translate-x-1/2";
              return (
                <li
                  key={r.month}
                  tabIndex={0}
                  aria-label={`${monthLabel(r.month, "")}: ${money(r.spent)} spent, ${money(r.earned)} cash back`}
                  className="relative flex h-full flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className={`w-full max-w-6 rounded-t-[4px] bg-accent transition-opacity ${active !== null && active !== i ? "opacity-40" : ""}`}
                    style={{ height: `${r.spent > 0 ? Math.max(h, 1) : 0}%` }}
                  />
                  {i === peak && active === null && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
                      style={{ bottom: `calc(${h}% + 4px)` }}
                    >
                      {wholeDollars(r.spent)}
                    </span>
                  )}
                  {active === i && (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md ${align}`}
                      style={{ bottom: `calc(${h}% + 8px)` }}
                    >
                      <span className="block text-sm font-semibold">{money(r.spent)}</span>
                      <span className="text-muted-foreground">
                        {monthLabel(r.month, "")} · {money(r.earned)} cash back
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div aria-hidden className="mt-1.5 flex gap-1">
            {rows.map((r, i) => (
              <span key={r.month} className="flex-1 text-center text-[11px] text-muted-foreground">
                {/* Month only, to fit under the column: the tooltip and table carry the year. */}
                {(rows.length - 1 - i) % labelEvery === 0 ? monthLabel(r.month, r.month) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
