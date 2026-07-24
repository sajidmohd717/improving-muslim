import { expect, test } from "@playwright/test";

async function preparePage(page) {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    // Chromium can reject an interrupted document transition while Playwright
    // follows a normal cross-page link. It is browser lifecycle noise, not an
    // application exception.
    if (error.message !== "Transition was skipped") pageErrors.push(error.message);
  });
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

async function mockSignedInFirebase(page, cloudData = {}, options = {}) {
  await page.addInitScript(({ initialCloud, initialLeaderboard, deferAuth, deferCloudGet, leaderboardSetDelay }) => {
    const cloudStorageKey = "__firebase-test-cloud";
    const leaderboardStorageKey = "__firebase-test-leaderboard";
    if (!sessionStorage.getItem(cloudStorageKey)) {
      sessionStorage.setItem(cloudStorageKey, JSON.stringify(initialCloud));
    }
    if (!sessionStorage.getItem(leaderboardStorageKey)) {
      sessionStorage.setItem(leaderboardStorageKey, JSON.stringify(initialLeaderboard));
    }
    const readCloud = () => JSON.parse(sessionStorage.getItem(cloudStorageKey) || "{}");
    const persistCloud = (value) => sessionStorage.setItem(cloudStorageKey, JSON.stringify(value));
    const readLeaderboard = () => JSON.parse(sessionStorage.getItem(leaderboardStorageKey) || "{}");
    const persistLeaderboard = (value) => sessionStorage.setItem(leaderboardStorageKey, JSON.stringify(value));
    const snapshotListeners = [];
    const snapshot = (value = window.__firebaseTest.cloud, metadata = {}) => ({
      exists: Object.keys(value).length > 0,
      data: () => structuredClone(value),
      metadata: { hasPendingWrites: false, fromCache: false, ...metadata },
    });
    let resolveCloudGet;
    const deferredCloudGet = new Promise((resolve) => { resolveCloudGet = resolve; });
    window.__firebaseTest = {
      cloud: readCloud(),
      leaderboard: readLeaderboard(),
      sets: [],
      leaderboardSets: [],
      leaderboardGets: 0,
      getSources: [],
      deletes: 0,
      resolveAuth: () => {},
      resolveCloudGet: () => resolveCloudGet(snapshot()),
      emitCacheSnapshot(value) {
        snapshotListeners.forEach((listener) => listener(snapshot(value, { fromCache: true })));
      },
      emitCloud(value) {
        this.cloud = structuredClone(value);
        persistCloud(this.cloud);
        snapshotListeners.forEach((listener) => listener(snapshot()));
      },
    };
    const syncDoc = {
      get: (getOptions = {}) => {
        window.__firebaseTest.getSources.push(getOptions.source || "default");
        return deferCloudGet ? deferredCloudGet : Promise.resolve(snapshot());
      },
      onSnapshot: (next) => {
        snapshotListeners.push(next);
        queueMicrotask(() => next(snapshot()));
        return () => snapshotListeners.splice(snapshotListeners.indexOf(next), 1);
      },
      set: async (value) => {
        window.__firebaseTest.cloud = structuredClone(value);
        persistCloud(window.__firebaseTest.cloud);
        window.__firebaseTest.sets.push(structuredClone(value));
      },
      delete: async () => {
        window.__firebaseTest.cloud = {};
        persistCloud({});
        window.__firebaseTest.deletes += 1;
      },
    };
    const genericDoc = {
      collection: () => ({ doc: () => syncDoc }),
      delete: async () => {},
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async () => {},
    };
    const leaderboardDoc = (userId) => ({
      set: async (value) => {
        if (leaderboardSetDelay) {
          await new Promise((resolve) => setTimeout(resolve, leaderboardSetDelay));
        }
        window.__firebaseTest.leaderboard[userId] = {
          ...(window.__firebaseTest.leaderboard[userId] || {}),
          ...structuredClone(value),
        };
        persistLeaderboard(window.__firebaseTest.leaderboard);
        window.__firebaseTest.leaderboardSets.push({ userId, value: structuredClone(value) });
      },
      delete: async () => {
        delete window.__firebaseTest.leaderboard[userId];
        persistLeaderboard(window.__firebaseTest.leaderboard);
      },
    });
    const leaderboardQuery = {
      requestedLimit: Infinity,
      orderBy() { return this; },
      limit(value) { this.requestedLimit = value; return this; },
      async get() {
        window.__firebaseTest.leaderboardGets += 1;
        const docs = Object.entries(window.__firebaseTest.leaderboard)
          .sort(([, a], [, b]) => (Number(b.current) || 0) - (Number(a.current) || 0))
          .slice(0, this.requestedLimit)
          .map(([id, value]) => ({ id, data: () => structuredClone(value) }));
        return { forEach: (callback) => docs.forEach(callback) };
      },
    };
    const db = {
      collection: (name) => {
        if (name === "users") return { doc: () => genericDoc };
        if (name === "leaderboard") {
          return {
            doc: (userId) => leaderboardDoc(userId),
            orderBy: (...args) => leaderboardQuery.orderBy(...args),
          };
        }
        return { doc: () => genericDoc, add: async () => {} };
      },
    };
    const signedInUser = {
        uid: "account-b",
        displayName: "Account B",
        email: "b@example.test",
        photoURL: "",
    };
    const authInstance = {
      onAuthStateChanged: (callback) => {
        window.__firebaseTest.resolveAuth = () => callback(signedInUser);
        if (!deferAuth) queueMicrotask(window.__firebaseTest.resolveAuth);
      },
      signOut: async () => {},
      signInWithPopup: async () => {},
    };
    const auth = () => authInstance;
    auth.GoogleAuthProvider = function GoogleAuthProvider() {};
    const firestore = () => db;
    firestore.FieldValue = {
      delete: () => ({ __firestoreDelete: true }),
      serverTimestamp: () => Date.now(),
    };
    window.firebase = {
      apps: [{}],
      initializeApp: () => {},
      auth,
      firestore,
    };
  }, {
    initialCloud: cloudData,
    initialLeaderboard: options.leaderboardRows || {},
    deferAuth: Boolean(options.deferAuth),
    deferCloudGet: Boolean(options.deferCloudGet),
    leaderboardSetDelay: Number(options.leaderboardSetDelay) || 0,
  });
}

