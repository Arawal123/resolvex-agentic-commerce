import { expect, test } from "@playwright/test";

test("guided judge journey reaches a verified decision", async ({ page }) => {
  await page.goto("/tickets/TKT-1042");
  await expect(page.getByRole("heading", { name: /Anniversary gift/ })).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.getByText("PRIORITY REPLACEMENT").first()).toBeVisible({ timeout: 20000 });
  await page.getByRole("link", { name: /Open Decision Studio/ }).click();
  await expect(page.getByRole("heading", { name: "A decision you can challenge." })).toBeVisible();
  await page.getByRole("button", { name: "Recompute decision" }).click();
  await expect(page.getByText("COUNTERFACTUAL")).toBeVisible();
});

test("optimizer produces a constraint-respecting batch plan", async ({ page }) => {
  await page.goto("/operations");
  await page.getByRole("button", { name: "Generate batch plan" }).click();
  await expect(page.getByText("OBJECTIVE SCORE")).toBeVisible();
  await page.getByRole("button", { name: "Confirm sandbox execution" }).click();
  await expect(page.getByRole("button", { name: /Batch queued/ })).toBeVisible();
});
