import { createFileRoute } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import {
  BellRing,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useStore, uid, type Prefs } from "@/lib/store";
import { buildReminders, type Reminder } from "@/lib/reminders";
import { money, type Card, type Offer } from "@/lib/rewards";
import { addDays, today } from "@/lib/demo";
import { isDate } from "@/lib/persistence";
import { daysBetween, relativeDays, shortDate } from "@/lib/dates";
import { CardTile } from "@/components/CardTile";
import { CategoryChips, Empty, Field, PageTitle, selectCls } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Offers & Reminders — CardWise" },
      {
        name: "description",
        content: "Track card offers, activation deadlines, and cap reminders.",
      },
      { property: "og:title", content: "Offers & Reminders — CardWise" },
      {
        property: "og:description",
        content: "Review activation deadlines and bonus caps when you open CardWise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OffersPage,
});

const PREF_LABELS: Record<keyof Prefs, string> = {
  activation: "Activation deadlines",
  expiring: "Offers about to end",
  caps: "Nearing a spending cap",
  categoryChanges: "Bonus categories changing",
};

const REMINDER_STYLE: Record<Reminder["kind"], { icon: LucideIcon; tone: string }> = {
  activation: { icon: Zap, tone: "bg-warning-soft" },
  expiring: { icon: Clock, tone: "bg-warning-soft" },
  caps: { icon: Gauge, tone: "bg-muted" },
  categoryChanges: { icon: CalendarClock, tone: "bg-muted" },
};

