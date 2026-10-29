import type { Card } from "@/lib/rewards";

export const CARD_COLORS = ["emerald", "teal", "slate", "amber", "rose", "ink"] as const;
const TILE: Record<string, string> = {
  emerald: "tile-emerald", teal: "tile-teal", slate: "tile-slate", amber: "tile-amber", rose: "tile-rose", ink: "tile-ink",
};
export const tileClass = (c: string) => TILE[c] ?? "tile-teal";

export function CardTile({ card, small }: { card: Card; small?: boolean }) {
  return (
    <div className={`${tileClass(card.color)} relative overflow-hidden rounded-2xl text-tile-foreground shadow-soft ${small ? "h-10 w-16" : "aspect-[1.6] w-full p-4"}`} aria-hidden={small}>
      {!small && (
        <>
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-tile-foreground/10" />
          <p className="text-xs opacity-80">{card.issuer}</p>
          <p className="absolute bottom-4 left-4 font-display text-lg leading-tight">{card.nickname || card.name}</p>
          <p className="absolute bottom-4 right-4 text-xs opacity-80">{card.baseRate}% base</p>
        </>
      )}
    </div>
  );
}
