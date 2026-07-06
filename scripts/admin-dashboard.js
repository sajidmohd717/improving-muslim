(function () {
  'use strict';

  var ADMIN_EMAILS = ['sajidmohammad460519@gmail.com'];
  var PAGE_SIZE = 500;

  var els = {
    auth: document.getElementById('admin-auth'),
    dashboard: document.getElementById('admin-dashboard'),
    refresh: document.getElementById('admin-refresh-btn'),
    metrics: document.getElementById('admin-metrics'),
    topList: document.getElementById('top-searches-list'),
    zeroList: document.getElementById('zero-searches-list'),
    topCount: document.getElementById('top-searches-count'),
    recentBody: document.getElementById('recent-searches-body'),
    updatedAt: document.getElementById('admin-updated-at'),
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isAdmin(user) {
    return Boolean(user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()));
  }

  function setAuthMessage(html) {
    els.auth.innerHTML = html;
    els.auth.hidden = false;
    els.dashboard.hidden = true;
  }

  function showDashboard() {
    els.auth.hidden = true;
    els.dashboard.hidden = false;
  }

  function formatWhen(ms) {
    if (!ms) return 'Unknown';
    var diff = Date.now() - ms;
    var minutes = Math.round(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + ' hr ago';
    var days = Math.round(hours / 24);
    if (days < 14) return days + ' days ago';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function aggregate(events) {
    var byQuery = {};
    var zero = {};
    var categories = {};
    var last7 = 0;
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    events.forEach(function (event) {
      var query = event.queryLower || String(event.query || '').toLowerCase();
      if (!query) return;
      if (!byQuery[query]) {
        byQuery[query] = { query: event.query || query, count: 0, resultTotal: 0, lastAt: 0 };
      }
      byQuery[query].count += 1;
      byQuery[query].resultTotal += Number(event.resultCount) || 0;
      byQuery[query].lastAt = Math.max(byQuery[query].lastAt, Number(event.createdAtMs) || 0);

      if ((Number(event.resultCount) || 0) === 0) {
        if (!zero[query]) zero[query] = { query: event.query || query, count: 0, lastAt: 0 };
        zero[query].count += 1;
        zero[query].lastAt = Math.max(zero[query].lastAt, Number(event.createdAtMs) || 0);
      }

      var category = event.category || 'foryou';
      categories[category] = (categories[category] || 0) + 1;
      if ((Number(event.createdAtMs) || 0) >= weekAgo) last7 += 1;
    });

    return {
      top: Object.values(byQuery).sort(function (a, b) {
        return b.count - a.count || b.lastAt - a.lastAt;
      }),
      zero: Object.values(zero).sort(function (a, b) {
        return b.count - a.count || b.lastAt - a.lastAt;
      }),
      topCategory: Object.entries(categories).sort(function (a, b) { return b[1] - a[1]; })[0],
      last7: last7,
    };
  }

  function renderMetrics(events, summary) {
    var uniqueQueries = summary.top.length;
    var zeroCount = summary.zero.reduce(function (sum, item) { return sum + item.count; }, 0);
    var topCategory = summary.topCategory ? summary.topCategory[0] : 'None yet';
    els.metrics.innerHTML = [
      { label: 'Total searches', value: events.length },
      { label: 'Unique queries', value: uniqueQueries },
      { label: 'Last 7 days', value: summary.last7 },
      { label: 'No-result searches', value: zeroCount },
      { label: 'Top category', value: topCategory },
    ].map(function (item) {
      return '<div class="admin-metric"><strong>' + escapeHtml(item.value) + '</strong><span>' + escapeHtml(item.label) + '</span></div>';
    }).join('');
  }

  function renderList(container, items, emptyText, withAverage) {
    if (!items.length) {
      container.innerHTML = '<p class="admin-empty">' + escapeHtml(emptyText) + '</p>';
      return;
    }
    container.innerHTML = items.slice(0, 12).map(function (item, index) {
      var average = withAverage ? Math.round(item.resultTotal / Math.max(1, item.count)) : 0;
      return '<div class="admin-list-row">' +
        '<span class="admin-rank">' + (index + 1) + '</span>' +
        '<strong>' + escapeHtml(item.query) + '</strong>' +
        '<em>' + item.count + ' searches' + (withAverage ? ' · avg ' + average + ' results' : '') + '</em>' +
      '</div>';
    }).join('');
  }

  function renderRecent(events) {
    if (!events.length) {
      els.recentBody.innerHTML = '<tr><td colspan="5">No search events yet.</td></tr>';
      return;
    }
    els.recentBody.innerHTML = events.slice(0, 50).map(function (event) {
      return '<tr>' +
        '<td><strong>' + escapeHtml(event.query || '') + '</strong></td>' +
        '<td>' + (Number(event.resultCount) || 0) + '</td>' +
        '<td>' + escapeHtml(event.contentType || 'all') + '</td>' +
        '<td>' + escapeHtml(event.category || 'foryou') + '</td>' +
        '<td>' + escapeHtml(formatWhen(Number(event.createdAtMs) || 0)) + '</td>' +
      '</tr>';
    }).join('');
  }

  function render(events) {
    var summary = aggregate(events);
    renderMetrics(events, summary);
    renderList(els.topList, summary.top, 'No searches logged yet.', true);
    renderList(els.zeroList, summary.zero, 'No content gaps found yet.', false);
    renderRecent(events);
    els.topCount.textContent = summary.top.length + ' unique';
    els.updatedAt.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function loadAnalytics() {
    var db = window.IMAuth && window.IMAuth.getFirestore && window.IMAuth.getFirestore();
    if (!db) {
      setAuthMessage('<p>Analytics is still connecting. Try refreshing in a moment.</p>');
      return Promise.resolve();
    }

    els.refresh.disabled = true;
    els.refresh.textContent = 'Loading...';
    return db.collection('searchEvents')
      .orderBy('createdAtMs', 'desc')
      .limit(PAGE_SIZE)
      .get()
      .then(function (snap) {
        var events = [];
        snap.forEach(function (doc) {
          events.push(doc.data());
        });
        showDashboard();
        render(events);
      })
      .catch(function (err) {
        setAuthMessage(
          '<p>Could not load admin analytics. Make sure you are signed in with the admin account and Firestore rules are deployed.</p>' +
          '<p class="admin-error">' + escapeHtml(err.message) + '</p>',
        );
      })
      .then(function () {
        els.refresh.disabled = false;
        els.refresh.textContent = 'Refresh';
      });
  }

  function init() {
    if (!window.IMAuth) {
      setAuthMessage('<p>Authentication is still loading. Refresh if this does not change.</p>');
      return;
    }

    window.IMAuth.onAuthStateChanged(function (user) {
      if (!user) {
        setAuthMessage(
          '<p>Sign in with the admin Google account to view analytics.</p>' +
          '<a class="primary-link" href="./pages/sign-in.html">Sign in</a>',
        );
        return;
      }
      if (!isAdmin(user)) {
        setAuthMessage('<p>This account is signed in, but it is not allowed to view admin analytics.</p>');
        return;
      }
      loadAnalytics();
    });

    els.refresh.addEventListener('click', loadAnalytics);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
