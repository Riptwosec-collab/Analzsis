import { expect, test } from "@playwright/test";

test("loads demo data and renders dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "โหลดตัวอย่าง" }).click();
  const analyzeButton = page.getByRole("button", { name: "วิเคราะห์" }).first();
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click();
  await page.getByRole("main").getByRole("button", { name: /ภาพรวม/ }).click();
  await expect(page.getByText("คะแนนความปลอดภัย")).toBeVisible();
  await expect(page.getByText("ประเด็นสำคัญ")).toBeVisible();
});
