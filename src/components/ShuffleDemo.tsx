import { Shuffle } from "lucide-react";
import { useShuffleDemo } from "@/hooks/use-shuffle-demo";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";

export function ShuffleDemoBanner() {
  const { mode, state } = useStore();
  const shuffle = useShuffleDemo();
  if (mode !== "demo") return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft p-3 text-sm">
      <p>
        {state.demoPersona ? (
          <>
            Demo spending as <b>{state.demoPersona}</b>.
          </>
        ) : (
          <b>Demo spending.</b>
        )}{" "}
        Shuffle to see how different habits change your rewards.
      </p>
      <Button size="sm" variant="outline" onClick={shuffle}>
        <Shuffle className="h-3.5 w-3.5" /> Shuffle spending
      </Button>
    </div>
  );
}
