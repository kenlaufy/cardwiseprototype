import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function personalWallet(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start my own wallet", exact: true }).click();
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page.getByRole("button", { name: /Active Cash · Wells Fargo/ }).click();
  await page.getByRole("checkbox", { name: /I checked my account terms/ }).check();
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await page.getByRole("link", { name: "Best Card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Use Active Cash", exact: true })).toBeVisible();
}
async function dataSettings(page: Page) {
  await page.getByRole("link", { name: "Data & privacy", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Data & privacy", exact: true })).toBeVisible();
}
test("guided setup, single recording, refresh and archive preserve history", async ({ page }) => {
  await personalWallet(page);
  await page.getByLabel("Merchant (optional)", { exact: true }).fill("Fictional QA store");
  await page.getByRole("button", { name: "Record this purchase", exact: true }).dblclick();
  await expect(
    page.getByRole("button", { name: "Recorded this purchase", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.getByText("Fictional QA store", { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText("Fictional QA store", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My Wallet", exact: true }).click();
  await page.getByRole("button", { name: "Archive Active Cash", exact: true }).click();
  if ((page.viewportSize()?.width ?? 1000) < 768) {
    const toast = page
      .getByRole("listitem")
      .filter({ hasText: "Card archived — purchase history kept" });
    await expect(toast).toBeVisible();
    await expect
      .poll(async () => {
        const toastBox = await toast.boundingBox();
        const navBox = await page
          .getByRole("navigation", { name: "Main", exact: true })
          .boundingBox();
        return toastBox && navBox ? toastBox.y + toastBox.height - navBox.y : Infinity;
      })
      .toBeLessThanOrEqual(0);
  }
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.getByText("Fictional QA store", { exact: true })).toBeVisible();
});
test("backup export and restore recover the same recorded wallet", async ({ page }) => {
  await personalWallet(page);
  await page.getByRole("button", { name: "Record this purchase", exact: true }).click();
  await dataSettings(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export wallet backup", exact: true }).click();
  const download = await downloadPromise;
  const buffer = await readFile((await download.path())!);
  const backup = JSON.parse(buffer.toString());
  expect(backup.data.purchases).toHaveLength(1);
  await page.getByText("Delete this personal wallet", { exact: true }).click();
  await page.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
  await page
    .getByRole("button", { name: "Delete wallet and recovery copies", exact: true })
    .click();
  await page.getByRole("button", { name: "Start my wallet", exact: true }).click();
  await dataSettings(page);
  await page
    .getByLabel("CardWise backup file", { exact: true })
    .setInputFiles({ name: "qa-backup.json", mimeType: "application/json", buffer });
  await expect(page.getByText("1 card · 1 purchase · 0 offers", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I have backed up my current wallet/ }).check();
  await page.getByRole("button", { name: "Replace wallet with this backup", exact: true }).click();
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit purchase", exact: true })).toHaveCount(1);
});
test("unreadable stored data is protected and can be exported", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cardwise:mode", "local");
    localStorage.setItem("cardwise:local:v2", "{broken");
  });
  await page.goto("/");
  await expect(
    page.getByRole("alert").filter({ hasText: "Wallet data could not be opened safely" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cardwise:local:v2"))).toBe("{broken");
  await dataSettings(page);
  await page.getByText("Recovery options", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export stored copy", exact: true }).click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).toBe("{broken");
});
test("mobile recommendation is above the fixed navigation and does not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  const result = page.getByRole("region", { name: "Recommended card", exact: true });
  await expect(result).toBeVisible();
  const resultBox = await result.boundingBox();
  expect(resultBox!.y + resultBox!.height).toBeLessThan(780);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
