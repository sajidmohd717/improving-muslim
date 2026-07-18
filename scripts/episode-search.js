/*
 * Episode-level search over the generated catalog index (data/catalog-data.js).
 * Pure scoring only — no DOM. The homepage renders the results in the
 * "Jump straight to an episode" section during search mode.
 *
 * Series cards remain the primary results; this module surfaces the specific
 * episodes inside those series that match the query (e.g. "battle of badr"
 * should deep-link to the Badr episode, not just the Seerah series card).
 * Standalone lectures are excluded — they already appear as first-class cards
 * in the main results grid.
 *
 * Tokenization, stemming, synonym expansion, and one-edit typo tolerance are
 * shared with home-search.js via window.IMHomeSearch so a query behaves
 * identically across every search surface.
 */
(function () {
  "use strict";

  // Relative field weights: an episode-title hit should rank far above a hit
  // buried in the transcript-derived term vector.
  var TITLE_WEIGHT = 10;
  var CONTEXT_WEIGHT = 5; // series title + speaker
  var CATEGORY_WEIGHT = 4;
  var TERMS_WEIGHT = 3; // scaled by the term's TF-IDF weight (0..1]
  var MAX_PER_SERIES = 3;
  // Faint transcript-only matches below this score belong to the
  // "Mentioned inside lectures" section, which shows the actual moments.
  var MIN_SCORE = 2;

  function textWords(text) {
    return String(text || "").toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
  }

  // Strength of the best way this token matches a plain-text field:
  // exact word > substring > one-typo fuzzy. 0 = no match.
  function tokenStrengthInField(token, variants, fieldText, fieldWords, fuzzy) {
    var i;
    for (i = 0; i < variants.length; i++) {
      if (fieldWords.has(variants[i])) return 1;
    }
    for (i = 0; i < variants.length; i++) {
      if (variants[i].length >= 4 && fieldText.includes(variants[i])) return 0.75;
    }
    if (fuzzy && token.length >= 5) {
      var words = Array.from(fieldWords);
      for (i = 0; i < words.length; i++) {
        if (words[i].length >= 4 && fuzzy(token, words[i])) return 0.55;
      }
    }
    return 0;
  }

  // Best hit for this token inside the item's TF-IDF term vector. Terms are
  // single stemmed tokens, so only exact/fuzzy variant lookups apply.
  function tokenStrengthInTerms(token, variants, terms, fuzzy) {
    if (!terms) return 0;
    var best = 0;
    for (var i = 0; i < variants.length; i++) {
      var weight = terms[variants[i]];
      if (weight && weight > best) best = weight;
    }
    if (best > 0) return best;
    if (fuzzy && token.length >= 5) {
      for (var term in terms) {
        if (term.length >= 4 && fuzzy(token, term) && terms[term] > best) best = terms[term];
      }
    }
    return best * 0.7;
  }

  /**
   * options:
   *   items            catalog items (window.catalogIndex.items)
   *   query            raw user query string
   *   categoryNameMap  optional {slug: "Display Name"} for category matching
   *   limit            max results, default 6
   *
   * Returns ranked [{item, score, specificHits}] episodes (kind === "episode").
   */
  function search(options) {
    var shared = window.IMHomeSearch;
    if (!shared) return [];
    var query = shared.normalizeQuery(options.query);
    if (!query) return [];
    var tokens = shared.queryTokens(query);
    if (!tokens.length) return [];
    var fuzzy = shared.withinOneEdit || null;
    var categoryNameMap = options.categoryNameMap || {};
    var limit = options.limit || 6;

    var variantsByToken = tokens.map(function (token) {
      return shared.tokenVariants(token);
    });

    var scored = [];
    (options.items || []).forEach(function (item) {
      if (item.kind !== "episode") return;

      var titleText = String(item.title || "").toLowerCase();
      var contextText = (String(item.seriesTitle || "") + " " + String(item.speaker || "")).toLowerCase();
      var categoryText = (item.categories || [])
        .map(function (cat) { return cat + " " + (categoryNameMap[cat] || ""); })
        .join(" ")
        .toLowerCase();
      var titleWords = new Set(textWords(titleText));
      var contextWords = new Set(textWords(contextText));
      var categoryWords = new Set(textWords(categoryText));

      var total = 0;
      var matched = 0;
      var specificHits = 0;
      tokens.forEach(function (token, index) {
        var variants = variantsByToken[index];
        var titleStrength = tokenStrengthInField(token, variants, titleText, titleWords, fuzzy);
        var best = titleStrength * TITLE_WEIGHT;
        var contextStrength = tokenStrengthInField(token, variants, contextText, contextWords, fuzzy);
        if (contextStrength * CONTEXT_WEIGHT > best) best = contextStrength * CONTEXT_WEIGHT;
        var categoryStrength = tokenStrengthInField(token, variants, categoryText, categoryWords, null);
        if (categoryStrength * CATEGORY_WEIGHT > best) best = categoryStrength * CATEGORY_WEIGHT;
        var termsStrength = tokenStrengthInTerms(token, variants, item.terms, fuzzy);
        if (termsStrength * TERMS_WEIGHT > best) best = termsStrength * TERMS_WEIGHT;

        if (best > 0) matched++;
        // A hit that points at THIS episode rather than its series metadata:
        // a real title match or a meaningful transcript/keyword term.
        if (titleStrength >= 0.75 || termsStrength >= 0.35) specificHits++;
        total += best;
      });

      // Every token must land somewhere: a two-word query where one word is
      // completely absent is a different topic, not a weaker match.
      if (matched < tokens.length) return;
      // At least one token must be specific to the episode itself. Queries
      // that only hit the series title, speaker, or category are already
      // answered by the series card in the main results grid.
      if (!specificHits) return;
      if (titleText.includes(query)) total += 8;
      if (total < MIN_SCORE) return;

      scored.push({ item: item, score: total, specificHits: specificHits });
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    // Greedy per-series diversity cap (same idea as IMRelated) so one series
    // cannot flood the row when the query names its overall topic.
    var perSeries = {};
    var picked = [];
    for (var i = 0; i < scored.length && picked.length < limit; i++) {
      var seriesKey = scored[i].item.series || "";
      if ((perSeries[seriesKey] || 0) >= MAX_PER_SERIES) continue;
      perSeries[seriesKey] = (perSeries[seriesKey] || 0) + 1;
      picked.push(scored[i]);
    }
    return picked;
  }

  window.IMEpisodeSearch = { search: search };
})();
