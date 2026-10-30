import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore, type Ctx } from "./store";
import { earnedByPurchase } from "./analysis";
import { storageKey } from "./persistence";
let store: Ctx;
function Harness() {
  store = useStore();
  return <p>{store.ready ? "ready" : "loading"}</p>;
}
beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);
async function mounted() {
  render(
    <StoreProvider>
      <Harness />
    </StoreProvider>,
  );
  await waitFor(() => expect(store.ready).toBe(true));
  act(() => store.start("demo"));
}
describe("wallet actions", () => {
  it("archives and restores a card without removing purchases or changing earnings", async () => {
    await mounted();
    const card = store.state.cards[0]!,
      ids = store.state.purchases.map((p) => p.id),
      earnings = earnedByPurchase(store.state);
    act(() => {
      expect(store.removeCard(card.id)).toBe(true);
    });
    expect(store.state.cards.find((c) => c.id === card.id)?.archived).toBe(true);
    expect(store.state.purchases.map((p) => p.id)).toEqual(ids);
    expect(earnedByPurchase(store.state)).toEqual(earnings);
    act(() => {
      store.updateCard({ ...card, archived: false });
    });
    expect(store.state.cards.find((c) => c.id === card.id)?.archived).toBe(false);
  });
  it("changes future rates while keeping historical versions until explicitly corrected", async () => {
    await mounted();
    const card = store.state.cards.find((c) => c.id === "flat")!;
    act(() => {
      store.savePurchase({
        id: "qa",
        cardId: card.id,
        amount: 100,
        date: "2026-10-29",
        category: "other",
        channel: "in-store",
      });
    });
    expect(earnedByPurchase(store.state).get("qa")).toBe(2);
    act(() => {
      store.updateCard({ ...card, baseRate: 3 });
    });
    expect(earnedByPurchase(store.state).get("qa")).toBe(2);
    act(() => {
      store.savePurchase(
        store.state.purchases.find((p) => p.id === "qa")!,
        true,
      );
    });
    expect(earnedByPurchase(store.state).get("qa")).toBe(3);
  });
  it("leaves invalid mutations unapplied and never reports a successful save", async () => {
    await mounted();
    const count = store.state.purchases.length;
    act(() => {
      expect(
        store.savePurchase({
          id: "bad",
          cardId: "flat",
          amount: Infinity,
          date: "2026-10-29",
          category: "other",
          channel: "in-store",
        }),
      ).toBe(false);
    });
    expect(store.state.purchases).toHaveLength(count);
    expect(store.storageError).toMatch(/invalid values/);
  });
  it("keeps mode switches separate and persists a record exactly once by its ID", async () => {
    await mounted();
    const p = {
      id: "qa",
      cardId: "flat",
      amount: 100,
      date: "2026-10-29",
      category: "other" as const,
      channel: "in-store" as const,
    };
    act(() => {
      store.savePurchase(p);
      store.savePurchase(p);
    });
    expect(store.state.purchases.filter((x) => x.id === "qa")).toHaveLength(1);
    act(() => store.start("local"));
    expect(store.state.cards).toHaveLength(0);
    expect(localStorage.getItem(storageKey("demo"))).not.toBeNull();
    act(() => store.start("demo"));
    expect(store.state.purchases.filter((x) => x.id === "qa")).toHaveLength(1);
  });
});
