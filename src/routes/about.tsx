import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle } from "@/components/Field";
export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About, privacy & support — CardWise" }] }),
  component: About,
});
function About() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="About CardWise"
        sub="A simple way to compare the cash-back cards you already own."
      />
      <section className="space-y-3 rounded-3xl bg-card p-5">
        <h2 className="font-display text-xl">What the beta supports</h2>
        <p>
          U.S. dollar retail purchases, percentage cash-back rules, calendar spending caps and
          percentage offers. You enter purchases and current cap usage yourself. Recommendations are
          estimates; the issuer determines eligible spending and merchant coding.
        </p>
        <p className="text-sm text-muted-foreground">
          Billing-cycle top-category rewards, points valuations, welcome bonuses, foreign
          transaction fees, minimum-spend offers and automatic bank feeds are outside this beta. For
          a refund, correct or remove the original recorded purchase; separate negative refund
          records are not supported. In-app reminders appear when you open CardWise; they are not
          background notifications.
        </p>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-5">
        <h2 className="font-display text-xl">Your wallet and privacy</h2>
        <p>
          CardWise stores your cards, purchases, offers and settings in this browser’s local
          storage. It keeps demo and personal wallets in separate records. It does not request card
          numbers, CVVs, bank passwords or Social Security numbers.
        </p>
        <p>
          Wallet records are not sent to a CardWise server or analytics service. Backups are files
          created on your device and are not encrypted. Anyone with access to this browser profile
          or a downloaded backup may be able to read those records.
        </p>
        <p>
          Hosting providers may process page requests and technical service logs. Google Fonts
          receives requests when typefaces load. Following an issuer or support link opens that
          provider’s site under its own privacy practices.
        </p>
        <p>
          Clearing browser data can remove your wallet. Changing device, browser or website domain
          requires exporting and restoring a backup.
        </p>
        <Link to="/settings" className="underline">
          Manage, export or delete wallet data
        </Link>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-5">
        <h2 className="font-display text-xl">Understand an estimate</h2>
        <p>
          Confirm your card’s terms, activation and current cap usage during setup. Unknown cap
          usage excludes that capped bonus. Past recorded purchases retain their saved rule version;
          changing today’s settings does not rewrite those terms.
        </p>
        <p>
          Analyzer opportunities compare each purchase independently using actual balances at that
          point. These opportunities cannot be added together as guaranteed savings: switching an
          earlier purchase may affect later caps and offers. No recommendation guarantees a reward,
          credit approval or a financial outcome.
        </p>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-5">
        <h2 className="font-display text-xl">Support and corrections</h2>
        <p>
          Report a calculation or catalog problem with fictional example amounts and the steps to
          reproduce it. Do not include your wallet backup, card details or personal purchase history
          in a public report.
        </p>
        <a
          className="underline"
          href="https://github.com/kenlaufy/cardwiseprototype/issues/new"
          target="_blank"
          rel="noreferrer"
        >
          Report an issue on GitHub
        </a>
      </section>
    </div>
  );
}