async function expectCatalog(page) {
  await expect.poll(() => page.locator("#series-grid .series-card").count()).toBeGreaterThan(0);
}

test("homepage renders and supports search and topic filtering", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find meaningful Islamic lectures without the noise.",
  );
  await expect(page.getByRole("searchbox", { name: "Search lectures" })).toBeVisible();
  await expectCatalog(page);
  await expect(page.getByRole("heading", { level: 2, name: "Discover" })).toBeVisible();
  await expect(page.locator("#series-grid")).toHaveAttribute("data-feed-mode", "discovery");
  const discoveryTypes = await page.locator("#series-grid .series-title").evaluateAll((links) =>
    links.slice(0, 4).map((link) => link.getAttribute("href").includes("/series/") ? "series" : "video"),
  );
  expect(discoveryTypes).toEqual(["series", "video", "series", "video"]);
  await expect(page.locator("#series-grid").getByText("Standalone Video", { exact: true })).toHaveCount(0);
  const cardMetadata = await page.locator("#series-grid .series-card").evaluateAll((cards) =>
    cards.map((card) => ({
      isSeries: card.querySelector('.series-title')?.getAttribute('href')?.includes('/series/') || false,
      thumbnailChip: card.querySelector('.thumb-duration')?.textContent.trim() || "",
      bodyTags: card.querySelectorAll('.series-body .avail-badge, .series-body .avail-badge-plain, .series-body .label-badge:not(.label-ai)').length,
    })),
  );
  const seriesMetadata = cardMetadata.filter((card) => card.isSeries);
  expect(seriesMetadata.length).toBeGreaterThan(0);
  expect(seriesMetadata.every((card) => /^\d+ Episodes?$/.test(card.thumbnailChip))).toBe(true);
  expect(seriesMetadata.every((card) => card.bodyTags === 0)).toBe(true);

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

