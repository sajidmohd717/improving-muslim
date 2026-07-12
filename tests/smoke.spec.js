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
  await page.route("https://improving-muslim-popularity.improving-muslim.workers.dev/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"items":{}}' }),
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
  await page.goto("/?category=purification#series");
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

test("Explore renders every public category from the shared taxonomy", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/pages/explore.html");

  const expected = await page.evaluate(() =>
    window.IMCategoryTaxonomy.topics
      .filter((topic) => topic.public)
      .map((topic) => topic.value),
  );
  const rendered = await page
    .locator("#explore-topic-grid [data-category]")
    .evaluateAll((cards) => cards.map((card) => card.dataset.category));

  expect(rendered).toEqual(expected);
  expect(rendered).toContain("prophets");
  expect(rendered).toContain("fiqh");
  await expect(page.getByRole("link", { name: "Open topic: Prophets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open topic: Fiqh" })).toHaveAttribute(
    "href",
    "./pages/category.html?category=fiqh",
  );
  await expect(page.getByRole("link", { name: "Request topic: Hereafter" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Explore reports series, available episodes, and standalone lectures accurately", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/pages/explore.html");

  const expected = await page.evaluate(() => {
    const categoriesFor = (entry) =>
      Array.isArray(entry.categories) ? entry.categories : [entry.category].filter(Boolean);
    return window.IMCategoryTaxonomy.topics
      .filter((topic) => topic.public)
      .map((topic) => {
        const series = window.seriesConfig.filter((entry) => categoriesFor(entry).includes(topic.value));
        const seriesCount = series.length;
        const episodeCount = series.reduce(
          (total, entry) => total + Math.max(0, Number(entry.availableCount) || 0),
          0,
        );
        const standaloneCount = window.standaloneLectures.filter(
          (lecture) => lecture.videoSrc && categoriesFor(lecture).includes(topic.value),
        ).length;
        return {
          category: topic.value,
          seriesCount,
          episodeCount,
          standaloneCount,
          totalWatchable: episodeCount + standaloneCount,
        };
      });
  });
  const rendered = await page.locator("#explore-topic-grid [data-category]").evaluateAll((cards) =>
    cards.map((card) => ({
      category: card.dataset.category,
      seriesCount: Number(card.dataset.seriesCount),
      episodeCount: Number(card.dataset.episodeCount),
      standaloneCount: Number(card.dataset.standaloneCount),
      totalWatchable: Number(card.dataset.totalWatchable),
    })),
  );

  expect(rendered).toEqual(expected);
  await expect(page.locator('[data-category="purification"] .explore-card-kicker')).toHaveText(
    "41 lectures",
  );
  await expect(page.locator('[data-category="fiqh"] .explore-card-kicker')).toHaveText(
    "1 lecture",
  );
  await expect(page.getByRole("link", { name: "Request topic: Sahaba" })).toBeVisible();
  await expect(page.locator('[data-category="sahaba"] .explore-card-kicker')).toHaveText(
    "Coming soon",
  );
  expect(pageErrors).toEqual([]);
});

test("category pages show focused topic content without homepage personalization", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/pages/category.html?category=purification");

  await expect(page.getByRole("heading", { level: 1, name: "Purification" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://improvingmuslim.com/pages/category.html?category=purification",
  );
  await expect(page.locator("#category-summary")).toHaveText("41 lectures available across 2 series");
  await expect(page.locator("#category-series-grid .series-card")).toHaveCount(2);
  await expect(page.locator("#category-lectures-grid .series-card")).toHaveCount(18);
  await expect(page.locator("#continue-section, #streak-section, #recommendation-shelves")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "All topics" })).toHaveAttribute("href", "./pages/explore.html");

  await page.goto("/pages/category.html?category=fiqh");
  await expect(page.getByRole("heading", { level: 1, name: "Fiqh" })).toBeVisible();
  await expect(page.locator("#category-series-section")).toBeHidden();
  await expect(page.locator("#category-lectures-grid .series-card")).toHaveCount(1);
  await expect(page.locator("#category-lectures-grid .series-title")).toHaveText(
    "The 7 Commandments To A Successful Marriage",
  );
  expect(pageErrors).toEqual([]);
});

test("standalone-only categories stay on the local catalog", async ({ page }) => {
  let fiqhFeedRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/fiqh-data.json")) fiqhFeedRequests += 1;
  });
  const pageErrors = await preparePage(page);
  await page.goto("/?category=fiqh#series");

  await expect(page.locator("#series-grid .series-title")).toHaveCount(1);
  await expect(page.locator("#series-grid .series-title")).toHaveText(
    "The 7 Commandments To A Successful Marriage",
  );
  expect(fiqhFeedRequests).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("homepage batches a 500-video catalog without changing the session order", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const lectures = Array.from({ length: 500 }, (_, index) => ({
    id: `synthetic-${index + 1}`,
    title: `Synthetic Lecture ${String(index + 1).padStart(3, "0")}`,
    speaker: "Synthetic Speaker",
    speakerSlug: "synthetic-speaker",
    categories: [index % 2 ? "quran" : "purification"],
    topic: index % 2 ? "Quran" : "Purification",
    typeLabel: "Standalone Video",
    published: "2026-01-01",
    duration: 1200,
    sourceUrl: `https://www.youtube.com/watch?v=synthetic${index}`,
    thumbnailSrc: "./public/social-preview.png",
    videoSrc: `https://videos.improvingmuslim.com/synthetic/${index}.mp4`,
    description: "Synthetic scale-test lecture.",
  }));
  await page.route("**/data/standalone-lectures-data.js*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.standaloneLectures = ${JSON.stringify(lectures)};`,
    }),
  );
  await page.goto("/");

  const cards = page.locator("#series-grid .series-card");
  const status = page.locator("#catalog-pagination-status");
  const loadMore = page.getByRole("button", { name: "Load 24 more results" });
  await expect(cards).toHaveCount(24);
  const resultCount = await page.locator("#result-count").textContent();
  const seriesCount = Number(resultCount.match(/^(\d+) series/)?.[1]);
  expect(seriesCount).toBeGreaterThan(0);
  const totalResults = seriesCount + lectures.length;
  await expect(status).toHaveText(`Showing 24 of ${totalResults}`);
  const firstBatch = await cards.locator(".series-title").evaluateAll((titles) =>
    titles.map((title) => ({ href: title.getAttribute("href"), text: title.textContent.trim() })),
  );

  await loadMore.click();
  await expect(cards).toHaveCount(48);
  await expect(status).toHaveText(`Showing 48 of ${totalResults}`);
  const retainedBatch = await cards.locator(".series-title").evaluateAll((titles) =>
    titles.slice(0, 24).map((title) => ({ href: title.getAttribute("href"), text: title.textContent.trim() })),
  );
  expect(retainedBatch).toEqual(firstBatch);
  await expect(cards.nth(24).locator(".series-title")).toBeFocused();

  await page.locator('[data-content-type="videos"]').dispatchEvent("click");
  await expect(cards).toHaveCount(24);
  await expect(status).toHaveText("Showing 24 of 500");

  await page.getByRole("button", { name: "Purification", exact: true }).click();
  await expect(cards).toHaveCount(24);
  await expect(status).toHaveText("Showing 24 of 250");
  expect(pageErrors).toEqual([]);
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("has an accessible keyboard-operated menu without horizontal overflow", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.goto("/");

    await expect(page.locator("#series-grid .series-card")).toHaveCount(12);
    await expect(page.locator("#catalog-pagination-status")).toHaveText(/Showing 12 of \d+/);
    await expect(page.getByRole("button", { name: /Load \d+ more results/ })).toBeVisible();

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
