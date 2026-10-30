# Release and recovery runbook

## Before publication

The repository maintainer owns release approval, hosting access, support triage and rollback. A code change does not establish a production support or monitoring service.

1. Merge a reviewed PR only after type checking, lint, unit tests, advisory audit, desktop Chromium and mobile WebKit checks, and the production build pass. Use `bun install --frozen-lockfile` to reproduce the release.
2. Preview the exact commit in Lovable. Exercise a fictional personal wallet: add two cards, check merchant assumptions, record once, refresh, edit a purchase, archive/restore a card, export/restore, and inspect the analyzer. Check keyboard focus, a screen reader, narrow mobile widths, and large text. Automated browser coverage complements this manual check.
3. Test migration with a COPY of a v1 fixture. Verify original data remains, purchase earnings stay stable, and old unsupported catalog cards request review. Test denied/full storage: the app must show unsaved status and allow export. Never use real customer backups in public CI.
4. Confirm that the issue tracker is reachable by the intended audience, identify who responds, and publish a private support channel before collecting private reports. The public app currently offers GitHub issues and asks for fictional reproduction data only. Do not invent a support mailbox.
5. Enable production uptime and error-rate monitoring in the hosting account, with a named recipient. Check `/` and `/about` and alert on sustained failures or elevated server errors. Verify alerts with a staged failure. The app forwards only fixed render-failure labels and allowlisted route names through the hosting telemetry hook; no wallet contents or raw client exception values are forwarded by that hook.
6. Record the previous production commit/version and how to republish it through Lovable. Publish the reviewed commit, then verify the welcome, personal and demo entry points and a save/reload round trip on the production URL.

The current production URL is `https://cardwiseprototype.lovable.app/`. A custom domain is optional. Browser storage belongs to an origin: before a domain change, tell existing users to export a backup from the old origin and restore it on the new one. Keep the old origin available during the transition. There is no automatic cross-domain migration.

Lovable may inject its own editor badge or platform metadata outside repository sources. Remove remaining hosted branding through the authorized hosting settings if desired, and verify the published page. Do not remove build integration plugins simply to hide hosting UI.

## Failed save or unreadable data

- For an unsaved change, keep the tab open. Export the in-memory wallet before reloading or changing browsers. Check browser capacity/privacy restrictions, then retry saving.
- If a second tab changed the wallet, export any unsaved local work and reload the saved copy. Do not force an automatic merge of purchase histories.
- If stored data is unreadable, it is left untouched. In Data & privacy → Recovery options, export the stored copy. Restore a validated backup or the previous successful save only after preserving the current copy.
- Recovery JSON may contain sensitive purchase details. Keep it private. A malformed record should be investigated locally; the parser rejects invalid references and values rather than silently discarding transactions.
- Restoring replaces the current mode's wallet after an explicit preview and acknowledgement. Deletion requires typing DELETE and removes that mode's current, recovery and legacy keys. Other modes and downloaded backups are unaffected.

## Rollback

1. Stop releasing the failing feature and preserve the last working production version.
2. Republish the previous known-good hosting version without force-pushing Git history.
3. If a migration has affected storage, protect and export both current and legacy copies. Do not roll users back to a client that writes an incompatible schema over newer data. Prefer a forward repair that understands both versions.
4. Record the incident using fictional reproduction data, add a regression test, and verify the fix on staging before another production release.

## Pilot acceptance

Run a 10–20 person pilot after the engineering gates pass. Recruit owners of supported cards. Ask five fresh users to reach a useful comparison within two minutes without help. Measure setup completion, time to the first recommendation, repeat use, correction frequency and whether manual tracking remains practical.

These are proposed validation targets, not results already achieved. Use opt-in research or aggregate counts; there is no product analytics integration in this repository. Never add merchant names, purchase amounts, card nicknames, backups or arbitrary errors to analytics payloads. Review observed usefulness and ongoing terms-maintenance cost before pricing or broadening scope.
