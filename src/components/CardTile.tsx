import type { Card } from "@/lib/rewards";

export const CARD_COLORS = ["emerald", "teal", "slate", "amber", "rose", "ink"] as const;
const TILE: Record<string, string> = {
  emerald: "tile-emerald",
  teal: "tile-teal",
  slate: "tile-slate",
  amber: "tile-amber",
  rose: "tile-rose",
  ink: "tile-ink",
};
export const tileClass = (c: string) => TILE[c] ?? "tile-teal";

export function CardTile({ card, small }: { card: Card; small?: boolean }) {
  return (
    <div
      className={`${tileClass(card.color)} relative overflow-hidden rounded-2xl text-tile-foreground shadow-soft ${small ? "h-10 w-16" : "aspect-[1.6] w-full p-4 flex flex-col justify-between"}`}
      aria-hidden={small}
    >
      {!small && (
        <>
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-tile-foreground/10" />
          <p className="relative truncate text-xs opacity-80">{card.issuer}</p>
          <div className="relative flex items-end justify-between gap-2">
            <p className="min-w-0 truncate font-display text-lg leading-tight">
              {card.nickname || card.name}
            </p>
            <p className="shrink-0 text-xs opacity-80">{card.baseRate}% base</p>
          </div>
        </>
      )}
    </div>
  );
}