function OffersPage() {
  const { state, saveOffer, removeOffer, dismiss, setPrefs, setRuleActivated } = useStore();
  const [edit, setEdit] = useState<Offer | null>(null);
  const now = today();
  const reminders = buildReminders(state, state.prefs, state.dismissed, now);
  const visibleOffers = state.offers.filter((o) =>
    state.cards.some((c) => c.id === o.cardId && !c.archived),
  );
  const active = visibleOffers
    .filter((o) => o.startDate <= now && o.endDate >= now)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const upcoming = visibleOffers
    .filter((o) => o.startDate > now)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const expired = visibleOffers
    .filter((o) => o.endDate < now)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const cardOf = (id: string) => state.cards.find((c) => c.id === id);
  const isNew = (o: Offer) => !state.offers.some((x) => x.id === o.id);

  const newOffer = (): Offer => ({
    id: uid(),
    cardId: state.cards.find((c) => !c.archived)?.id ?? "",
    title: "",
    categories: [],
    rate: 5,
    startDate: now,
    endDate: addDays(now, 30),
    requiresActivation: true,
    activated: false,
    stackable: false,
    source: "manual",
  });

  // Long enough to reach the Undo button.
  const undoable = (onClick: () => void) => ({
    duration: 8000,
    action: { label: "Undo", onClick },
  });

  const setActivated = (o: Offer, activated: boolean) => {
    if (!saveOffer({ ...o, activated })) return;
    toast.success(
      activated
        ? `"${o.title}" now counts in recommendations`
        : `"${o.title}" marked as not activated`,
      undoable(() => saveOffer(o)),
    );
  };
  const remove = (o: Offer) => {
    if (!removeOffer(o.id)) return;
    toast.success(
      `Deleted "${o.title}"`,
      undoable(() => saveOffer(o)),
    );
  };
  const activateRule = (id: string) => {
    if (!setRuleActivated(id, true)) return;
    toast.success(
      "Bonus marked as activated",
      undoable(() => setRuleActivated(id, false)),
    );
  };

  const offerCard = (o: Offer) => (
    <OfferCard
      key={o.id}
      o={o}
      card={cardOf(o.cardId)}
      now={now}
      onEdit={() => setEdit(o)}
      onDelete={() => remove(o)}
      onActivated={(v) => setActivated(o, v)}
    />
  );

  return (
    <div className="space-y-8">
      <PageTitle
        title="Offers"
        sub="Manually entered percentage offers. Confirm activation and any reward already used."
        action={
          <Button
            disabled={!state.cards.some((c) => !c.archived)}
            onClick={() => setEdit(newOffer())}
          >
            <Plus className="h-4 w-4" /> Add offer
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">
        Reminders appear here when you open CardWise. No background notifications or issuer
        activation are performed.
      </p>
      <section className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <BellRing className="h-4 w-4" /> In-app reminders
          </h2>
          {reminders.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {reminders.length} to review
            </span>
          )}
        </div>
        {reminders.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-accent" /> You're all caught up.
          </p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => {
              const offer = r.offerId ? state.offers.find((o) => o.id === r.offerId) : undefined;
              return (
                <ReminderRow
                  key={r.id}
                  r={r}
                  activationUrl={offer?.activationUrl}
                  onActivate={
                    r.kind !== "activation"
                      ? undefined
                      : offer
                        ? () => setActivated(offer, true)
                        : r.ruleId
                          ? () => activateRule(r.ruleId!)
                          : undefined
                  }
                  onDismiss={() => dismiss(r.id)}
                />
              );
            })}
          </ul>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Reminder settings</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Reminders show up here in the app. CardWise doesn't send emails or notifications.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(PREF_LABELS) as (keyof Prefs)[]).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <Switch
                  checked={state.prefs[k]}
                  onCheckedChange={(v) => setPrefs({ ...state.prefs, [k]: v })}
                />{" "}
                {PREF_LABELS[k]}
              </label>
            ))}
          </div>
        </details>
      </section>

      {state.offers.length === 0 ? (
        <Empty
          title="No offers yet"
          body={
            state.cards.length
              ? "Found a deal in your card issuer's app, like 10% back at a store? Add it here and CardWise will factor it into recommendations."
              : "Add a card in My Wallet first, then add offers from your card issuer's app."
          }
          action={
            state.cards.length ? (
              <Button onClick={() => setEdit(newOffer())}>
                <Plus className="h-4 w-4" /> Add an offer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <OfferSection title="Active now" count={active.length}>
            {active.length ? (
              active.map(offerCard)
            ) : (
              <p className="text-sm text-muted-foreground">No offers are running right now.</p>
            )}
          </OfferSection>
          {upcoming.length > 0 && (
            <OfferSection title="Coming soon" count={upcoming.length}>
              {upcoming.map(offerCard)}
            </OfferSection>
          )}
          {expired.length > 0 && (
            <details className="group space-y-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-display text-xl [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 transition group-open:rotate-90" /> Expired
                <span className="font-sans text-sm text-muted-foreground">({expired.length})</span>
              </summary>
              <div className="mt-2 space-y-2">{expired.map(offerCard)}</div>
            </details>
          )}
        </>
      )}

      {edit && (
        <OfferForm
          o={edit}
          isNew={isNew(edit)}
          onClose={() => setEdit(null)}
          onSave={(o) => {
            const added = isNew(o);
            if (!saveOffer(o)) return;
            setEdit(null);
            toast.success(added ? `Added "${o.title}"` : "Offer updated");
          }}
        />
      )}
    </div>
  );
}

function OfferSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl">
        {title} <span className="font-sans text-sm text-muted-foreground">({count})</span>
      </h2>
      {children}
    </section>
  );
}

