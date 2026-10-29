import { useStore } from "@/lib/store";
import { Button } from "./ui/button";

export function Welcome() {
  const { start } = useStore();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 aspect-[1.6] w-64 rotate-[-6deg] rounded-2xl tile-emerald p-5 text-left text-tile-foreground shadow-lift">
          <p className="text-xs opacity-80">Use this one</p>
          <p className="mt-8 font-display text-2xl">Everyday Rewards</p>
          <p className="text-sm opacity-90">5% on groceries</p>
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Which card should I use?</h1>
        <p className="mt-3 text-muted-foreground">CardWise picks the card that earns the most cash back for each purchase — in seconds.</p>
        <div className="mt-8 grid gap-3">
          <Button size="lg" className="h-12 rounded-xl" onClick={() => start("demo")}>Try demo</Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl" onClick={() => start("local")}>Start my own wallet</Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">We never ask for card numbers, CVVs, bank passwords, or SSNs. Demo data is fictional and kept separate.</p>
      </div>
    </div>
  );
}
