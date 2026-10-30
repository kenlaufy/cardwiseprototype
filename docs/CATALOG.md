# Catalog maintenance

Owner: the repository maintainer. Review supported sources at least each quarter and whenever an issuer reports a terms change. Dependabot handles software updates; it does not maintain card terms.

## Supported beta templates

Reviewed October 29, 2026:

| Template                | Source                                                                                                                                                                                  | Modeled rewards                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Wells Fargo Active Cash | [Issuer product and rewards terms](https://creditcards.wellsfargo.com/active-cash-credit-card/)                                                                                         | 2% on eligible retail purchases                                                                            |
| Chase Freedom Unlimited | [Issuer product page](https://www.chase.com/personal/credit-cards/freedom/unlimited), [rewards agreement](https://asset.chase.com/content/dam/card/rulesregulations/en/RPA0509_Web.pdf) | 1.5% base, 3% dining/drugstores, 5% travel through Chase Travel at a cash redemption value of 1¢ per point |

The rules do not cover fees, cash equivalents, interest, welcome bonuses, or foreign transaction costs. Users must confirm their own account terms. Issuer coding remains authoritative. A portal merchant is required for portal travel rewards; travel outside the portal falls back to other eligible rates.

## Updating a template

1. Read primary issuer reward terms and eligibility restrictions. Record URLs, the date, and material exclusions. Do not mark a product supported based on a review site or an unsourced summary.
2. Check that the model can express all conditions that materially affect the quoted rate. Billing-cycle caps, highest-spend category rules, membership prerequisites, product-specific travel eligibility, and fixed-dollar/minimum-spend offers need model support before promotion into the supported picker.
3. Update `CATALOG_CHECKED`, the template's rules, summary, source list and notes. Expand the supported source map only for products actually checked. Add rate, exclusion, channel, cap, activation and boundary fixtures as applicable.
4. Existing saved cards retain their own version and caveats. This beta never silently replaces a wallet's custom edits with a publisher update. A user reviews the issuer source and edits or replaces the saved setup explicitly. Newly recorded purchases use the resulting new terms version; older records retain theirs.
5. Keep unsupported legacy templates out of the picker. Migrated legacy catalog cards request review. If a user elects to keep a manually adjusted approximation, it is labeled as a manual estimate rather than a supported issuer template.

Setup confirmation expires after 90 days. The recommendation page excludes cards needing confirmation and links to My Wallet. The issuer-source check date and the user's account-confirmation date are separate facts; editing a card must not claim that a new issuer review occurred.
