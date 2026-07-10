import { expect, test } from "@playwright/test";

async function preparePage(page) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("https://sajidmohd717.github.io/series-api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("https://improving-muslim-ai-search.improving-muslim.workers.dev/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"results":[],"message":""}' }),
  );
  await page.route("https://videos.improvingmuslim.com/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  return pageErrors;
}

async function expectCatalog(page) {
  await expect.poll(() => page.locator("#series-grid .series-card").count()).toBeGreaterThan(0);
}

test("homepage renders and supports search and topic filtering", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find meaningful lecture series without the noise.",
  );
  await expect(page.getByRole("searchbox", { name: "Search lectures" })).toBeVisible();
  await expectCatalog(page);

  const prayerFilter = page.getByRole("button", { name: "Prayer", exact: true });
  await prayerFilter.click();
  await expect(prayerFilter).toHaveClass(/\bis-active\b/);
  await expectCatalog(page);

  const search = page.getByRole("searchbox", { name: "Search lectures" });
  await search.fill("prayer");
  await search.press("Enter");
  await expect(page.locator("#series-grid .series-title", { hasText: "Enjoy Your Prayer" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("homepage links through a generated series page to its watch page", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/");
  await expectCatalog(page);

  await page.locator('.series-title[href="./series/why-me/"]').click();
  await expect(page).toHaveURL(/\/series\/why-me\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Why Me?" })).toBeVisible();
  await expect(page.locator("#episode-filters-row .ep-filter-btn")).toHaveCount(4);

  const startWatching = page.getByRole("link", { name: "Start watching" });
  await startWatching.focus();
  await startWatching.press("Enter");
  await expect(page).toHaveURL(/\/watch\/why-me\/uzE5j2qkFA0\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Episode 1:");
  await expect(page.getByRole("heading", { level: 2, name: "My Notes" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("has an accessible keyboard-operated menu without horizontal overflow", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "More menu" });
    const menu = page.locator("#nav-more-menu");
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await menuButton.focus();
    await menuButton.press("Enter");
    await expect(menu).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page.locator(".bottom-nav")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
