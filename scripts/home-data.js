/*
 * Homepage catalogue data assembly. Exposes window.IMHomeData.
 *
 * Owns everything about *what* appears in the homepage grid: the category
 * name map from the shared taxonomy, local series/standalone card sections,
 * remote-feed normalization, local/remote merging with de-duplication, the
 * allow-list filter for remote cards, and the offline fallback sections.
 * No DOM and no page state — script.js decides *when* to build and render.
 *
 * Loaded on the homepage after home-config.js/utils.js and before script.js.
 */
(() => {
  "use strict";

  const homeConfig = window.IMHomeConfig || {};
  const categories = homeConfig.categories || [{ name: "All", value: "foryou" }];

  const categoryNameMap = Object.fromEntries(
    categories.filter(c => c.value !== "foryou").map(c => [c.value, c.name])
  );

  const {
    formatViewCount,
    getAllSeries,
    getStandaloneLectures,
    seriesUrl,
    imageMap,
  } = window.IMUtils;
  const standaloneLectureUrl = (lecture) => window.IMUtils.standaloneLectureUrl(lecture);
  const standaloneLectureThumbnailUrl = (lecture) => window.IMUtils.standaloneLectureThumbnailUrl(lecture);

  const excludedSpeakerNames = new Set(homeConfig.excludedSpeakerNames || []);
  const excludedSeriesTitles = new Set(homeConfig.excludedSeriesTitles || []);

  function entryCategories(entry) {
    return Array.isArray(entry.categories) ? entry.categories : [entry.category].filter(Boolean);
  }

  function topicLabel(cats) {
    if (!Array.isArray(cats) || !cats.length) return "Series";
    const names = cats.map(c => categoryNameMap[c] || c);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  }

  // Last-resort homepage sections when the remote feed is unreachable.
  // Derived from the registry so removed series can never resurface here.
  const fallbackData = (() => {
    const sections = [];
    for (const entry of (window.seriesConfig || [])) {
      const available = entry.availableCount ?? entry.episodeCount ?? 0;
      if (available === 0) continue;
      const name = entry.sectionTitle || "Series";
      let section = sections.find((s) => s.sectionTitle === name);
      if (!section) {
        section = { sectionTitle: name, seriesList: [] };
        sections.push(section);
      }
      section.seriesList.push({
        title: entry.title,
        speaker: entry.speaker,
        episodes: `${entry.episodeCount} Lectures`,
        thumbnailImage: entry.thumbnailSrc,
        link: seriesUrl(entry),
      });
    }
    return sections;
  })();

  const localCategoryFallbacks = (() => {
    const map = {};
    for (const entry of (window.seriesConfig || [])) {
      if (!entry.title) continue;
      const available = entry.availableCount ?? entry.episodeCount ?? 0;
      if (available === 0) continue;
      const cats = entryCategories(entry);
      for (const cat of cats) {
        if (!map[cat]) map[cat] = [];
        const sectionName = categoryNameMap[cat] || cat;
        let section = map[cat].find(sec => sec.sectionTitle === sectionName);
        if (!section) {
          section = { sectionTitle: sectionName, seriesList: [] };
          map[cat].push(section);
        }
        section.seriesList.push({
          title: entry.title,
          speaker: entry.speaker,
          episodes: `${entry.episodeCount} Lectures`,
          thumbnailImage: entry.thumbnailSrc,
          link: seriesUrl(entry),
        });
      }
    }
    // A category can be represented only by standalone lectures (currently
    // Aqeedah and Fiqh). Give those categories an empty local section list so
    // loadCategory treats them as first-class local filters instead of fetching
    // an unrelated remote feed before standalone cards are merged in.
    for (const lecture of (window.standaloneLectures || [])) {
      for (const cat of entryCategories(lecture)) {
        if (!map[cat]) map[cat] = [];
      }
    }
    return map;
  })();

  const localFirstCategories = new Set(Object.keys(localCategoryFallbacks));

  // Slugs of series registered in data/series-registry.js. Cards from the
  // remote series-api that point at an unregistered series-detail id would
  // dead-end in a redirect back to the browse page, so they are dropped.
  const registeredSlugs = new Set((window.seriesConfig || []).map((entry) => entry.slug));

  function isAllowedSeries(series) {
    const speaker = (series.speaker || "").trim().toLowerCase();
    if (excludedSpeakerNames.has(speaker)) return false;
    if (excludedSeriesTitles.has((series.title || "").trim().toLowerCase())) return false;
    const detailMatch = /series-detail\.html\?id=([a-z0-9-]+)/.exec(series.link || "");
    if (detailMatch && !registeredSlugs.has(detailMatch[1])) return false;
    return true;
  }

  function cleanJson(text) {
    return text.replace(/^\uFEFF/, "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  }

  function normalizeSections(sections) {
    return sections.map((section) => ({
      ...section,
      seriesList: section.seriesList.map((series) => ({
        ...series,
        contentType: series.contentType || "series",
        topic: section.sectionTitle,
        thumbnailImage: imageMap[series.thumbnailImage] || series.thumbnailImage,
      })),
    }));
  }

  function flattenSeries(sections) {
    return sections.flatMap((section) => section.seriesList);
  }

  function uniqueBy(items, getKey) {
    const seen = new Set();
    return items.filter((item) => {
      const key = getKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function enrichSeries(item) {
    const local = getAllSeries().find(s => s.title === item.title);
    if (local) {
      const total = local.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
      if (total > 0) return { ...item, viewcount: formatViewCount(total) };
    }
    // Fuzzy match for Seerah: API may return a slightly different title spelling
    if ((item.title.includes("Seerah of Prophet") || item.title.includes("Seerah of the Prophet")) && window.seerahYasirQadhiSeries) {
      const total = window.seerahYasirQadhiSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
      if (total > 0) return { ...item, viewcount: formatViewCount(total) };
    }
    return item;
  }

  function availLabel(entry) {
    const total = entry.episodeCount || 0;
    const avail = entry.availableCount ?? total;
    if (avail >= total) return { text: `${total} Lectures`, cls: "" };
    if (avail === 0) return { text: "Coming soon", cls: "avail-none" };
    return { text: `${avail} of ${total} available`, cls: "avail-partial" };
  }

  function availBadge(entry) {
    const total = entry.episodeCount || 0;
    const avail = typeof entry.availableCount === "number" ? entry.availableCount : total;
    if (avail === 0) return null;
    if (avail >= total) return { text: "Fully available", cls: "badge-full" };
    return { text: `${avail} of ${total} available`, cls: "badge-partial" };
  }

  function localStandaloneSections(category = "foryou") {
    const sections = [];
    for (const lecture of getStandaloneLectures()) {
      const cats = entryCategories(lecture);
      if (category !== "foryou" && !cats.includes(category)) continue;
      const card = {
        title: lecture.title,
        speaker: lecture.speaker,
        topic: topicLabel(cats),
        episodes: lecture.typeLabel || "Standalone Video",
        thumbnailImage: standaloneLectureThumbnailUrl(lecture),
        link: standaloneLectureUrl(lecture),
        description: lecture.description,
        contentType: "video",
        duration: lecture.duration,
        sourceId: lecture.id,
        _cats: cats,
        _hasCaptions: Boolean(lecture.captionsSrc),
        _recap: typeof lecture.recap === "string" ? lecture.recap.slice(0, 600) : "",
      };
      const sectionTitle = categoryNameMap[cats[0]] || cats[0] || "Standalone Videos";
      const existing = sections.find(sec => sec.sectionTitle === sectionTitle);
      if (existing) {
        existing.seriesList.push(card);
      } else {
        sections.push({ sectionTitle, seriesList: [card] });
      }
    }
    return sections;
  }

  function localSeriesSections(category = "foryou") {
    const sections = [];
    for (const entry of (window.seriesConfig || [])) {
      if (!entry.title) continue;
      const avail = entry.availableCount ?? entry.episodeCount ?? 0;
      if (avail === 0) continue; // hide zero-available series from all catalogue views
      const cats = entryCategories(entry);
      if (category === "available") {
        // already filtered by avail > 0 above — show regardless of subject category
      } else if (category !== "foryou" && !cats.includes(category)) continue;
      const { text: episodesText, cls: episodesCls } = availLabel(entry);
      const card = {
        title: entry.title,
        speaker: entry.speaker,
        topic: topicLabel(cats),
        episodes: episodesText,
        episodesCls,
        thumbnailImage: entry.thumbnailSrc,
        link: seriesUrl(entry),
        description: entry.description,
        contentType: "series",
        _globalKey: entry.globalKey,
        _seriesSlug: entry.slug,
        _keywords: entry.searchKeywords || "",
        _topics: entry.topicKeywords || "",
        _cats: cats,
        _badge: availBadge(entry),
        _label: entry.label || null,
      };
      const sectionTitle = categoryNameMap[cats[0]] || cats[0];
      const existing = sections.find(sec => sec.sectionTitle === sectionTitle);
      if (existing) {
        existing.seriesList.push(card);
      } else {
        sections.push({ sectionTitle, seriesList: [card] });
      }
    }
    return sections;
  }

  function mergeLocalSeries(sections, category) {
    const localCategories = new Set([
      "foryou",
      "available",
      ...(window.seriesConfig || []).flatMap(e => entryCategories(e)),
      ...getStandaloneLectures().flatMap(lecture => entryCategories(lecture)),
    ]);
    if (!localCategories.has(category)) {
      return sections;
    }

    const localSections = [...localSeriesSections(category), ...localStandaloneSections(category)];
    const localTitles = new Set(flattenSeries(localSections).map((series) => series.title.toLowerCase()));
    // Include API alias titles for series whose API/external title differs from the local data file title
    for (const entry of (window.seriesConfig || [])) {
      if (entry.apiTitle) localTitles.add(entry.apiTitle.toLowerCase());
    }
    const merged = sections
      .map((section) => ({
        ...section,
        seriesList: section.seriesList.filter((series) => !localTitles.has(series.title.toLowerCase())),
      }))
      .filter((section) => section.seriesList.length);
    const existingTitles = new Set(flattenSeries(merged).map((series) => series.title.toLowerCase()));

    localSections.forEach((localSection) => {
      const newSeries = localSection.seriesList.filter((series) => !existingTitles.has(series.title.toLowerCase()));
      if (!newSeries.length) {
        return;
      }

      const matchingSection = merged.find((section) => section.sectionTitle === localSection.sectionTitle);
      if (matchingSection) {
        matchingSection.seriesList.push(...newSeries);
      } else {
        merged.push({ ...localSection, seriesList: newSeries });
      }
      newSeries.forEach((series) => existingTitles.add(series.title));
    });

    return merged;
  }

  window.IMHomeData = {
    categories,
    categoryNameMap,
    entryCategories,
    topicLabel,
    fallbackData,
    localCategoryFallbacks,
    localFirstCategories,
    isAllowedSeries,
    cleanJson,
    normalizeSections,
    flattenSeries,
    uniqueBy,
    enrichSeries,
    mergeLocalSeries,
  };
})();
