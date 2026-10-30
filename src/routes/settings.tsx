import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { parseBackup, type Persisted } from "@/lib/persistence";
import { downloadText } from "@/lib/download";
import { today } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PageTitle } from "@/components/Field";
export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Data & privacy — CardWise" }] }),
  component: Settings,
});
function Settings() {
  const store = useStore(),
    [preview, setPreview] = useState<Persisted | null>(null),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false),
    [deletion, setDeletion] = useState("");
  const attempt = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch {
      setError(
        "That file could not be opened. Choose a valid CardWise backup. Your existing wallet has not been replaced.",
      );
    }
  };
  if (!store.mode)
    return (
      <div className="space-y-4">
        <PageTitle title="Data & privacy" />
        <p>Start your wallet to manage saved data. Everything you enter stays in this browser.</p>
        <Button onClick={() => store.start("local")}>Start my wallet</Button>
        <p>
          <Link to="/about" className="underline">
            Read about privacy and estimates
          </Link>
        </p>
      </div>
    );
  return (
    <div className="space-y-6">
      <PageTitle
        title="Data & privacy"
        sub="Your wallet is saved in this browser. Keep a backup you can restore on another device."
      />
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="font-display text-xl">Save a backup</h2>
        <p className="text-sm text-muted-foreground">
          Includes card names, purchases, offers, settings and the rules used for past estimates.
          The file is not encrypted. Store it somewhere private.
        </p>
        <p role="status" className="text-sm">
          {store.unsaved
            ? "There are changes that have not been saved to this browser."
            : "Wallet saved on this device."}
        </p>
        {store.recoveryRequired && (
          <p role="alert" className="text-sm">
            Stored wallet data is protected. Use Export stored copy in Recovery options to keep the
            original file.
          </p>
        )}
        <Button
          disabled={store.recoveryRequired}
          onClick={() =>
            attempt(() => downloadText(`cardwise-${store.mode}-${today()}.json`, store.backup()))
          }
        >
          Export wallet backup
        </Button>
      </section>
      {store.mode === "local" && (
        <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="font-display text-xl">Restore a backup</h2>
          <p className="text-sm text-muted-foreground">
            The file is read on this device. Nothing is uploaded. Restoring replaces this browser’s
            personal wallet.
          </p>
          <Field label="CardWise backup file">
            <Input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                setPreview(null);
                setAck(false);
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 15_000_000) {
                  setError("Choose a backup smaller than 15 MB.");
                  return;
                }
                try {
                  setPreview(parseBackup(await file.text()));
                  setError("");
                } catch {
                  setError("This is not a valid CardWise backup. Your wallet has not changed.");
                }
              }}
            />
          </Field>
          {preview && (
            <div className="space-y-3 rounded-xl bg-muted p-4">
              <p>
                {preview.cards.length} {preview.cards.length === 1 ? "card" : "cards"} ·{" "}
                {preview.purchases.length}{" "}
                {preview.purchases.length === 1 ? "purchase" : "purchases"} ·{" "}
                {preview.offers.length} {preview.offers.length === 1 ? "offer" : "offers"}
              </p>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I
                have backed up my current wallet, or I do not need to keep it.
              </label>
              <Button
                disabled={!ack}
                onClick={() => {
                  if (store.restore(preview)) {
                    setPreview(null);
                    setAck(false);
                    toast.success("Backup restored on this device");
                  }
                }}
              >
                Replace wallet with this backup
              </Button>
            </div>
          )}
          <details className="space-y-3 text-sm">
            <summary className="cursor-pointer font-medium">Recovery options</summary>
            <p className="text-muted-foreground">
              A previous successful save may be available. Export the current stored copy before
              restoring it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  attempt(() => {
                    const raw = store.storedCopy();
                    if (!raw) throw new Error("No stored copy");
                    downloadText(`cardwise-recovery-${today()}.json`, raw);
                  })
                }
              >
                Export stored copy
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      "Replace this wallet with its previous saved copy? Export your current wallet first if you need it.",
                    )
                  ) {
                    if (store.restorePrevious()) toast.success("Previous saved wallet restored");
                  }
                }}
              >
                Restore previous save
              </Button>
            </div>
          </details>
        </section>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm">
          {error}
        </p>
      )}
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="font-display text-xl">How your data is used</h2>
        <p className="text-sm text-muted-foreground">
          CardWise does not connect to your bank or send your wallet to an analytics service.
          Clearing site data, using a different browser, or moving to another domain will not
          transfer your wallet. Use a backup to move it.
        </p>
        <Link to="/about" className="text-sm underline">
          Privacy, supported features & support
        </Link>
      </section>
      <details className="rounded-3xl border border-destructive/30 p-5">
        <summary className="cursor-pointer font-medium">
          Delete this {store.mode === "demo" ? "demo" : "personal"} wallet
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm">
            This permanently deletes this mode’s wallet, legacy copy and recovery copy from this
            browser. Other browsers and downloaded backups are unaffected. Export first if you want
            to keep it.
          </p>
          <Field label="Type DELETE to confirm">
            <Input
              value={deletion}
              onChange={(e) => setDeletion(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Button
            variant="destructive"
            disabled={deletion !== "DELETE"}
            onClick={() => {
              if (store.clearWallet()) toast.success("Wallet deleted from this browser");
            }}
          >
            Delete wallet and recovery copies
          </Button>
        </div>
      </details>
    </div>
  );
}