test("homepage keeps the core catalogue when optional shelves fail to load", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.route("**/scripts/home-shelves.js*", (route) => route.abort("failed"));
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expectCatalog(page);
  await expect(page.locator(".error-fallback")).toHaveCount(0);
  await expect(page.locator("#continue-section")).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test("desktop shell expands the feed and leaves mobile navigation intact", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expectCatalog(page);

  await expect(page.locator(".desktop-sidebar")).toBeVisible();
  await expect(page.locator(".desktop-sidebar-link.is-active")).toHaveText("Home");
  await expect(page.locator(".desktop-nav-search")).toBeVisible();
  await expect(page.locator("#category-scroll-next")).toHaveCount(1);

  const desktopLayout = await page.evaluate(() => ({
    categoryRows: new Set(
      Array.from(document.querySelectorAll(".category-button"), (button) =>
        Math.round(button.getBoundingClientRect().top),
      ),
    ).size,
    categoryStartOffset:
      Math.round(document.querySelector(".category-button").getBoundingClientRect().left) -
      Math.round(document.querySelector("#series-grid").getBoundingClientRect().left),
    cardRadius: getComputedStyle(document.querySelector("#series-grid .series-card")).borderRadius,
    gridColumns: getComputedStyle(document.querySelector("#series-grid")).gridTemplateColumns.split(" ").length,
    horizontalOverflow: document.body.scrollWidth > document.documentElement.clientWidth,
  }));
  expect(desktopLayout).toEqual({
    categoryRows: 1,
    categoryStartOffset: 0,
    cardRadius: "14px",
    gridColumns: 3,
    horizontalOverflow: false,
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("#category-scroll-next")).toBeVisible();

  for (const [path, activeLabel] of [
    ["/pages/explore.html", "Explore"],
    ["/pages/speakers.html", "Speakers"],
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".desktop-sidebar")).toBeVisible();
    await expect(page.locator(".desktop-sidebar-link.is-active")).toHaveText(activeLabel);
    await expect(page.locator(".site-menu.sidebar-replaced-menu")).toBeHidden();
  }

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/pages/explore.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".desktop-sidebar")).toBeHidden();
  await expect(page.locator(".site-menu.sidebar-replaced-menu")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".desktop-sidebar")).toBeHidden();
  await expect(page.locator(".desktop-nav-search")).toBeHidden();
  await expect(page.locator(".search-form")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("keeps the streak card compact at a half-screen desktop width", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.addInitScript(() => {
    const now = new Date();
    const todayKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem("lecture-progress:PLEcUc6n1p_6l6wq5yJMcALvB7nP0PMRoV:q1K2ngmNbmI", JSON.stringify({
      currentTime: 1133,
      duration: 3252,
      completed: false,
      updatedAt: Date.now(),
      _card: {
        eyebrow: "Tafsir Surah al-Kahf - Episode 1",
        title: "Session 1",
        thumbnail: "./assets/thumbnail/tafsir-surah-al-kahf/episodes/episode-01.jpg",
        url: "./watch/tafsir-surah-al-kahf/q1K2ngmNbmI/",
      },
    }));
    localStorage.setItem("lecture-progress:PLEcUc6n1p_6m5DfAAw5uORMQlI_xad8wR:bIrZJH0LPwU", JSON.stringify({
      currentTime: 266,
      duration: 3989,
      completed: false,
      updatedAt: Date.now() - 1000,
      _card: {
        eyebrow: "The Four Imams: Their Lives and Fiqh Principles - Episode 1",
        title: "Introduction to the Four Imams",
        thumbnail: "./assets/thumbnail/four-imams/episodes/episode-01.jpg",
        url: "./watch/four-imams/bIrZJH0LPwU/",
      },
    }));
    localStorage.setItem("improving-muslim:study-streak", JSON.stringify({
      targetMinutes: 15,
      todayDate: todayKey,
      todaySeconds: 5 * 60,
      current: 3,
      best: 5,
      lastCompletedDate: todayKey,
      days: {},
      freezesAvailable: 0,
      freezeMilestonesClaimed: 0,
      updatedAt: Date.now(),
    }));
  });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#streak-section")).toBeVisible();
  await expect(page.locator("#continue-section")).toBeVisible();
  const layout = await page.evaluate(() => {
    const streakCard = document.querySelector("#streak-card").getBoundingClientRect();
    const continueSection = document.querySelector("#continue-section").getBoundingClientRect();
    const continueThumbs = Array.from(document.querySelectorAll(".continue-thumb"), (thumb) => {
      const rect = thumb.getBoundingClientRect();
      return {
        aspectRatio: rect.width / rect.height,
        height: rect.height,
      };
    });
    return {
      streakAspectRatio: streakCard.width / streakCard.height,
      streakHeight: streakCard.height,
      continueHeight: continueSection.height,
      continueThumbs,
      progressBarCount: document.querySelectorAll(".continue-bar").length,
      progressFillRatios: Array.from(document.querySelectorAll(".continue-bar"), (bar) => {
        const trackRect = bar.getBoundingClientRect();
        const fillRect = bar.querySelector("span").getBoundingClientRect();
        return fillRect.width / trackRect.width;
      }),
      progressRingCount: document.querySelectorAll(".continue-ring").length,
    };
  });

  expect(layout.streakAspectRatio).toBeGreaterThan(1.5);
  expect(layout.streakHeight).toBeLessThan(layout.continueHeight);
  expect(layout.continueThumbs).toHaveLength(2);
  expect(layout.continueThumbs.every(({ aspectRatio }) => aspectRatio > 1.7 && aspectRatio < 1.85)).toBe(true);
  expect(Math.abs(layout.continueThumbs[0].height - layout.continueThumbs[1].height)).toBeLessThanOrEqual(1);
  expect(layout.progressBarCount).toBe(2);
  expect(layout.progressFillRatios[0]).toBeCloseTo(0.35, 2);
  expect(layout.progressFillRatios[1]).toBeCloseTo(0.07, 2);
  expect(layout.progressRingCount).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("homepage blends watch-based recommendations into the For you grid", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.addInitScript(() => {
    localStorage.setItem("lecture-progress:standalone:purpose-of-creation", JSON.stringify({
      currentTime: 180,
      duration: 900,
      percent: 0.2,
      completed: false,
      updatedAt: Date.now(),
    }));
  });
  const categoryLoaded = page.waitForResponse((response) =>
    response.url().startsWith("https://sajidmohd717.github.io/series-api/"),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await categoryLoaded;

  await expect(page.locator("#continue-section")).toBeVisible();
  await expect(page.locator("#series-grid")).toHaveAttribute("data-feed-mode", "personalized");
  await expect(page.getByRole("heading", { level: 2, name: "For you" })).toBeVisible();
  await expect(page.locator("#recommendation-shelves")).toHaveCount(0);
  await expect(page.getByText("Because you watched", { exact: true })).toHaveCount(0);
  await expectCatalog(page);
  expect(pageErrors).toEqual([]);
});

test("homepage links through a generated series page to its watch page", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/?category=purification#series", { waitUntil: "domcontentloaded" });
  await expectCatalog(page);

  const whyMeCard = page.locator(".series-card", {
    has: page.locator('.series-title[href="./series/why-me/"]'),
  });
  await whyMeCard.locator(".series-meta").click();
  await expect(page).toHaveURL(/\/series\/why-me\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Why Me?" })).toBeVisible();
  await expect(page.locator("#episode-filters-row .ep-filter-btn")).toHaveCount(4);

  const firstEpisode = page.locator(".episode-card-link").first();
  await firstEpisode.focus();
  await firstEpisode.press("Enter");
  await expect(page).toHaveURL(/\/watch\/why-me\/uzE5j2qkFA0\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Episode 1:");
  await expect(page.getByRole("heading", { level: 2, name: "My Notes" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Explore renders every public category from the shared taxonomy", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/pages/explore.html", { waitUntil: "domcontentloaded" });

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
  await page.goto("/pages/explore.html", { waitUntil: "domcontentloaded" });

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
    "7 lectures",
  );
  await expect(page.getByRole("link", { name: "Open topic: Sahaba" })).toBeVisible();
  await expect(page.locator('[data-category="sahaba"] .explore-card-kicker')).toHaveText(
    "5 lectures",
  );
  await expect(page.getByRole("link", { name: "Request topic: Hereafter" })).toBeVisible();
  await expect(page.locator('[data-category="hereafter"] .explore-card-kicker')).toHaveText(
    "Coming soon",
  );
  expect(pageErrors).toEqual([]);
});

test("category pages show focused topic content without homepage personalization", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.goto("/pages/category.html?category=purification", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Purification" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://improvingmuslim.com/pages/category.html?category=purification",
  );
  await expect(page.locator("#category-summary")).toHaveText("41 lectures available across 2 series");
  await expect(page.locator("#category-series-grid .series-card")).toHaveCount(2);
  await expect(page.locator("#category-lectures-grid .series-card")).toHaveCount(18);
  await expect(page.locator("#continue-section, #streak-section")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "All topics" })).toHaveAttribute("href", "./pages/explore.html");

  await page.goto("/pages/category.html?category=fiqh", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Fiqh" })).toBeVisible();
  await expect(page.locator("#category-summary")).toHaveText("7 lectures available across 2 series");
  await expect(page.locator("#category-series-grid .series-card")).toHaveCount(2);
  await expect(page.locator("#category-series-grid .series-title")).toHaveText([
    "The Four Imams: Their Lives and Fiqh Principles",
    "Fiqh of Social Media",
  ]);
  await expect(page.locator("#category-lectures-grid .series-card")).toHaveCount(1);
  await expect(page.locator("#category-lectures-grid .series-title")).toHaveText(
    "The 7 Commandments To A Successful Marriage",
  );
  expect(pageErrors).toEqual([]);
});

test("Fiqh series and standalone lectures stay on the local catalog", async ({ page }) => {
  let fiqhFeedRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/fiqh-data.json")) fiqhFeedRequests += 1;
  });
  const pageErrors = await preparePage(page);
  await page.goto("/?category=fiqh#series", { waitUntil: "domcontentloaded" });

  const fiqhTitles = page.locator("#series-grid .series-title");
  await expect(fiqhTitles).toHaveCount(3);
  await expect(fiqhTitles.filter({ hasText: "The Four Imams: Their Lives and Fiqh Principles" })).toHaveCount(1);
  await expect(fiqhTitles.filter({ hasText: "Fiqh of Social Media" })).toHaveCount(1);
  await expect(fiqhTitles.filter({ hasText: "The 7 Commandments To A Successful Marriage" })).toHaveCount(1);
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
  const categoryLoaded = page.waitForResponse((response) =>
    response.url().startsWith("https://sajidmohd717.github.io/series-api/"),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await categoryLoaded;

  const cards = page.locator("#series-grid .series-card");
  const status = page.locator("#catalog-pagination-status");
  const loadMore = page.getByRole("button", { name: "Load 36 more results" });
  await expect(cards).toHaveCount(36);
  const resultCount = await page.locator("#result-count").textContent();
  const seriesCount = Number(resultCount.match(/^(\d+) series/)?.[1]);
  expect(seriesCount).toBeGreaterThan(0);
  const totalResults = seriesCount + lectures.length;
  await expect(status).toHaveText(`Showing 36 of ${totalResults}`);
  const firstBatch = await cards.locator(".series-title").evaluateAll((titles) =>
    titles.map((title) => ({ href: title.getAttribute("href"), text: title.textContent.trim() })),
  );

  await loadMore.click();
  await expect(cards).toHaveCount(72);
  await expect(status).toHaveText(`Showing 72 of ${totalResults}`);
  const retainedBatch = await cards.locator(".series-title").evaluateAll((titles) =>
    titles.slice(0, 36).map((title) => ({ href: title.getAttribute("href"), text: title.textContent.trim() })),
  );
  expect(retainedBatch).toEqual(firstBatch);
  await expect(cards.nth(36).locator(".series-title")).toBeFocused();

  await page.locator('[data-content-type="videos"]').dispatchEvent("click");
  await expect(cards).toHaveCount(36);
  await expect(status).toHaveText("Showing 36 of 500");

  await page.getByRole("button", { name: "Purification", exact: true }).click();
  await expect(cards).toHaveCount(36);
  await expect(status).toHaveText("Showing 36 of 250");
  expect(pageErrors).toEqual([]);
});

test("stored 30-minute streaks migrate to the 15-minute goal", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await page.addInitScript(() => {
    const dateKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const todayKey = dateKey(today);
    const yesterdayKey = dateKey(yesterday);
    localStorage.setItem("improving-muslim:study-streak", JSON.stringify({
      targetMinutes: 30,
      todayDate: todayKey,
      todaySeconds: 15 * 60,
      current: 4,
      best: 4,
      lastCompletedDate: yesterdayKey,
      days: { [yesterdayKey]: { seconds: 30 * 60, completed: true } },
      freezesAvailable: 0,
      freezeMilestonesClaimed: 0,
      updatedAt: Date.now() - 1000,
    }));
  });
  await page.goto("/pages/settings.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#streak-settings-summary")).toContainText(
    "Today's 15 minute goal is complete. Current streak: 5 days.",
  );
  // readStudyStreak is a pure read: it applies the migration on every read but
  // never persists it (a normalize-on-read write is journalled like a genuine
  // user action and can clobber another device's real streak during sync).
  const migrated = await page.evaluate(() => window.IMUtils.readStudyStreak());
  expect(migrated.targetMinutes).toBe(15);
  expect(migrated.todaySeconds).toBe(15 * 60);
  expect(migrated.current).toBe(5);
  expect(migrated.lastCompletedDate).toBe(migrated.todayDate);
  expect(migrated.days[migrated.todayDate].completed).toBe(true);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("improving-muslim:study-streak")),
  );
  expect(stored.targetMinutes).toBe(30); // untouched until a genuine action writes
  expect(pageErrors).toEqual([]);
});

