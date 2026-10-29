import { toast } from "sonner";
import { useStore } from "@/lib/store";

/** Swaps the demo's purchase history for six random months from a new spending persona. */
export function useShuffleDemo() {
  const { shuffleDemo } = useStore();
  return () => {
    const p = shuffleDemo();
    toast.success(`Now playing as ${p.label}`, {
      description: `${p.blurb}. Six months of new purchases on the demo cards.`,
    });
  };
}
