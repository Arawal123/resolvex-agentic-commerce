import { expect, test } from "@playwright/test";

test("guided judge journey reaches a verified decision", async ({ page }) => {
  await page.goto("/tickets/TKT-1042");
  await expect(page.getByRole("heading", { name: /Anniversary gift/ })).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.getByText("PRIORITY REPLACEMENT").first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("link", { name: /Open Decision Studio/ })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("strong").filter({ hasText: "Line-haul hub dwell breach" }).first()
  ).toBeVisible();
  await expect(page.getByText("SUPPLY SIDE")).toBeVisible();
  await expect(page.getByText("CUSTOMER SIDE")).toBeVisible();
  await page.getByRole("link", { name: /Open Decision Studio/ }).click();
  await expect(page.getByRole("heading", { name: "A decision you can challenge." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find and correct the failure" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose the safest useful remedy" })
  ).toBeVisible();
  await expect(page.getByText("ROOT-CAUSE PROBABILITIES")).toBeVisible();
  await expect(page.getByText("REMEDY SELECTION PROBABILITIES")).toBeVisible();
  await page.getByText("Inspect evidence, interventions, and receipts").click();
  await page.getByRole("button", { name: "Test intervention" }).click();
  await expect(page.getByText("Decision boundary crossed")).toBeVisible();
  await page.getByRole("button", { name: "Recompute decision" }).click();
  await expect(page.getByText("COUNTERFACTUAL", { exact: true })).toBeVisible();
});

test("duplicate charge separates payment failure from approval-bound customer remedy", async ({
  page,
}) => {
  await page.goto("/tickets/TKT-1038");
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(
    page.getByRole("strong").filter({ hasText: "Payment idempotency failure" }).first()
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "PAYMENT IDEMPOTENCY RECONCILIATION" })
  ).toBeVisible();
  await expect(page.getByText("pending approval")).toBeVisible();
  await expect(
    page.getByText(
      "No consequential write occurs until an attributed reviewer approves the remedy."
    )
  ).toBeVisible();
});

test("wrong item exposes pick mismatch and warehouse correction", async ({ page }) => {
  await page.goto("/tickets/TKT-1021");
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(
    page.getByRole("strong").filter({ hasText: "Warehouse pick mismatch" }).first()
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("heading", { name: "PICK ACCURACY AUDIT" })).toBeVisible();
  await expect(page.getByText(/Send a standard replacement/)).toBeVisible();
});

test("optimizer produces a constraint-respecting batch plan", async ({ page }) => {
  await page.goto("/operations");
  await page.getByRole("button", { name: "Generate batch plan" }).click();
  await expect(page.getByText("OBJECTIVE SCORE")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Confirm sandbox execution" }).click();
  await expect(page.getByRole("button", { name: /Batch queued/ })).toBeVisible();
});

test("manual intake blocks missing evidence, then streams a bounded run", async ({ page }) => {
  await page.goto("/intake");
  await page
    .getByLabel("What happened?")
    .fill(
      "My order has not moved for eight days. I need the product before Monday. The order value was ₹3,200."
    );
  await page.getByLabel("Customer name").fill("Meera Rao");
  await page.getByRole("button", { name: "Extract case facts" }).click();
  await expect(page.getByText(/GEMINI EXTRACTION|STRUCTURED MANUAL FALLBACK/)).toBeVisible({
    timeout: 15000,
  });

  await page.getByLabel("Incident").selectOption("DELAYED_DELIVERY");
  await page.getByLabel("Order value (₹)").fill("3200");
  await page.getByLabel("Inactive days").fill("8");
  await page.getByLabel("Tracking state").fill("No carrier scan for eight days");
  await expect(page.getByRole("button", { name: "Create & Run" })).toBeDisabled();
  await page.getByLabel("Available inventory").fill("4");
  await page.getByRole("button", { name: "Create & Run" }).click();

  await expect(page).toHaveURL(/\/tickets\/TKT-M.+autorun=1/);
  await expect(page.getByText("LIVE EXECUTION")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("PRIORITY REPLACEMENT").first()).toBeVisible({ timeout: 30000 });
});
