import { createContext } from "react";
import type { Ctx } from "./store";
// A stable module keeps context identity intact while the provider hot reloads.
export const StoreCtx = createContext<Ctx | null>(null);
