import { expect, test, type Page } from "@playwright/test";

/* The interface language.
 *
 * `settings.uiLanguage` has existed for a while, but only the coach panel read it,
 * so choosing 简体中文 changed one panel and nothing else. These tests are the
 * contract that it now drives every screen:
 *
 *  - the stored choice reaches the shell and the page it wraps, and survives a reload;
 *  - changing it in Settings applies without a reload;
 *  - `en` still renders the exact English, because ~600 locators elsewhere in this
 *    suite match those strings and a silent rewording would break them.
 */

const SETTINGS_KEY = "open-chess-review-settings-v1";

/** Seeded before the app boots, so the first client render already has the choice. */
async function seedLanguage(page: Page, uiLanguage: "en" | "zh-CN") {
  await page.addInitScript(
    ([key, language]) => window.localStorage.setItem(key, JSON.stringify({ uiLanguage: language })),
    [SETTINGS_KEY, uiLanguage] as const,
  );
}

const RAIL = {
  en: ["Home", "Import", "Review", "Practice", "Library", "Stats", "Settings"],
  "zh-CN": ["首页", "导入", "复盘", "训练", "棋库", "统计", "设置"],
} as const;

async function expectRail(page: Page, language: "en" | "zh-CN") {
  const nav = page.getByRole("navigation");
  for (const label of RAIL[language]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  // And nothing from the other language leaked in.
  const other = language === "en" ? "zh-CN" : "en";
  for (const label of RAIL[other]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
}

test("the stored interface language drives the shell and the document", async ({ page }) => {
  await seedLanguage(page, "zh-CN");
  await page.goto("/");
  await expectRail(page, "zh-CN");
  // The attribute is what makes Chinese text pick a CJK face and what a screen
  // reader announces, so it has to follow too.
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");

  await page.reload();
  await expectRail(page, "zh-CN");

  // Another route, to prove this is not the shell alone.
  await page.goto("/settings");
  await expect(page.locator(".page-heading h1, .page-kicker").first()).toBeVisible();
  await expectRail(page, "zh-CN");
});

test("the English interface is unchanged", async ({ page }) => {
  await seedLanguage(page, "en");
  await page.goto("/");
  await expectRail(page, "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // A shell string that predates this work and is asserted elsewhere in the suite.
  await expect(page.getByRole("link", { name: "Open Chess Review home" })).toBeVisible();
});

test("changing the language in Settings applies without a reload", async ({ page }) => {
  await seedLanguage(page, "en");
  await page.goto("/settings");
  await expectRail(page, "en");

  // The label is localized, so match either wording rather than pinning one.
  await page.getByLabel(/Interface language|界面语言/).selectOption("zh-CN");
  await expectRail(page, "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");

  await page.getByLabel(/Interface language|界面语言/).selectOption("en");
  await expectRail(page, "en");
});

/* The rail only proves the shell. These prove the screens under it, which is where
   the setting used to stop: before this change `zh-CN` reached one panel and left
   every page English. */
test("a page's own content follows the language", async ({ page }) => {
  await seedLanguage(page, "zh-CN");

  await page.goto("/");
  // The hero's two lines share one `<h1>`, so match the role rather than text.
  await expect(page.getByRole("heading", { level: 1, name: /每一步之间/ })).toBeVisible();

  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "帮助与数据隐私" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "复盘快捷键" })).toBeVisible();

  // The shortcut table is single-sourced: the Help page and the `?` overlay read the
  // same rows, so both the group heading and the action wording come from it.
  await expect(page.getByRole("heading", { name: "导航", exact: true })).toBeVisible();
  await expect(page.getByText("上一步", { exact: true })).toBeVisible();
  await expect(page.getByText("翻转棋盘", { exact: true })).toBeVisible();
});