function ReminderRow({
  r,
  activationUrl,
  onActivate,
  onDismiss,
}: {
  r: Reminder;
  activationUrl?: string | undefined;
  onActivate?: (() => void) | undefined;
  onDismiss: () => void;
}) {
  const { icon: Icon, tone } = REMINDER_STYLE[r.kind];
  return (
    <li className={`rounded-xl p-3 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{r.title}</p>
          <p className="text-xs text-muted-foreground">{r.detail}</p>
        </div>
        <button
          aria-label={`Dismiss reminder: ${r.title}`}
          className="rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {onActivate && (
        <div className="mt-2 flex flex-wrap gap-2 pl-7">
          {activationUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={activationUrl} target="_blank" rel="noreferrer">
                Activate on issuer site <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onActivate}>
            <Check className="h-3.5 w-3.5" /> I've activated it
          </Button>
        </div>
      )}
    </li>
  );
}

function OfferCard({
  o,
  card,
  now,
  onEdit,
  onDelete,
  onActivated,
}: {
  o: Offer;
  card: Card | undefined;
  now: string;
  onEdit: () => void;
  onDelete: () => void;
  onActivated: (v: boolean) => void;
}) {
  const expired = o.endDate < now;
  const upcoming = o.startDate > now;
  const daysLeft = daysBetween(now, o.endDate);
  const when = expired
    ? { label: "Ended", value: shortDate(o.endDate, now), urgent: false }
    : upcoming
      ? {
          label: "Starts",
          value: `${shortDate(o.startDate, now)} (${relativeDays(o.startDate, now)})`,
          urgent: false,
        }
      : {
          label: "Ends",
          value: `${shortDate(o.endDate, now)} (${relativeDays(o.endDate, now)})`,
          urgent: daysLeft <= 7,
        };

  return (
    <article
      className={`rounded-2xl border border-border bg-card p-4 ${expired ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        {card && <CardTile card={card} small />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{o.title}</p>
          <p className="text-xs text-muted-foreground">
            {card?.nickname || card?.name || "Card"}
            {o.source === "demo" && " · demo data"}
          </p>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0">
          <Button size="icon" variant="ghost" aria-label={`Edit ${o.title}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Delete ${o.title}`} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">You get</dt>
          <dd>
            {o.rate}% extra{o.maxReward != null && `, up to ${money(o.maxReward)}`}
            <span className="block text-xs text-muted-foreground">
              {o.limitScope === "purchase"
                ? "Limit per purchase"
                : o.limitScope === "once"
                  ? "One qualifying purchase"
                  : "Limit across the entire offer"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">On</dt>
          <dd>
            {o.categories.length ? (
              <span className="capitalize">{o.categories.join(", ")}</span>
            ) : (
              "Any purchase"
            )}
            {o.merchants?.length ? ` at ${o.merchants.join(", ")}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{when.label}</dt>
          <dd>
            <span
              className={when.urgent ? "rounded-full bg-warning-soft px-2 py-0.5 font-medium" : ""}
            >
              {when.value}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {o.stackable
          ? "Adds to card rewards and other compatible stackable offers."
          : "Exclusive: base rate plus this offer, when better than bonuses and other offers."}
      </p>

      {!expired &&
        (o.requiresActivation && !o.activated ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-warning-soft p-2.5">
            <p className="min-w-40 flex-1 text-sm">
              Not activated yet, so it isn't counted in recommendations.
            </p>
            {o.activationUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={o.activationUrl} target="_blank" rel="noreferrer">
                  Activate on issuer site <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => onActivated(true)}>
              <Check className="h-3.5 w-3.5" /> I've activated it
            </Button>
          </div>
        ) : (
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm">
            <Check className="h-4 w-4 text-accent" />
            {o.requiresActivation ? "Activated" : "No activation needed"} ·{" "}
            {upcoming
              ? `counts from ${shortDate(o.startDate, now)}`
              : "included in recommendations"}
            {o.requiresActivation && (
              <button
                className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => onActivated(false)}
              >
                Undo
              </button>
            )}
          </p>
        ))}
    </article>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function OfferForm({
  o,
  isNew,
  onClose,
  onSave,
}: {
  o: Offer;
  isNew: boolean;
  onClose: () => void;
  onSave: (o: Offer) => void;
}) {
  const { state } = useStore();
  const [d, setD] = useState(o);
  const [err, setErr] = useState<string | null>(null);
  const id = useId();
  const set = (p: Partial<Offer>) => setD({ ...d, ...p });

  const submit = () => {
    if (!d.title.trim()) return setErr("Give the offer a name");
    if (!(d.rate > 0 && d.rate <= 100)) return setErr("Cash back must be between 0% and 100%");
    if (d.maxReward != null && !(d.maxReward > 0))
      return setErr("Max cash back must be more than $0, or left empty for no limit");
    if (!isDate(d.startDate) || !isDate(d.endDate))
      return setErr("Pick when the offer starts and ends");
    if (d.endDate < d.startDate) return setErr("The offer ends before it starts");
    if (d.requiresActivation && d.activationUrl && !/^https:\/\//.test(d.activationUrl))
      return setErr("The activation link must start with https://");
    if (
      d.opening &&
      (!Number.isFinite(d.opening.used) ||
        d.opening.used < 0 ||
        (d.maxReward != null && d.opening.used > d.maxReward))
    )
      return setErr("Used reward must be between $0 and the offer limit");
    onSave({
      ...d,
      title: d.title.trim(),
      activationUrl: d.requiresActivation ? d.activationUrl : undefined,
    });
  };

  const example = d.rate > 0 ? Math.min(d.rate, d.maxReward ?? Infinity) : 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add an offer" : "Edit offer"}</DialogTitle>
          <DialogDescription>
            Copy a percentage offer from your issuer. Fixed-dollar, minimum-spend and billing-cycle
            offers are not supported in this beta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Offer name" htmlFor={`${id}-title`}>
            <Input
              id={`${id}-title`}
              value={d.title}
              maxLength={60}
              placeholder="e.g. 10% back at Starbucks"
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field label="Card" htmlFor={`${id}-card`}>
            <select
              id={`${id}-card`}
              className={selectCls}
              value={d.cardId}
              onChange={(e) => set({ cardId: e.target.value })}
            >
              {state.cards
                .filter((c) => !c.archived || c.id === d.cardId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname || c.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cash back %" htmlFor={`${id}-rate`}>
              <Input
                id={`${id}-rate`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={d.rate}
                onChange={(e) => set({ rate: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max cash back (optional)" htmlFor={`${id}-max`}>
              <Input
                id={`${id}-max`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="No limit"
                value={d.maxReward ?? ""}
                onChange={(e) =>
                  set({ maxReward: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </Field>
            <Field label="Starts" htmlFor={`${id}-start`}>
              <Input
                id={`${id}-start`}
                type="date"
                value={d.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
              />
            </Field>
            <Field label="Ends" htmlFor={`${id}-end`}>
              <Input
                id={`${id}-end`}
                type="date"
                value={d.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Reward limit applies">
            <select
              className={selectCls}
              value={d.limitScope ?? "offer"}
              onChange={(e) => set({ limitScope: e.target.value as Offer["limitScope"] })}
            >
              <option value="offer">Across the entire offer</option>
              <option value="purchase">Separately for each purchase</option>
              <option value="once">One qualifying purchase only</option>
            </select>
          </Field>
          {d.limitScope !== "purchase" && (
            <Field label="Offer reward already used ($)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={d.opening?.used ?? 0}
                onChange={(e) =>
                  set({
                    opening: {
                      date: today(),
                      used: Number(e.target.value),
                      throughOrder:
                        Math.max(-1, ...state.purchases.map((p, i) => p.order ?? i)) + 1,
                    },
                  })
                }
              />
            </Field>
          )}
          <Field label="Applies to">
            <p className="text-xs text-muted-foreground">
              Pick the categories it covers, or leave them all off for any purchase.
            </p>
            <CategoryChips multi value={d.categories} onChange={(v) => set({ categories: v })} />
          </Field>
          <Field label="Only at these stores (optional)" htmlFor={`${id}-merchants`}>
            <Input
              id={`${id}-merchants`}
              placeholder="e.g. Starbucks, Peet's"
              value={d.merchants?.join(", ") ?? ""}
              onChange={(e) =>
                set({
                  merchants: e.target.value
                    ? e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : undefined,
                })
              }
            />
          </Field>
          <div className="space-y-3 rounded-xl border border-border p-3">
            <ToggleRow
              id={`${id}-activation`}
              label="Needs activation"
              hint="You have to turn it on in your card's app or website before it pays out."
              checked={d.requiresActivation}
              onChange={(v) => set({ requiresActivation: v })}
            />
            {d.requiresActivation && (
              <Field label="Activation link (optional)" htmlFor={`${id}-url`}>
                <Input
                  id={`${id}-url`}
                  type="url"
                  placeholder="https://"
                  value={d.activationUrl ?? ""}
                  onChange={(e) => set({ activationUrl: e.target.value || undefined })}
                />
              </Field>
            )}
            <ToggleRow
              id={`${id}-stack`}
              label="Stacks with card bonuses"
              hint="On: combines with card bonuses and other compatible stackable offers. Off: is exclusive of bonuses and other offers. Confirm your issuer permits stacking."
              checked={d.stackable}
              onChange={(v) => set({ stackable: v })}
            />
          </div>
          {example > 0 && (
            <p className="rounded-xl bg-muted p-3 text-sm">
              On a $100 purchase, this offer adds <b>{money(example)}</b>.
            </p>
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
            <Button onClick={submit}>{isNew ? "Add offer" : "Save changes"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
