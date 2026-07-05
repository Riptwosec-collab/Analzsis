import { expect, test } from "@playwright/test";

test("loads demo data and renders dashboard", async ({ page }) => {
  await page.goto("/import");
  await page.getByRole("button", { name: "Load Demo Data" }).click();
  const analyzeButton = page.getByRole("button", { name: "Analyze" }).first();
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click();
  await page.getByRole("link", { name: /Overview/ }).click();
  await expect(page.getByText("Security Score")).toBeVisible();
  await expect(page.getByText("Critical Findings")).toBeVisible();
});