test("Qur'an recitation clocks into a separate synced streak", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  await mockSignedInFirebase(page, {
    progress: {},
    notes: {},
    savedItems: {},
    streak: {
      targetMinutes: 15,
      todayDate: todayKey,
      todaySeconds: 900,
      current: 7,
      best: 7,
      lastCompletedDate: todayKey,
      days: { [todayKey]: { seconds: 900, completed: true } },
      freezesAvailable: 1,
      freezeMilestonesClaimed: 1,
      publicOptIn: false,
      updatedAt: Date.now() - 1000,
    },
    quranStreak: {},
  });
  await page.goto("/pages/settings.html", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => window.IMAuth?.syncStatus)).toBe("synced");

  await page.evaluate(() => window.IMStreakUI.openPanel());
  await expect(page.locator('[data-streak-tab="quran"]')).toHaveText("Qur’an");
  await page.locator('[data-streak-tab="quran"]').click();
  await expect(page.getByText("Lectures support your learning, but they never replace your own recitation.")).toBeVisible();
  const clockIn = page.getByRole("button", { name: "Clock in 15 minutes" });
  await expect(clockIn).toBeEnabled();

  const lectureBefore = await page.evaluate(() => localStorage.getItem("improving-muslim:study-streak"));
  await clockIn.click();
  await expect(page.getByRole("heading", { level: 3, name: "1 day Qur’an streak" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clocked in today" })).toBeDisabled();
  await expect(page.locator(".quran-clock-in-status")).toHaveText("Your Qur’an recitation has been clocked in for today.");

  const localState = await page.evaluate(() => ({
    lecture: localStorage.getItem("improving-muslim:study-streak"),
    quran: JSON.parse(localStorage.getItem("improving-muslim:quran-streak")),
  }));
  expect(localState.lecture).toBe(lectureBefore);
  expect(localState.quran).toMatchObject({
    current: 1,
    best: 1,
    lastCompletedDate: todayKey,
    completedToday: true,
  });
  expect(localState.quran.days[todayKey]).toEqual({ completed: true, minutes: 15 });

  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.quranStreak),
  ), { timeout: 5000 }).toBe(true);
  const quranPush = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.quranStreak),
  );
  expect(quranPush.quranStreak).toMatchObject({ current: 1, best: 1 });
  expect(quranPush).not.toHaveProperty("streak");
  expect(await page.evaluate(() => window.__firebaseTest.leaderboardSets)).toHaveLength(0);
  expect(pageErrors).toEqual([]);
});

