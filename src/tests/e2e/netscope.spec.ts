import { expect, test } from "@playwright/test";

test("loads demo data and renders dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  const analyzeButton = page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first();
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click();
  await page.getByRole("main").getByRole("button", { name: /\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21/ }).click();
  await expect(page.getByText("\u0e2a\u0e23\u0e38\u0e1b\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a")).toBeVisible();
  await expect(page.getByText("\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e41\u0e25\u0e30 Interface")).toBeVisible();
});

test("previews sanitized CLI without changing the raw text used for analysis", async ({ page }) => {
  await page.goto("/");
  await page.locator("select[aria-label]").first().selectOption("en");
  await page.getByRole("button", { name: "Load Demo" }).click();
  const editor = page.getByRole("textbox", { name: "Paste Router / Switch / Firewall Output" });
  const rawCli = await editor.inputValue();

  await page.getByRole("button", { name: "Mask Sensitive Data" }).click();
  const dialog = page.getByRole("dialog", { name: "Sanitization preview" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Raw CLI used for analysis")).toBeVisible();
  await expect(dialog.getByText("Sanitized CLI for sharing")).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();

  await expect(editor).toHaveValue(rawCli);
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByText("Verification Summary")).toBeVisible();
});

test("shows collection commands missing from the current CLI only", async ({ page }) => {
  await page.goto("/");
  await page.locator("select[aria-label]").first().selectOption("en");
  await page.getByRole("button", { name: "Load Demo" }).click();
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("button", { name: "Recommended Commands" }).click();
  await expect(page.getByText("Collection profiles")).toBeVisible();
  await page.getByRole("combobox", { name: "Collection profile" }).selectOption("duplicate-ip");
  await expect(page.getByRole("cell", { name: "show ip arp" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "show ip dhcp conflict" })).toBeVisible();
});

test("keeps verification details collapsed until the selected check is opened", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();
  const detail = page.locator("#analysis-detail");
  await expect(detail.getByText("\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19:")).toHaveCount(0);
  await detail.getByRole("button", { name: "\u0e14\u0e39\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
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

test("keeps subnet and IP MAC details scoped to the selected record", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();

  await expect(page.getByRole("button", { name: "Open selected subnet audit" })).toHaveCount(0);
  await page.getByRole("button", { name: /\u0e40\u0e04\u0e23\u0e37\u0e2d\u0e02\u0e48\u0e32\u0e22/ }).first().click();
  await page.locator("#analysis-detail tbody tr").first().click();
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

test("shows DHCP checks first instead of expanding raw reservation lists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "\u0e42\u0e2b\u0e25\u0e14\u0e15\u0e31\u0e27\u0e2d\u0e22\u0e48\u0e32\u0e07" }).click();
  await page.getByRole("button", { name: "\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c" }).first().click();
  await page.getByRole("button", { name: /DHCP Pool/ }).first().click();
  await page.getByRole("button", { name: "Open selected DHCP pool detail" }).click();

  const dialog = page.getByRole("dialog", { name: /DHCP pool detail:/ });
  await expect(dialog.getByText("\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e41\u0e25\u0e49\u0e27")).toBeVisible();
  await expect(dialog.getByText("Excluded ranges")).toHaveCount(0);
  await dialog.getByRole("button", { name: /\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e08\u0e2d\u0e07 IP/ }).click();
  await expect(dialog.getByText("\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2b\u0e31\u0e27\u0e02\u0e49\u0e2d\u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01")).toBeVisible();
  await expect(dialog.getByText(/\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e15\u0e23\u0e27\u0e08:/)).toBeVisible();
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
