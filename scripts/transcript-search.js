/*
 * Transcript search over lecture captions, in three stages:
 *   1. Lazy-load data/transcript-index-data.js (token → lecture postings)
 *      the first time a search runs — never on initial page load.
 *   2. Use the postings to pick candidate lectures that cover the query
 *      tokens (synonym/stem expansion shared with IMHomeSearch).
 *   3. Fetch only the candidates' VTT files, scan cue pairs for the best
 *      matching moments, and return timestamps plus snippet text.
 *
 * Exposes window.IMTranscriptSearch.search(query) → Promise<[{
 *   key, captionsSrc, moments: [{ time, snippet, matchedWords }]
 * }]> — the caller joins `key` against window.catalogIndex for titles,
 * thumbnails, and watch URLs.
 */
(function () {
  "use strict";

  var INDEX_SRC = "./data/transcript-index-data.js?v=20260711-transcripts";
  var MAX_LECTURES = 4;
  var MAX_MOMENTS_PER_LECTURE = 3;
  var MOMENT_GAP_SECONDS = 60;
  var SNIPPET_LENGTH = 170;

  var indexPromise = null;

  function loadIndex() {
    if (window.transcriptIndex) return Promise.resolve(window.transcriptIndex);
    if (indexPromise) return indexPromise;
    indexPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = INDEX_SRC;
      script.onload = function () {
        window.transcriptIndex ? resolve(window.transcriptIndex) : reject(new Error("transcript index missing"));
      };
      script.onerror = function () {
        indexPromise = null;
        reject(new Error("transcript index failed to load"));
      };
      document.head.appendChild(script);
    });
    return indexPromise;
  }

  function parseCueTime(stamp) {
    var parts = stamp.trim().split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    var seconds = 0;
    for (var i = 0; i < parts.length; i++) {
      var value = parseFloat(parts[i].replace(",", "."));
      if (!Number.isFinite(value)) return null;
      seconds = seconds * 60 + value;
    }
    return seconds;
  }

  function parseVtt(text) {
    var cues = [];
    var blocks = text.replace(/\r/g, "").split(/\n\n+/);
    blocks.forEach(function (block) {
      var lines = block.split("\n").filter(Boolean);
      for (var i = 0; i < lines.length; i++) {
        var arrow = lines[i].indexOf("-->");
        if (arrow === -1) continue;
        var start = parseCueTime(lines[i].slice(0, arrow));
        var cueText = lines.slice(i + 1).join(" ").replace(/<[^>]*>/g, "").trim();
        if (start !== null && cueText) cues.push({ start: start, text: cueText });
        break;
      }
    });
    return cues;
  }

  // Which of the query's token groups appear in this text, and through which
  // literal words — the words drive snippet highlighting.
  function matchGroups(textLower, tokenGroups) {
    var covered = [];
    var matchedWords = [];
    tokenGroups.forEach(function (variants, groupIndex) {
      for (var i = 0; i < variants.length; i++) {
        var variant = variants[i];
        if (variant.length >= 3 && textLower.indexOf(variant) !== -1) {
          covered.push(groupIndex);
          matchedWords.push(variant);
          return;
        }
      }
    });
    return { covered: covered, matchedWords: matchedWords };
  }

  function buildSnippet(text, matchedWords) {
    var lower = text.toLowerCase();
    var anchor = -1;
    for (var i = 0; i < matchedWords.length; i++) {
      var at = lower.indexOf(matchedWords[i]);
      if (at !== -1 && (anchor === -1 || at < anchor)) anchor = at;
    }
    if (anchor === -1) anchor = 0;
    var start = Math.max(0, anchor - Math.floor(SNIPPET_LENGTH / 3));
    var snippet = text.slice(start, start + SNIPPET_LENGTH).trim();
    if (start > 0) snippet = "…" + snippet;
    if (start + SNIPPET_LENGTH < text.length) snippet += "…";
    return snippet;
  }

  function findMoments(cues, tokenGroups) {
    var scored = [];
    for (var i = 0; i < cues.length; i++) {
      // Pair adjacent cues so phrases split across a cue boundary still hit.
      var text = cues[i].text + (cues[i + 1] ? " " + cues[i + 1].text : "");
      var match = matchGroups(text.toLowerCase(), tokenGroups);
      if (!match.covered.length) continue;
      scored.push({
        time: Math.floor(cues[i].start),
        coverage: match.covered.length,
        snippet: buildSnippet(text, match.matchedWords),
        matchedWords: match.matchedWords,
      });
    }
    scored.sort(function (a, b) { return b.coverage - a.coverage || a.time - b.time; });

    var moments = [];
    for (var j = 0; j < scored.length && moments.length < MAX_MOMENTS_PER_LECTURE; j++) {
      var candidate = scored[j];
      var tooClose = moments.some(function (moment) {
        return Math.abs(moment.time - candidate.time) < MOMENT_GAP_SECONDS;
      });
      if (!tooClose) moments.push(candidate);
    }
    moments.sort(function (a, b) { return a.time - b.time; });
    return moments;
  }

  function search(query) {
    var tokens = window.IMHomeSearch ? window.IMHomeSearch.queryTokens(query) : [];
    if (!tokens.length) return Promise.resolve([]);
    var tokenGroups = tokens.map(function (token) {
      return window.IMHomeSearch.tokenVariants(token);
    });

    return loadIndex().then(function (index) {
      // Score lectures by how many query token groups their transcript covers.
      var coverage = new Map();
      tokenGroups.forEach(function (variants) {
        var seen = new Set();
        variants.forEach(function (variant) {
          (index.tokens[variant] || []).forEach(function (lectureIndex) {
            if (seen.has(lectureIndex)) return;
            seen.add(lectureIndex);
            coverage.set(lectureIndex, (coverage.get(lectureIndex) || 0) + 1);
          });
        });
      });

      // Short queries must be fully covered; longer ones may miss one token.
      var required = tokens.length <= 2 ? tokens.length : tokens.length - 1;
      var candidates = [...coverage.entries()]
        .filter(function (entry) { return entry[1] >= required; })
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, MAX_LECTURES + 2)
        .map(function (entry) { return index.lectures[entry[0]]; });

      return Promise.all(
        candidates.map(function (lecture) {
          return fetch(lecture.captionsSrc)
            .then(function (response) { return response.ok ? response.text() : ""; })
            .then(function (text) {
              if (!text) return null;
              var moments = findMoments(parseVtt(text), tokenGroups);
              return moments.length
                ? { key: lecture.key, captionsSrc: lecture.captionsSrc, moments: moments }
                : null;
            })
            .catch(function () { return null; });
        }),
      ).then(function (results) {
        return results.filter(Boolean).slice(0, MAX_LECTURES);
      });
    });
  }

  window.IMTranscriptSearch = { search: search };
})();