test("leaderboard expires stale rows and awaits the signed-in learner refresh", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const dateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const daysAgo = (count) => {
    const date = new Date();
    date.setDate(date.getDate() - count);
    return dateKey(date);
  };
  const todayKey = dateKey(new Date());
  const staleDate = daysAgo(5);
  const freezeCoveredDate = daysAgo(2);
  const publicRow = (displayName, current, lastCompletedDate, extra = {}) => ({
    displayName,
    current,
    best: current,
    targetMinutes: 15,
    lastCompletedDate,
    updatedAt: Date.now() - 1000,
    ...extra,
  });

  await mockSignedInFirebase(page, {
    progress: {},
    notes: {},
    savedItems: {},
    streak: {
      targetMinutes: 15,
      todayDate: staleDate,
      todaySeconds: 900,
      current: 1,
      best: 1,
      lastCompletedDate: staleDate,
      days: { [staleDate]: { seconds: 900, completed: true } },
      freezesAvailable: 0,
      freezeMilestonesClaimed: 0,
      publicOptIn: true,
      publicName: "Account B",
      updatedAt: Date.now() - 1000,
    },
  }, {
    leaderboardSetDelay: 100,
    leaderboardRows: {
      "account-b": publicRow("Account B", 1, staleDate),
      "freeze-covered": publicRow("Freeze Learner", 7, freezeCoveredDate, { activeThrough: todayKey }),
      "expired-other": publicRow("Expired Learner", 4, staleDate),
    },
  });

  await page.goto("/pages/settings.html", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => window.IMAuth?.authReady)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.IMUtils.readStudyStreak().current)).toBe(0);

  await page.evaluate(() => window.IMStreakUI.openPanel());
  await page.locator('[data-streak-tab="leaderboard"]').click();

  const ownRow = page.locator(".leaderboard-row").filter({ hasText: "Account B" });
  const freezeRow = page.locator(".leaderboard-row").filter({ hasText: "Freeze Learner" });
  const expiredRow = page.locator(".leaderboard-row").filter({ hasText: "Expired Learner" });
  await expect(ownRow.locator("strong")).toHaveText("0 days");
  await expect(freezeRow.locator("strong")).toHaveText("7 days");
  await expect(expiredRow.locator("strong")).toHaveText("0 days");
  await expect(page.locator(".leaderboard-row").first()).toContainText("Freeze Learner");

  const ownPublicWrite = await page.evaluate(() =>
    window.__firebaseTest.leaderboardSets.find((entry) => entry.userId === "account-b")?.value,
  );
  expect(ownPublicWrite).toMatchObject({ current: 0, best: 1, activeThrough: "" });
  expect(pageErrors).toEqual([]);
});

