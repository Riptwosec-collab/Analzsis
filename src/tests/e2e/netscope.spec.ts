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
  await expect(page.getByRole("cell", { name: /show ip interface brief/i })).toBeVisible();
  await page.getByRole("row", { name: /show ip interface brief/i }).click();
  await expect(page.getByText(/\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14: show ip interface brief/)).toBeVisible();

  await page.getByRole("button", { name: /IP \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19/ }).first().click();
  await expect(page.getByRole("cell", { name: /\d+\.\d+\.\d+\.\d+/ }).first()).toBeVisible();
});
