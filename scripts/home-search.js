(function () {
  'use strict';

  var CURATED_SUGGESTIONS = [
    'money in islam',
    'riba in islam',
    'quran tafsir',
    'soften the heart',
    'salah motivation',
    'seerah of the prophet',
    'hadith',
    'du\'a',
    'arabic grammar',
    'companions',
  ];

  function normalizeQuery(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function titleCaseSuggestion(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function suggestionMatches(value, query) {
    return String(value || '').toLowerCase().includes(query);
  }

  // Words that carry no search signal; dropped before token matching so
  // queries like "seerah of the prophet pbuh" still hit "seerah" + "prophet".
  var STOP_WORDS = new Set([
    'the', 'of', 'a', 'an', 'in', 'on', 'and', 'or', 'for', 'to', 'with',
    'about', 'pbuh', 'saw', 'sws', 'ra', 'as', 'how', 'what', 'why', 'is',
    'my', 'your', 'lecture', 'lectures', 'series', 'video', 'videos',
  ]);

  // Transliteration variants and close synonyms. Any word in a group expands
  // to the whole group, so "solah", "namaz", and "prayer" all find "salah".
  var SYNONYM_GROUPS = [
    ['salah', 'solah', 'salat', 'salaat', 'solat', 'salaah', 'namaz', 'prayer', 'prayers', 'praying'],
    ['dua', 'duas', 'duaa', "du'a", 'supplication', 'supplications'],
    ['quran', 'koran', 'quraan', "qur'an"],
    ['tafsir', 'tafseer', 'exegesis'],
    ['seerah', 'sirah', 'sira', 'seera', 'biography'],
    ['hadith', 'hadeeth', 'ahadith', 'hadiths'],
    ['sunnah', 'sunna'],
    ['ramadan', 'ramadhan', 'ramzan', 'ramadaan'],
    ['fasting', 'sawm', 'siyam', 'fast'],
    ['zakat', 'zakah', 'zakaat', 'charity', 'sadaqah', 'sadaqa'],
    ['hajj', 'haj', 'pilgrimage', 'umrah', 'umra'],
    ['aqeedah', 'aqidah', 'aqeeda', 'creed', 'belief', 'beliefs'],
    ['fiqh', 'jurisprudence', 'rulings'],
    ['akhirah', 'akhira', 'hereafter', 'afterlife'],
    ['jannah', 'paradise', 'heaven'],
    ['jahannam', 'hellfire', 'hell'],
    ['shaytan', 'shaitan', 'satan', 'devil', 'iblis'],
    ['iman', 'eman', 'emaan', 'imaan', 'faith'],
    ['tawbah', 'tawba', 'repentance', 'repent', 'istighfar'],
    ['riba', 'interest', 'usury'],
    ['nikah', 'nikaah', 'marriage'],
    ['prophet', 'messenger', 'rasul', 'rasool', 'nabi'],
    ['muhammad', 'muhammed', 'mohammad', 'mohammed'],
    ['dhikr', 'zikr', 'thikr', 'remembrance'],
    ['sabr', 'sabar', 'patience'],
    ['taqwa', 'piety'],
    ['deen', 'din', 'religion'],
    ['heart', 'hearts', 'qalb'],
    ['sahaba', 'sahabah', 'companions', 'companion'],
    ['arabic', 'arab'],
  ];

  var SYNONYM_LOOKUP = {};
  SYNONYM_GROUPS.forEach(function (group) {
    group.forEach(function (word) { SYNONYM_LOOKUP[word] = group; });
  });

  function stemToken(token) {
    var stem = token.replace(/(ers|ies|ing|ed|es|s)$/, '');
    return stem.length >= 4 ? stem : token;
  }

  function queryTokens(query) {
    return normalizeQuery(query)
      .split(' ')
      .filter(function (token) { return token.length > 1 && !STOP_WORDS.has(token); });
  }

  function tokenVariants(token) {
    var variants = new Set([token]);
    var stem = stemToken(token);
    variants.add(stem);
    (SYNONYM_LOOKUP[token] || SYNONYM_LOOKUP[stem] || []).forEach(function (word) {
      variants.add(word);
      variants.add(stemToken(word));
    });
    return Array.from(variants);
  }

  // True when a and b are within one edit (insert/delete/substitute) or one
  // adjacent swap of each other — catches typos like "ramadna" or "shiekh".
  function withinOneEdit(a, b) {
    if (a === b) return true;
    var lenDiff = a.length - b.length;
    if (lenDiff < -1 || lenDiff > 1) return false;
    if (lenDiff === 0) {
      var mismatches = [];
      for (var k = 0; k < a.length; k++) {
        if (a[k] !== b[k]) {
          if (mismatches.length === 2) return false;
          mismatches.push(k);
        }
      }
      if (mismatches.length <= 1) return true;
      // Exactly two mismatches: allow if they are adjacent swapped letters.
      var p = mismatches[0], q = mismatches[1];
      return q === p + 1 && a[p] === b[q] && a[q] === b[p];
    }
    var long = a.length > b.length ? a : b;
    var short = a.length > b.length ? b : a;
    var i = 0, j = 0, edits = 0;
    while (i < long.length && j < short.length) {
      if (long[i] === short[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      i++;
    }
    return true;
  }

  function textWords(text) {
    return text.split(/[^a-z0-9']+/).filter(Boolean);
  }

  // Matches "softeners" against "soften", "reminders" against "reminder", etc.
  function tokenInText(token, text) {
    if (text.includes(token)) return true;
    var stem = stemToken(token);
    return stem !== token && text.includes(stem);
  }

  function uniqueBy(items, getKey) {
    var seen = new Set();
    return items.filter(function (item) {
      var key = getKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function defaultEscapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function create(options) {
    options = options || {};
    var els = options.els || {};
    var escapeHtml = options.escapeHtml || defaultEscapeHtml;
    var formatDuration = options.formatDuration || function (seconds) { return String(seconds || ''); };
    var categoryNameMap = options.categoryNameMap || {};
    var activeSuggestionIndex = -1;

    function buildSuggestions(query) {
      query = normalizeQuery(query);
      if (query.length < 2) return [];

      var suggestions = [];
      function add(label, type, weight) {
        var normalized = normalizeQuery(label);
        if (!normalized || !suggestionMatches(normalized, query)) return;
        suggestions.push({
          label: String(label).trim(),
          type: type,
          score: (normalized.startsWith(query) ? 100 : 0) + (weight || 0) - Math.abs(normalized.length - query.length),
        });
      }

      (options.catalog ? options.catalog() : []).forEach(function (item) {
        add(item.title, item.contentType === 'video' ? 'Video' : 'Series', 24);
        add(item.speaker, 'Speaker', 18);
        add(item.topic, 'Topic', 12);
        if (Array.isArray(item._cats)) {
          item._cats.forEach(function (cat) {
            add(categoryNameMap[cat] || titleCaseSuggestion(cat), 'Topic', 10);
          });
        }
      });

      CURATED_SUGGESTIONS.forEach(function (phrase) {
        add(phrase, 'Suggested search', 6);
      });

      return uniqueBy(
        suggestions.sort(function (a, b) { return b.score - a.score; }),
        function (item) { return normalizeQuery(item.label); },
      ).slice(0, 7);
    }

    function closeSuggestions() {
      if (!els.searchSuggestions) return;
      els.searchSuggestions.hidden = true;
      els.searchSuggestions.innerHTML = '';
      activeSuggestionIndex = -1;
      els.searchInput.setAttribute('aria-expanded', 'false');
      els.searchInput.removeAttribute('aria-activedescendant');
    }

    function renderSuggestions() {
      if (!els.searchSuggestions) return;
      var suggestions = buildSuggestions(els.searchInput.value);
      activeSuggestionIndex = suggestions.length ? Math.min(activeSuggestionIndex, suggestions.length - 1) : -1;
      if (!suggestions.length) {
        closeSuggestions();
        return;
      }

      els.searchSuggestions.hidden = false;
      els.searchInput.setAttribute('aria-expanded', 'true');
      if (activeSuggestionIndex >= 0) {
        els.searchInput.setAttribute('aria-activedescendant', 'search-suggestion-' + activeSuggestionIndex);
      } else {
        els.searchInput.removeAttribute('aria-activedescendant');
      }
      els.searchSuggestions.innerHTML = suggestions
        .map(function (suggestion, index) {
          return '<button' +
            ' type="button"' +
            ' class="search-suggestion ' + (index === activeSuggestionIndex ? 'is-active' : '') + '"' +
            ' id="search-suggestion-' + index + '"' +
            ' role="option"' +
            ' aria-selected="' + (index === activeSuggestionIndex) + '"' +
            ' data-search-suggestion="' + escapeHtml(suggestion.label) + '"' +
            '>' +
              '<span>' + escapeHtml(suggestion.label) + '</span>' +
              '<small>' + escapeHtml(suggestion.type) + '</small>' +
            '</button>';
        })
        .join('');
    }

    function submit(value) {
      var query = normalizeQuery(value);
      els.searchInput.value = query;
      closeSuggestions();
      if (typeof options.onSubmit === 'function') options.onSubmit(query);
    }

    function init() {
      if (!els.searchForm || !els.searchInput) return;
      els.searchForm.addEventListener('submit', function (event) {
        event.preventDefault();
        submit(els.searchInput.value);
      });

      els.searchInput.addEventListener('input', renderSuggestions);
      els.searchInput.addEventListener('focus', renderSuggestions);
      els.searchInput.addEventListener('keydown', function (event) {
        var suggestions = Array.from(els.searchSuggestions?.querySelectorAll('[data-search-suggestion]') || []);
        if (event.key === 'ArrowDown' && suggestions.length) {
          event.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
          renderSuggestions();
          return;
        }
        if (event.key === 'ArrowUp' && suggestions.length) {
          event.preventDefault();
          activeSuggestionIndex = activeSuggestionIndex <= 0 ? suggestions.length - 1 : activeSuggestionIndex - 1;
          renderSuggestions();
          return;
        }
        if (event.key === 'Enter' && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
          event.preventDefault();
          submit(suggestions[activeSuggestionIndex].dataset.searchSuggestion);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          submit(els.searchInput.value);
          return;
        }
        if (event.key === 'Escape') closeSuggestions();
      });
      els.searchInput.addEventListener('blur', function () {
        setTimeout(closeSuggestions, 120);
      });
      els.searchSuggestions?.addEventListener('pointerdown', function (event) {
        var suggestion = event.target.closest('[data-search-suggestion]');
        if (!suggestion) return;
        event.preventDefault();
        submit(suggestion.dataset.searchSuggestion);
      });
    }

    function reset() {
      if (els.searchInput) els.searchInput.value = '';
      closeSuggestions();
    }

    // Weighted fields: a title hit should rank far above a hit buried in an
    // episode recap. Weights are relative, only their ratios matter.
    function buildFields(series) {
      var topicParts = [series.topic];
      if (Array.isArray(series._cats)) {
        series._cats.forEach(function (cat) {
          topicParts.push(cat);
          topicParts.push(categoryNameMap[cat] || '');
        });
      }

      var restParts = [series.episodes, series.description, series._recap, series._keywords];
      if (series.duration) restParts.push(formatDuration(series.duration));
      if (series._hasCaptions) restParts.push('captions subtitles cc');
      if (series._globalKey && window[series._globalKey]) {
        (window[series._globalKey].episodes || []).forEach(function (episode) {
          restParts.push(episode.title);
          if (episode.recap) restParts.push(episode.recap.slice(0, 400));
        });
      }

      return [
        { text: String(series.title || '').toLowerCase(), weight: 10 },
        { text: String(series.speaker || '').toLowerCase(), weight: 6 },
        { text: topicParts.filter(Boolean).join(' ').toLowerCase(), weight: 5 },
        { text: restParts.filter(Boolean).join(' ').toLowerCase(), weight: 2 },
      ];
    }

    // Strength of the best way this token matches the field text:
    // exact word > substring/stem > one-typo fuzzy. 0 = no match.
    function tokenStrengthInField(token, variants, fieldText, fieldWords) {
      var i, v;
      for (i = 0; i < variants.length; i++) {
        if (fieldWords.has(variants[i])) return 1;
      }
      for (i = 0; i < variants.length; i++) {
        v = variants[i];
        if (v.length >= 4 && fieldText.includes(v)) return 0.75;
      }
      if (token.length >= 5) {
        var words = Array.from(fieldWords);
        for (i = 0; i < words.length; i++) {
          if (words[i].length >= 4 && withinOneEdit(token, words[i])) return 0.55;
        }
      }
      return 0;
    }

    // Relevance score: 0 means "not a match", higher means better. At least
    // half the meaningful tokens must match so single stray words don't
    // flood multi-word queries with junk.
    function scoreSeries(series, query) {
      query = normalizeQuery(query);
      if (!query) return 1;

      var fields = buildFields(series);
      var fieldWords = fields.map(function (field) { return new Set(textWords(field.text)); });
      var fullText = fields.map(function (field) { return field.text; }).join(' ');
      var tokens = queryTokens(query);
      if (!tokens.length) return fullText.includes(query) ? 1 : 0;

      var total = 0;
      var matched = 0;
      tokens.forEach(function (token) {
        var variants = tokenVariants(token);
        var best = 0;
        fields.forEach(function (field, index) {
          var strength = tokenStrengthInField(token, variants, field.text, fieldWords[index]);
          if (strength * field.weight > best) best = strength * field.weight;
        });
        if (best > 0) matched++;
        total += best;
      });

      if (matched < Math.ceil(tokens.length / 2)) return 0;
      if (fullText.includes(query)) total += 8;
      var coverage = matched / tokens.length;
      return total * (0.3 + 0.7 * coverage * coverage);
    }

    function matchesSeries(series, query) {
      return scoreSeries(series, query) > 0;
    }

    return {
      closeSuggestions: closeSuggestions,
      init: init,
      matchesSeries: matchesSeries,
      normalizeQuery: normalizeQuery,
      reset: reset,
      scoreSeries: scoreSeries,
    };
  }

  window.IMHomeSearch = { create: create, normalizeQuery: normalizeQuery };
})();