test("first sign-in merges local progress and reset cannot resurrect it", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const staleKey = "lecture-progress:stale-account:episode-1";
  const cloudKey = "lecture-progress:cloud-account:episode-2";
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ completed: true, updatedAt: Date.now() + 60_000 }));
  }, { key: staleKey });
  await mockSignedInFirebase(page, {
    progress: {
      [cloudKey]: { completed: true, currentTime: 600, duration: 600, updatedAt: 100 },
    },
    notes: {},
    saved: [],
    streak: {},
  });

  await page.goto("/pages/settings.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#cloud-reset-section")).toBeVisible();
  await expect(page.locator("#local-progress-section")).toBeHidden();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), staleKey)).not.toBeNull();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), cloudKey)).not.toBeNull();
  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.progress),
  ), { timeout: 5000 }).toBe(true);
  const setsBeforeReset = await page.evaluate(() => window.__firebaseTest.sets.length);
  const importedProgress = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.progress)?.progress,
  );
  expect(importedProgress[staleKey]).toMatchObject({ completed: true });
  expect(importedProgress[cloudKey]).toMatchObject({ completed: true });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#reset-cloud-data").click();
  await expect(page.locator("#settings-status")).toHaveText("Account data has been reset.");
  expect(await page.evaluate(() => ({
    deletes: window.__firebaseTest.deletes,
    progressKeys: Object.keys(localStorage).filter((key) => key.startsWith("lecture-progress:")),
  }))).toEqual({ deletes: 1, progressKeys: [] });
  await page.waitForTimeout(3200);
  expect(await page.evaluate(() => window.__firebaseTest.sets.length)).toBe(setsBeforeReset);
  expect(pageErrors).toEqual([]);
});

test("mark as watched on a series syncs to the signed-in account", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await mockSignedInFirebase(page, {});
  await page.goto("/series/change-of-heart/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => window.IMAuth?.authReady)).toBe(true);

  const firstEpisode = page.locator(".episode-card").first();
  await firstEpisode.locator(".ep-menu-btn").click();
  await page.locator('.ep-menu-action[data-action="mark-watched"]:visible').click();

  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.progress),
  ), { timeout: 5000 }).toBe(true);
  const syncedProgress = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.progress).progress,
  );
  expect(Object.values(syncedProgress).some((item) => item.completed === true)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("saving a series writes the cloud saved-items map", async ({ page }) => {
  const pageErrors = await preparePage(page);
  await mockSignedInFirebase(page, {});
  await page.goto("/series/change-of-heart/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => window.IMAuth?.authReady)).toBe(true);

  const saveButton = page.locator("#save-series-button");
  await expect(saveButton).toHaveAttribute("aria-label", "Save series");
  await saveButton.click();
  await expect(saveButton).toHaveAttribute("aria-label", "Remove from saved");

  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.savedItems),
  ), { timeout: 5000 }).toBe(true);
  const synced = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.savedItems),
  );
  const savedItems = Object.values(synced.savedItems);
  expect(savedItems).toHaveLength(1);
  expect(savedItems[0]).toMatchObject({
    type: "series",
    title: "Change of Heart",
  });
  expect(synced.saved).toEqual({ __firestoreDelete: true });
  expect(pageErrors).toEqual([]);
});

test("a homepage save survives navigation before auth finishes", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const phoneItem = {
    key: "series:./series/change-of-heart/",
    type: "series",
    title: "Change of Heart",
    subtitle: "Ali Hammuda - 10 of 16 available",
    url: "./series/change-of-heart/",
    savedAt: Date.now() - 1000,
  };
  await page.addInitScript(() => {
    localStorage.setItem("improving-muslim:personal-data-owner", "user:account-b");
  });
  await mockSignedInFirebase(page, {
    progress: {},
    notes: {},
    savedItems: { [phoneItem.key]: phoneItem },
    streak: {},
  }, { deferAuth: true });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expectCatalog(page);

  const card = page.locator(".series-card").filter({ hasText: "Madina Arabic Books" });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "More options" }).click();
  await card.getByRole("button", { name: "Save series" }).click();

  await page.goto("/pages/saved.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".saved-series-card")).toHaveCount(1);
  await page.evaluate(() => window.__firebaseTest.resolveAuth());
  await expect.poll(() => page.evaluate(() => window.IMAuth?.authReady)).toBe(true);
  await expect(page.locator(".saved-series-card")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.savedItems),
  ), { timeout: 5000 }).toBe(true);
  const savedPayload = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.savedItems).savedItems,
  );
  expect(savedPayload["series:./series/madina-arabic/"]).toMatchObject({ title: "Madina Arabic Books" });
  expect(savedPayload["series:./series/change-of-heart/"]).toBeUndefined();
  expect(pageErrors).toEqual([]);
});

