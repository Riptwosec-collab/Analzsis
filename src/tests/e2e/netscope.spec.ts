import { expect, test } from "@playwright/test";

test("loads demo data and renders dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  const analyzeButton = page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first();
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click();
  await page.getByRole("main").getByRole("button", { name: /\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21/ }).click();
  await expect(page.getByText("\u0e04\u0e30\u0e41\u0e19\u0e19\u0e04\u0e27\u0e32\u0e21\u0e1b\u0e25\u0e2d\u0e14\u0e20\u0e31\u0e22")).toBeVisible();
  await expect(page.getByText("\u0e1b\u0e23\u0e30\u0e40\u0e14\u0e47\u0e19\u0e2a\u0e33\u0e04\u0e31\u0e0d")).toBeVisible();
});

test("metric cards drill into real processed data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();

  await page.getByRole("button", { name: /\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e17\u0e35\u0e48\u0e1e\u0e1a/ }).first().click();
  const detailRegion = page.locator("#analysis-detail");
  await expect(detailRegion.getByRole("cell", { name: /show ip interface brief/i }).first()).toBeVisible();
  await detailRegion.getByRole("row", { name: /show ip interface brief/i }).first().click();
  await expect(page.getByText(/\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14: show ip interface brief/)).toBeVisible();

  await page.getByRole("button", { name: /IP \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19/ }).first().click();
  await expect(page.getByRole("cell", { name: /\d+\.\d+\.\d+\.\d+/ }).first()).toBeVisible();
});

test("opens subnet and IP MAC audit details in modal dialogs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();

  await page.getByRole("button", { name: "Open selected subnet audit" }).click();
  await expect(page.getByRole("dialog", { name: /Subnet audit:/ })).toBeVisible();
  await expect(page.getByText("show ip arp").first()).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();

  await page.getByRole("button", { name: /IP \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19/ }).first().click();
  await page.locator("#analysis-detail tbody tr").filter({ hasText: "10.10.10.10" }).click();
  await expect(page.getByRole("dialog", { name: /IP \/ MAC detail:/ })).toBeVisible();
  await expect(page.getByText("Selected item problem summary")).toBeVisible();
});

test("filters the full IP dataset before pagination and opens the matching record only", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();
  await page.getByRole("button", { name: /IP \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19/ }).first().click();

  const detail = page.locator("#analysis-detail");
  await detail.locator("input[aria-label]").fill("6c3b.e524.91f8");
  await expect(detail.getByRole("cell", { name: "10.10.10.10" })).toBeVisible();
  await expect(detail.getByRole("cell", { name: "10.10.10.20" })).toHaveCount(0);
  await detail.locator("tbody tr").filter({ hasText: "10.10.10.10" }).click();
  await expect(page.getByRole("dialog", { name: /IP \/ MAC detail: 10\.10\.10\.10/ })).toBeVisible();
});

test("opens only the selected config feature and finding in detail dialogs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();

  await page.getByRole("button", { name: /\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c Config/ }).click();
  await page.getByRole("button", { name: /DHCP Snooping/ }).first().click();
  await expect(page.getByRole("dialog", { name: /DHCP Snooping/ })).toBeVisible();
  await expect(page.getByText("\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /DHCP Snooping/ })).toBeHidden();

  await page.getByRole("button", { name: /\u0e04\u0e27\u0e32\u0e21\u0e02\u0e31\u0e14\u0e41\u0e22\u0e49\u0e07/ }).first().click();
  await page.locator("button.cyber-finding").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Sources checked:")).toBeVisible();
});
