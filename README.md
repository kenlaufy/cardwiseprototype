# CardWise

Compare the cash-back cards you already own. CardWise estimates rewards for a purchase, explains the calculation, and optionally records the purchase to update cap and offer usage.

## Run locally

Use Bun 1.4.4 and a current Node 22+ runtime for Vite and Vitest.

```sh
bun install --frozen-lockfile
bun run dev
```

```sh
bun run check          # type check, lint, unit/integration tests, production build
bun audit              # dependency advisories
bun x playwright install chromium webkit
bun run test:e2e       # desktop Chromium and mobile WebKit journeys
```

The existing GitHub Actions workflow runs these checks. Browser traces contain fictional test fixtures and are retained only on failure. `bun run format` formats sources; formatting is not a release gate for Lovable-generated edits.

## Product boundaries

- Browser-local wallets, with separate demo and personal storage, validated backups, recovery copies, and export/import. There are no accounts or automatic bank feeds.
- USD retail purchases; percentage cash-back rules; calendar monthly, quarterly and annual spend caps; cumulative, per-purchase and one-use percentage offers. Unknown cap usage excludes that capped bonus.
- The beta picker offers Wells Fargo Active Cash and Chase Freedom Unlimited templates reviewed against linked issuer sources on October 29, 2026, plus generic starting templates. Other cards require manual setup. Legacy catalog cards are retained and flagged for review rather than silently trusted or deleted.
- Billing-cycle top-category rewards, fixed-dollar/minimum-spend offers, welcome bonuses, points valuations, foreign transaction fees, and independent refund transactions are outside the beta. Correct or remove the original record for a refund.
- Analyzer comparisons are independent alternatives against actual historical balances. They are not additive savings or a global optimum. New-card acquisition recommendations have been removed. Annual fee scenarios are explicitly experimental.
- Reminders are shown in the app when it is opened. They do not activate issuer offers or send background notifications.

## Calculation and data model

`src/lib/rewards.ts` provides a chronological ledger shared by recommendations and historical analysis. Spend and reward balances use integer cents; card reward segments round once per purchase, and each independent offer rounds separately. Cap crossings fall back to the next eligible rule. An exclusive offer competes with card bonuses and compatible stackable offers.

Rules and card settings are copied into immutable term versions when changed. Each recorded purchase references a version of the whole wallet. Editing an amount or date replays chronological usage while retaining that purchase's saved terms. New backdated records use the latest available terms effective on that date, or current terms if no earlier version exists. Imported legacy history is frozen against the rules available at migration; the app cannot reconstruct issuer history that was never recorded.

Opening balances include spending or offer rewards already used. `throughOrder` excludes records already covered by a corrected opening balance, including earlier same-day records. The order is stable through export, restore and purchase edits. Offer identity is stable when an end date is extended; renewal is a new offer.

`src/lib/persistence.ts` validates shapes, dates, amounts, IDs, card/cap relationships and historical references. The v2 envelope has a revision token. A stale tab cannot overwrite a newer saved wallet. A previous successful copy is retained. Legacy v1 data remains available until the user explicitly deletes that mode's data. Failed saves remain visible and exportable in memory; corrupted stored data is protected from overwrite.

The full wallet backup is unencrypted JSON. Production support must never ask users to post it publicly.

## Release and maintenance

Read [the release runbook](docs/RELEASE.md) before production publication and [the catalog maintenance guide](docs/CATALOG.md) before changing supported templates. The repository remains connected to Lovable: preserve published Git history and deploy only a reviewed, passing commit.

The public About and Data & privacy pages describe storage, limitations and support. Support uses this repository's issue tracker with fictional reproduction data. Hosting configuration, a custom domain, support ownership and an actual user pilot remain operational responsibilities of the repository maintainer.