test("same-account saved cache stays visible during cloud hydration", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const item = {
    key: "series:./series/madina-arabic/",
    type: "series",
    title: "Madina Arabic Books",
    subtitle: "Asif Meherali - 3 of 123 available",
    url: "./series/madina-arabic/",
    savedAt: Date.now(),
  };
  await page.addInitScript((savedItem) => {
    localStorage.setItem("improving-muslim:personal-data-owner", "user:account-b");
    localStorage.setItem("improving-muslim:saved-items", JSON.stringify([savedItem]));
  }, item);
  await mockSignedInFirebase(page, {
    progress: {},
    notes: {},
    savedItems: { [item.key]: item },
    streak: {},
  }, { deferCloudGet: true });
  await page.goto("/pages/saved.html", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => window.IMAuth?.authReady)).toBe(true);

  // The existing account cache remains on screen while the network read is pending.
  await expect(page.locator(".saved-series-card")).toHaveCount(1);
  await page.evaluate(() => window.__firebaseTest.resolveCloudGet());
  await expect(page.locator(".saved-series-card")).toHaveCount(1);
  expect(await page.evaluate(() => window.__firebaseTest.getSources)).toContain("server");

  // A stale cache-only listener event must not replace the hydrated account.
  await page.evaluate(() => window.__firebaseTest.emitCacheSnapshot({}));
  await expect(page.locator(".saved-series-card")).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test("a cloud history clear removes history live on another signed-in device", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const progressKey = "lecture-progress:standalone:purpose-of-creation";
  await mockSignedInFirebase(page, {
    progress: {
      [progressKey]: {
        currentTime: 180,
        duration: 900,
        updatedAt: Date.now(),
        _card: {
          thumbnail: "./assets/thumbnail/standalone/purpose-of-creation.jpg",
          url: "./watch/standalone/purpose-of-creation/",
          eyebrow: "Test speaker",
          title: "Purpose of Creation",
        },
      },
    },
    notes: {},
    savedItems: {},
    streak: {},
  });
  await page.goto("/pages/history.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".history-item")).toHaveCount(1);

  await page.evaluate(() => window.__firebaseTest.emitCloud({
    progress: {},
    notes: {},
    savedItems: {},
    streak: {},
  }));

  await expect(page.locator(".history-item")).toHaveCount(0);
  await expect(page.locator("#history-empty")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
  expect(pageErrors).toEqual([]);
});

test("a cloud saved-items clear updates the saved page live", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const item = {
    key: "series:./series/change-of-heart/",
    type: "series",
    title: "Change of Heart",
    subtitle: "Ali Hammuda - 30 episodes",
    url: "./series/change-of-heart/",
    savedAt: Date.now(),
  };
  await mockSignedInFirebase(page, {
    progress: {},
    notes: {},
    savedItems: { [item.key]: item },
    streak: {},
  });
  await page.goto("/pages/saved.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".saved-series-card")).toHaveCount(1);

  await page.evaluate(() => window.__firebaseTest.emitCloud({
    progress: {},
    notes: {},
    savedItems: {},
    streak: {},
  }));

  await expect(page.locator(".saved-series-card")).toHaveCount(0);
  await expect(page.locator("#saved-empty")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("improving-muslim:saved-items"))).toBe("[]");
  expect(pageErrors).toEqual([]);
});

test("clearing history sends deletions to the signed-in account", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const progressKey = "lecture-progress:standalone:purpose-of-creation";
  await mockSignedInFirebase(page, {
    progress: {
      [progressKey]: {
        currentTime: 180,
        duration: 900,
        updatedAt: Date.now(),
        _card: {
          thumbnail: "./assets/thumbnail/standalone/purpose-of-creation.jpg",
          url: "./watch/standalone/purpose-of-creation/",
          eyebrow: "Test speaker",
          title: "Purpose of Creation",
        },
      },
    },
    notes: {},
    savedItems: {},
    streak: {},
  });
  await page.goto("/pages/history.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".history-item")).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#clear-history-btn").click();

  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.progress),
  ), { timeout: 5000 }).toBe(true);
  const syncedProgress = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.progress).progress,
  );
  expect(syncedProgress[progressKey]).toEqual({ __firestoreDelete: true });
  expect(pageErrors).toEqual([]);
});

