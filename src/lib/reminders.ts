import { addDays } from "./demo";
import { relativeDays, shortDate } from "./dates";
import { capUsed, money, nextReset, type WalletState } from "./rewards";
import type { Prefs } from "./store";

export interface Reminder {
  id: string;
  kind: "activation" | "expiring" | "caps" | "categoryChanges";
  title: string;
  detail: string;
  offerId?: string; // the offer or bonus rule this is about, so the page can act on it
  ruleId?: string;
}

export function buildReminders(
  s: WalletState,
  prefs: Prefs,
  dismissed: string[],
  now: string,
): Reminder[] {
  const out: Reminder[] = [];
  const cardName = (id: string) => {
    const c = s.cards.find((x) => x.id === id);
    return c?.nickname || c?.name || "Card";
  };
  const when = (date: string) => `${shortDate(date, now)} (${relativeDays(date, now)})`;
  for (const o of s.offers.filter((o) => s.cards.some((c) => c.id === o.cardId && !c.archived))) {
    if (o.endDate < now) continue;
    if (o.requiresActivation && !o.activated && o.startDate <= now)
      out.push({
        id: `act-${o.id}`,
        kind: "activation",
        title: `Activate "${o.title}"`,
        detail: `${cardName(o.cardId)} · offer ends ${when(o.endDate)}`,
        offerId: o.id,
      });
    else if (o.endDate <= addDays(now, 7))
      out.push({
        id: `exp-${o.id}-${o.endDate}`,
        kind: "expiring",
        title: `"${o.title}" ends soon`,
        detail: `${cardName(o.cardId)} · ends ${when(o.endDate)}`,
        offerId: o.id,
      });
  }
  for (const r of s.rules.filter((r) => s.cards.some((c) => c.id === r.cardId && !c.archived))) {
    const cats = r.categories.join(" & ");
    const upcoming = !!r.startDate && r.startDate > now && r.startDate <= addDays(now, 30);
    const needsActivation =
      r.requiresActivation &&
      !r.activated &&
      (!r.endDate || r.endDate >= now) &&
      (!r.startDate || r.startDate <= addDays(now, 30));
    if (needsActivation)
      out.push({
        id: `ract-${r.id}`,
        kind: "activation",
        title: `Activate ${r.rate}% on ${cats}`,
        detail: `${cardName(r.cardId)}${upcoming ? ` · starts ${when(r.startDate!)}` : ""}`,
        ruleId: r.id,
      });
    // An activation reminder already says when the bonus starts.
    if (upcoming && !(needsActivation && prefs.activation))
      out.push({
        id: `chg-${r.id}`,
        kind: "categoryChanges",
        title: `Categories change ${shortDate(r.startDate!, now)}`,
        detail: `${cardName(r.cardId)} → ${r.rate}% on ${cats} · ${relativeDays(r.startDate!, now)}`,
        ruleId: r.id,
      });
  }
  for (const g of s.capGroups.filter((g) =>
    s.cards.some((c) => c.id === g.cardId && !c.archived),
  )) {
    if (g.opening?.used === null) continue;
    const used = capUsed(s, g, now);
    const reset = nextReset(now, g.period);
    if (used >= g.amount * 0.8)
      out.push({
        id: `cap-${g.id}-${reset}`,
        kind: "caps",
        title: `${g.label} cap ${used >= g.amount ? "reached" : "almost reached"}`,
        detail: `${cardName(g.cardId)} · ${money(g.amount - used)} left · resets ${shortDate(reset, now)}`,
      });
  }
  return out.filter((r) => prefs[r.kind] && !dismissed.includes(r.id));
}
