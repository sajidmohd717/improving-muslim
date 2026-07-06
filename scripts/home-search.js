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
    'about', 'pbuh', 'saw', 'sws', 'ra', 'as',
  ]);

  function queryTokens(query) {
    return normalizeQuery(query)
      .split(' ')
      .filter(function (token) { return token.length > 1 && !STOP_WORDS.has(token); });
  }

  // Matches "softeners" against "soften", "reminders" against "reminder", etc.
  function tokenInText(token, text) {
    if (text.includes(token)) return true;
    var stem = token.replace(/(ers|ies|ing|ed|es|s)$/, '');
    return stem.length >= 4 && text.includes(stem);
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

    function matchesSeries(series, query) {
      query = normalizeQuery(query);
      if (!query) return true;

      var parts = [
        series.title,
        series.speaker,
        series.topic,
        series.episodes,
        series.description,
        series._recap,
        series._keywords,
      ];

      if (Array.isArray(series._cats)) {
        series._cats.forEach(function (cat) {
          parts.push(cat);
          parts.push(categoryNameMap[cat] || '');
        });
      }
      if (series.duration) parts.push(formatDuration(series.duration));
      if (series._hasCaptions) parts.push('captions subtitles cc');
      if (series._globalKey && window[series._globalKey]) {
        (window[series._globalKey].episodes || []).forEach(function (episode) {
          parts.push(episode.title);
          if (episode.recap) parts.push(episode.recap.slice(0, 400));
        });
      }

      var haystack = parts.filter(Boolean).join(' ').toLowerCase();
      if (haystack.includes(query)) return true;
      var tokens = queryTokens(query);
      if (!tokens.length) return false;
      return tokens.every(function (token) { return tokenInText(token, haystack); });
    }

    return {
      closeSuggestions: closeSuggestions,
      init: init,
      matchesSeries: matchesSeries,
      normalizeQuery: normalizeQuery,
      reset: reset,
    };
  }

  window.IMHomeSearch = { create: create, normalizeQuery: normalizeQuery };
})();