test("clearing saved items sends deletions to the signed-in account", async ({ page }) => {
  const pageErrors = await preparePage(page);
  const item = {
    key: "series:./series/change-of-heart/",
    type: "series",
    title: "Change of Heart",
    subtitle: "Ali Hammuda - 30 episodes",
    url: "./series/change-of-heart/",
    savedAt: Date.now(),
  };
  await mockSignedInFirebase(page, {
    progress: {},
    notes: {},
    savedItems: { [item.key]: item },
    streak: {},
  });
  await page.goto("/pages/saved.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".saved-series-card")).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#clear-saved-btn").click();

  await expect.poll(() => page.evaluate(() =>
    window.__firebaseTest.sets.some((value) => value.savedItems),
  ), { timeout: 5000 }).toBe(true);
  const synced = await page.evaluate(() =>
    window.__firebaseTest.sets.find((value) => value.savedItems),
  );
  expect(synced.savedItems[item.key]).toEqual({ __firestoreDelete: true });
  expect(synced.saved).toEqual({ __firestoreDelete: true });
  expect(pageErrors).toEqual([]);
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the Qur'an clock-in panel within the mobile viewport", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.goto("/pages/settings.html", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Start your daily learning streak." }).click();
    await page.locator('[data-streak-tab="quran"]').click();
    await expect(page.getByRole("button", { name: "Clock in 15 minutes" })).toBeVisible();

    const layout = await page.locator(".streak-panel-sheet").evaluate((sheet) => {
      const sheetRect = sheet.getBoundingClientRect();
      const tabRect = sheet.querySelector(".streak-tabs").getBoundingClientRect();
      const clockCard = sheet.querySelector(".quran-clock-in-card").getBoundingClientRect();
      const clockButton = sheet.querySelector("[data-quran-clock-in]").getBoundingClientRect();
      return {
        sheetLeft: sheetRect.left,
        sheetRight: sheetRect.right,
        sheetScrollWidth: sheet.scrollWidth,
        sheetClientWidth: sheet.clientWidth,
        tabsInside: tabRect.left >= sheetRect.left && tabRect.right <= sheetRect.right,
        clockButtonInside: clockButton.left >= clockCard.left && clockButton.right <= clockCard.right,
        clockButtonWidthRatio: clockButton.width / clockCard.width,
      };
    });
    expect(layout.sheetLeft).toBeGreaterThanOrEqual(0);
    expect(layout.sheetRight).toBeLessThanOrEqual(390);
    expect(layout.sheetScrollWidth).toBe(layout.sheetClientWidth);
    expect(layout.tabsInside).toBe(true);
    expect(layout.clockButtonInside).toBe(true);
    expect(layout.clockButtonWidthRatio).toBeGreaterThan(0.85);
    expect(pageErrors).toEqual([]);
  });

  test("explains the product before asking a new visitor to browse", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const heading = page.getByRole("heading", {
      level: 1,
      name: "Find meaningful Islamic lectures without the noise.",
    });
    await expect(heading).toBeVisible();
    await expect(page.getByText(
      "Watch ad-free, organized learning from trusted speakers and resume anytime.",
    )).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search lectures" })).toBeVisible();

    const heroFitsViewport = await page.locator(".hero").evaluate((hero) => {
      const rect = hero.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= document.documentElement.clientWidth;
    });
    expect(heroFitsViewport).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test("keeps streak and continue-learning summaries compact and ordered", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.addInitScript(() => {
      const now = new Date();
      const todayKey = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      localStorage.setItem("lecture-progress:standalone:purpose-of-creation", JSON.stringify({
        currentTime: 180,
        duration: 900,
        percent: 0.2,
        completed: false,
        updatedAt: Date.now(),
      }));
      localStorage.setItem("lecture-progress:standalone:qadr-and-sabr", JSON.stringify({
        currentTime: 74,
        duration: 2700,
        percent: 0.03,
        completed: false,
        updatedAt: Date.now() - 1000,
      }));
      localStorage.setItem("improving-muslim:study-streak", JSON.stringify({
        targetMinutes: 15,
        todayDate: todayKey,
        todaySeconds: 5 * 60,
        current: 3,
        best: 5,
        lastCompletedDate: todayKey,
        days: {},
        freezesAvailable: 0,
        freezeMilestonesClaimed: 0,
        updatedAt: Date.now(),
      }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const streak = page.locator("#streak-section");
    const continuing = page.locator("#continue-section");
    await expect(streak).toBeVisible();
    await expect(continuing).toBeVisible();
    const layout = await page.evaluate(() => {
      const streakSection = document.querySelector("#streak-section");
      const continueSection = document.querySelector("#continue-section");
      return {
        streakBeforeContinue:
          Boolean(streakSection.compareDocumentPosition(continueSection) & Node.DOCUMENT_POSITION_FOLLOWING),
        streakCardHeight: document.querySelector("#streak-card").getBoundingClientRect().height,
        continueCardHeight: document.querySelector(".continue-hero").getBoundingClientRect().height,
        continueContentHeight: document.querySelector(".continue-hero .continue-card-link").getBoundingClientRect().height,
        continueAlignItems: getComputedStyle(document.querySelector("#continue-list")).alignItems,
      };
    });
    expect(layout.streakBeforeContinue).toBe(true);
    expect(layout.streakCardHeight).toBeLessThanOrEqual(80);
    expect(layout.continueCardHeight).toBeLessThanOrEqual(140);
    expect(Math.abs(layout.continueCardHeight - layout.continueContentHeight)).toBeLessThanOrEqual(3);
    expect(layout.continueAlignItems).toBe("flex-start");
    expect(pageErrors).toEqual([]);
  });

  test("has an accessible keyboard-operated menu without horizontal overflow", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#series-grid .series-card")).toHaveCount(18);
    await expect(page.locator("#catalog-pagination-status")).toHaveText(/Showing 18 of \d+/);
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

  test("keeps mobile search, notes, and episode filters compact", async ({ page }) => {
    const pageErrors = await preparePage(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const search = page.getByRole("searchbox", { name: "Search lectures" });
    await search.fill("sabr");
    await search.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: 'Search results for "sabr"' })).toBeVisible();
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true);

    await page.goto("/watch/change-of-heart/vLb4YF-0F5M/", { waitUntil: "domcontentloaded" });
    const notesPanel = page.locator(".notes-panel");
    const notesToggle = page.getByRole("button", { name: "Open notes editor" });
    await expect(notesPanel).toHaveClass(/\bis-collapsed\b/);
    await expect(page.locator("#notes-panel-body")).toBeHidden();
    await notesToggle.click();
    await expect(page.locator("#notes-panel-body")).toBeVisible();
    await expect(page.getByRole("button", { name: "Collapse notes editor" })).toHaveAttribute("aria-expanded", "true");

    await page.goto("/series/change-of-heart/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#episode-filters-row .ep-filter-btn")).toHaveCount(4);
    const filterLayout = await page.locator("#episode-filters-row").evaluate((row) => ({
      flexWrap: getComputedStyle(row).flexWrap,
      withinViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }));
    expect(filterLayout).toEqual({ flexWrap: "nowrap", withinViewport: true });
    expect(pageErrors).toEqual([]);
  });
});
