/**
 * Firebase Authentication + Firestore sync for Improving Muslim.
 *
 * - Self-loads the Firebase compat SDK from Google CDN (no extra <script> tags needed).
 * - Injects a sign-in / avatar button into every .nav-shell automatically.
 * - On sign-in: merges Firestore data with localStorage (newest updatedAt wins per key).
 * - On every localStorage write (via IMUtils.writeJsonStorage): debounces a push to Firestore.
 * - On sign-out: stops syncing; localStorage continues unchanged.
 *
 * Exposes window.IMAuth = { currentUser, signIn(), signOut(), onAuthStateChanged(fn), onLocalWrite(key) }
 */
(function () {
  'use strict';

  var FIREBASE_VERSION = '10.12.0';
  var FIREBASE_BASE    = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/';
  var PROGRESS_PREFIX  = 'lecture-progress:';
  var SAVED_KEY        = 'improving-muslim:saved-items';
  var STREAK_KEY       = 'improving-muslim:study-streak';
  var STREAK_TARGET_OPTIONS = [20, 30, 40];
  var DEFAULT_STREAK_TARGET_MINUTES = 30;
  var PUSH_DEBOUNCE_MS = 3000;

  var _user         = null;
  var _db           = null;
  var _pushTimer    = null;
  var _listeners    = [];
  var _initialized  = false;

  /* ── Firestore document reference ────────────────────────────────────── */

  function userDoc() {
    if (!_user || !_db) return null;
    return _db.collection('users').doc(_user.uid).collection('data').doc('sync');
  }

  /* ── Merge helpers ────────────────────────────────────────────────────── */

  function mergeProgress(local, cloud) {
    var merged = Object.assign({}, cloud || {});
    Object.keys(local || {}).forEach(function (key) {
      var lv = local[key], cv = merged[key];
      if (!cv || (lv && (lv.updatedAt || 0) >= (cv.updatedAt || 0))) {
        merged[key] = lv;
      }
    });
    return merged;
  }

  function mergeSaved(local, cloud) {
    var map = {};
    var all = (cloud || []).concat(local || []);
    all.forEach(function (item) {
      var ex = map[item.key];
      if (!ex || (item.savedAt || 0) >= (ex.savedAt || 0)) {
        map[item.key] = item;
      }
    });
    return Object.values(map).sort(function (a, b) {
      return (b.savedAt || 0) - (a.savedAt || 0);
    });
  }

  function mergeStreak(local, cloud) {
    var l = local || {};
    var c = cloud || {};
    if (!Object.keys(l).length) return c;
    if (!Object.keys(c).length) return l;

    var targetFromLocal = (l.targetUpdatedAt || l.updatedAt || 0) >= (c.targetUpdatedAt || c.updatedAt || 0);
    var sameToday = l.todayDate && l.todayDate === c.todayDate;
    var newer = (l.updatedAt || 0) >= (c.updatedAt || 0) ? l : c;
    return Object.assign({}, newer, {
      targetMinutes: targetFromLocal ? l.targetMinutes : c.targetMinutes,
      targetUpdatedAt: Math.max(l.targetUpdatedAt || 0, c.targetUpdatedAt || 0),
      todayDate: sameToday ? l.todayDate : newer.todayDate,
      todaySeconds: sameToday ? Math.max(l.todaySeconds || 0, c.todaySeconds || 0) : (newer.todaySeconds || 0),
      current: Math.max(l.current || 0, c.current || 0),
      best: Math.max(l.best || 0, c.best || 0),
      updatedAt: Math.max(l.updatedAt || 0, c.updatedAt || 0),
    });
  }

  /* ── Read / write localStorage ────────────────────────────────────────── */

  function readLocal() {
    var progress = {}, saved = [], streak = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(PROGRESS_PREFIX)) {
          try { progress[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
        }
      }
    } catch (_) {}
    try { saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (_) {}
    try { streak = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}'); } catch (_) {}
    return { progress: progress, saved: saved, streak: streak };
  }

  function writeLocal(data) {
    try {
      Object.keys(data.progress || {}).forEach(function (k) {
        localStorage.setItem(k, JSON.stringify(data.progress[k]));
      });
      if (Array.isArray(data.saved)) {
        localStorage.setItem(SAVED_KEY, JSON.stringify(data.saved));
      }
      if (data.streak) {
        localStorage.setItem(STREAK_KEY, JSON.stringify(data.streak));
      }
    } catch (_) {}
  }

  /* ── Firestore pull + merge ───────────────────────────────────────────── */

  function pullAndMerge() {
    var doc = userDoc();
    if (!doc) return Promise.resolve();
    return doc.get().then(function (snap) {
      var local = readLocal();
      var payload;
      if (snap.exists) {
        var cloud = snap.data();
        payload = {
          progress: mergeProgress(local.progress, cloud.progress || {}),
          saved:    mergeSaved(local.saved, cloud.saved || []),
          streak:   mergeStreak(local.streak, cloud.streak || {}),
        };
        writeLocal(payload);
      } else {
        payload = { progress: local.progress, saved: local.saved, streak: local.streak };
      }
      payload.lastSyncedAt = Date.now();
      return doc.set(payload);
    }).then(function () {
      notifyListeners();
    }).catch(function (err) {
      console.warn('[IMAuth] Sync pull failed:', err.message);
    });
  }

  /* ── Debounced push ───────────────────────────────────────────────────── */

  function schedulePush() {
    if (!_user) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(function () {
      var doc = userDoc();
      if (!doc) return;
      var local = readLocal();
      local.lastSyncedAt = Date.now();
      doc.set(local).catch(function (err) {
        console.warn('[IMAuth] Sync push failed:', err.message);
      }).then(function () {
        pushLeaderboardEntry(readStreak());
      });
    }, PUSH_DEBOUNCE_MS);
  }

  /* ── Notify state listeners ───────────────────────────────────────────── */

  function notifyListeners() {
    _listeners.forEach(function (fn) {
      try { fn(_user); } catch (_) {}
    });
    window.dispatchEvent(new CustomEvent('im-auth-state-changed', {
      detail: { user: _user },
    }));
  }

  function pageUrl(path) {
    return new URL(path, document.baseURI || window.location.href).href;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localDateKey(date) {
    date = date || new Date();
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function addDays(dateKey, days) {
    var parts = String(dateKey || '').split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) return '';
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    return localDateKey(date);
  }

  function isYesterday(dateKey, todayKey) {
    return addDays(dateKey, 1) === (todayKey || localDateKey());
  }

  function normalizeStreak(raw) {
    raw = raw || {};
    var today = localDateKey();
    var targetMinutes = STREAK_TARGET_OPTIONS.indexOf(Number(raw.targetMinutes)) >= 0
      ? Number(raw.targetMinutes)
      : DEFAULT_STREAK_TARGET_MINUTES;
    var targetSeconds = targetMinutes * 60;
    var todaySeconds = raw.todayDate === today ? Math.max(0, Number(raw.todaySeconds) || 0) : 0;
    var lastCompletedDate = raw.lastCompletedDate || '';
    var current = (lastCompletedDate === today || isYesterday(lastCompletedDate, today))
      ? Math.max(0, Number(raw.current) || 0)
      : 0;
    var days = {};
    var sourceDays = raw.days && typeof raw.days === 'object' ? raw.days : {};
    Object.keys(sourceDays).sort().slice(-90).forEach(function (dateKey) {
      var day = sourceDays[dateKey] || {};
      var seconds = Math.max(0, Number(day.seconds) || 0);
      days[dateKey] = {
        seconds: seconds,
        completed: Boolean(day.completed) || seconds >= targetSeconds,
      };
    });
    if (todaySeconds > 0 || lastCompletedDate === today) {
      days[today] = {
        seconds: todaySeconds,
        completed: todaySeconds >= targetSeconds || lastCompletedDate === today,
      };
    }
    return {
      targetMinutes: targetMinutes,
      todayDate: today,
      todaySeconds: todaySeconds,
      current: current,
      best: Math.max(0, Number(raw.best) || 0, current),
      lastCompletedDate: lastCompletedDate,
      days: days,
      publicOptIn: Boolean(raw.publicOptIn),
      publicName: raw.publicName || '',
      updatedAt: Number(raw.updatedAt) || 0,
      targetUpdatedAt: Number(raw.targetUpdatedAt) || 0,
    };
  }

  function readStreak() {
    try {
      return normalizeStreak(JSON.parse(localStorage.getItem(STREAK_KEY) || '{}'));
    } catch (_) {
      return normalizeStreak({});
    }
  }

  function writeStreak(streak) {
    var normalized = normalizeStreak(streak);
    normalized.updatedAt = Date.now();
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(normalized));
      schedulePush();
      updateAllStreakButtons();
      return true;
    } catch (_) {
      return false;
    }
  }

  function setStreakTarget(minutes) {
    var streak = readStreak();
    var target = STREAK_TARGET_OPTIONS.indexOf(Number(minutes)) >= 0
      ? Number(minutes)
      : DEFAULT_STREAK_TARGET_MINUTES;
    streak.targetMinutes = target;
    streak.targetUpdatedAt = Date.now();
    streak.days[streak.todayDate] = {
      seconds: streak.todaySeconds,
      completed: streak.todaySeconds >= target * 60 || streak.lastCompletedDate === streak.todayDate,
    };
    writeStreak(streak);
  }

  function formatStreakMinutes(seconds) {
    return Math.floor((Number(seconds) || 0) / 60);
  }

  function buildFlameSvg() {
    return '<svg class="streak-flame" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 2s4 4.4 4 8a4 4 0 0 1-8 0c0-1.9 1.1-3.4 2.2-4.7"/>' +
      '<path d="M6.6 10.8A7 7 0 1 0 18 8c.4 1.8-.1 3.4-1.1 4.5"/>' +
      '</svg>';
  }

  function buildEditIconSvg() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' +
      '</svg>';
  }

  function buildCheckIconSvg() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="20 6 9 17 4 12"/>' +
      '</svg>';
  }

  function buildSmallCloseIconSvg() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>' +
      '</svg>';
  }

  function buildStreakButton() {
    var btn = document.createElement('button');
    btn.className = 'nav-streak-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', function () {
      openStreakPanel('personal');
    });
    setStreakButtonState(btn);
    return btn;
  }

  function setStreakButtonState(btn) {
    if (!btn) return;
    var streak = readStreak();
    var targetSeconds = streak.targetMinutes * 60;
    var completeToday = streak.todaySeconds >= targetSeconds || streak.lastCompletedDate === streak.todayDate;
    btn.classList.toggle('is-active', streak.current > 0);
    btn.classList.toggle('is-complete', completeToday);
    btn.innerHTML = buildFlameSvg() + '<span>' + streak.current + '</span>';
    btn.setAttribute('aria-label', streak.current > 0
      ? 'Open learning streak. Current streak ' + streak.current + ' days.'
      : 'Start your daily learning streak.');
    btn.title = streak.current > 0 ? streak.current + ' day learning streak' : 'Start your daily learning streak';
  }

  function updateAllStreakButtons() {
    document.querySelectorAll('.nav-streak-btn').forEach(setStreakButtonState);
  }

  function injectStreakButton() {
    var navShell = document.querySelector('.nav-shell');
    if (!navShell || navShell.querySelector('.nav-streak-btn')) return;
    var btn = buildStreakButton();
    var navMore = navShell.querySelector('.nav-more');
    var authBtn = navShell.querySelector('.auth-btn');
    if (authBtn) {
      navShell.insertBefore(btn, authBtn);
    } else if (navMore) {
      navShell.insertBefore(btn, navMore);
    } else {
      navShell.appendChild(btn);
    }
  }

  function ensureStreakPanel() {
    var existing = document.getElementById('streak-panel');
    if (existing) return existing;

    var panel = document.createElement('div');
    panel.className = 'streak-panel is-hidden';
    panel.id = 'streak-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'streak-panel-title');
    panel.innerHTML =
      '<div class="streak-panel-backdrop" data-streak-close></div>' +
      '<section class="streak-panel-sheet">' +
        '<div class="streak-panel-head">' +
          '<div>' +
            '<p class="eyebrow">Learning rhythm</p>' +
            '<h2 id="streak-panel-title">Daily streak</h2>' +
          '</div>' +
          '<button class="streak-panel-close" type="button" aria-label="Close streak panel" data-streak-close>' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="streak-tabs" role="tablist" aria-label="Streak views">' +
          '<button type="button" role="tab" class="is-active" data-streak-tab="personal">My month</button>' +
          '<button type="button" role="tab" data-streak-tab="leaderboard">Leaderboard</button>' +
        '</div>' +
        '<div class="streak-panel-body" id="streak-panel-body"></div>' +
      '</section>';
    document.body.appendChild(panel);

    panel.addEventListener('click', function (event) {
      var close = event.target.closest('[data-streak-close]');
      if (close) closeStreakPanel();
      var tab = event.target.closest('[data-streak-tab]');
      if (tab) renderStreakPanel(tab.dataset.streakTab);
      var target = event.target.closest('[data-streak-target]');
      if (target) {
        setStreakTarget(Number(target.dataset.streakTarget));
        renderStreakPanel('personal');
      }
      var opt = event.target.closest('[data-streak-opt-in]');
      if (opt) {
        updatePublicOptIn(opt.dataset.streakOptIn === 'on');
      }
      var editBtn = event.target.closest('[data-edit-name]');
      if (editBtn) {
        startEditLeaderboardName(editBtn.closest('.leaderboard-row'));
      }
      var cancelBtn = event.target.closest('[data-cancel-name]');
      if (cancelBtn) {
        renderStreakPanel('leaderboard');
      }
    });

    panel.addEventListener('submit', function (event) {
      var form = event.target.closest('[data-edit-name-form]');
      if (!form) return;
      event.preventDefault();
      var input = form.querySelector('.leaderboard-name-input');
      saveLeaderboardName(input.value);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.classList.contains('is-hidden')) {
        closeStreakPanel();
      }
    });

    return panel;
  }

  function openStreakPanel(tabName) {
    var panel = ensureStreakPanel();
    renderStreakPanel(tabName || 'personal');
    panel.classList.remove('is-hidden');
    document.body.classList.add('streak-panel-open');
    var closeBtn = panel.querySelector('.streak-panel-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeStreakPanel() {
    var panel = document.getElementById('streak-panel');
    if (!panel) return;
    panel.classList.add('is-hidden');
    document.body.classList.remove('streak-panel-open');
  }

  function renderStreakPanel(tabName) {
    var panel = ensureStreakPanel();
    var body = panel.querySelector('#streak-panel-body');
    panel.querySelectorAll('[data-streak-tab]').forEach(function (tab) {
      var active = tab.dataset.streakTab === tabName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    if (tabName === 'leaderboard') {
      renderLeaderboard(body);
      return;
    }

    var streak = readStreak();
    var targetSeconds = streak.targetMinutes * 60;
    var todaySeconds = Math.min(streak.todaySeconds, targetSeconds);
    var percent = targetSeconds > 0 ? Math.min(100, Math.round(todaySeconds / targetSeconds * 100)) : 0;
    var complete = todaySeconds >= targetSeconds || streak.lastCompletedDate === streak.todayDate;
    var remaining = Math.max(0, Math.ceil((targetSeconds - todaySeconds) / 60));
    body.innerHTML =
      '<div class="streak-panel-summary">' +
        '<div class="streak-panel-orb ' + (streak.current > 0 ? 'is-active' : '') + '" style="--streak-progress:' + percent + '%">' +
          buildFlameSvg() +
          '<strong>' + streak.current + '</strong>' +
        '</div>' +
        '<div class="streak-panel-copy">' +
          '<small>' + (complete ? 'Goal complete today' : 'Today in progress') + '</small>' +
          '<h3>' + (streak.current > 0 ? streak.current + ' day streak' : 'Start your streak today') + '</h3>' +
          '<p>' + formatStreakMinutes(todaySeconds) + ' of ' + streak.targetMinutes + ' minutes watched today. ' +
            (complete ? 'Beautifully kept.' : remaining + ' min left to keep it going.') + '</p>' +
          '<div class="streak-panel-track" aria-label="' + percent + '% of the daily learning goal complete"><span style="width:' + percent + '%"></span></div>' +
        '</div>' +
      '</div>' +
      '<div class="streak-panel-stats">' +
        '<span><strong>' + streak.current + '</strong><small>Current</small></span>' +
        '<span><strong>' + streak.best + '</strong><small>Best</small></span>' +
        '<span><strong>' + streak.targetMinutes + '</strong><small>Daily min</small></span>' +
      '</div>' +
      '<div class="streak-target-row" aria-label="Daily streak goal">' +
        STREAK_TARGET_OPTIONS.map(function (minutes) {
          return '<button type="button" class="' + (minutes === streak.targetMinutes ? 'is-active' : '') + '" data-streak-target="' + minutes + '">' + minutes + ' min</button>';
        }).join('') +
      '</div>' +
      '<div class="streak-heatmap-wrap">' +
        '<div class="streak-heatmap-head"><strong>This month</strong><span>Filled days met your goal</span></div>' +
        '<div class="streak-heatmap" aria-label="Monthly streak heatmap">' + buildHeatmap(streak) + '</div>' +
      '</div>' +
      '<p class="streak-panel-note">Only actual lecture playback time counts. Skipping ahead does not fill the streak.</p>';
  }

  function buildHeatmap(streak) {
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth();
    var totalDays = new Date(year, month + 1, 0).getDate();
    var html = '';
    for (var day = 1; day <= totalDays; day++) {
      var date = new Date(year, month, day);
      var key = localDateKey(date);
      var item = streak.days[key] || {};
      var isFuture = date > today;
      var level = isFuture ? 'future' : item.completed ? 'complete' : item.seconds > 0 ? 'partial' : 'empty';
      var label = key + ': ' + (isFuture ? 'future day' : item.completed ? 'goal complete' : item.seconds > 0 ? formatStreakMinutes(item.seconds) + ' minutes watched' : 'no streak progress');
      html += '<span class="streak-day is-' + level + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' + day + '</span>';
    }
    return html;
  }

  function updatePublicOptIn(enabled) {
    var streak = readStreak();
    streak.publicOptIn = Boolean(enabled);
    if (enabled && !streak.publicName) {
      streak.publicName = sanitizePublicName(_user && (_user.displayName || _user.email)
        ? String(_user.displayName || _user.email).split('@')[0]
        : 'Learner');
    }
    writeStreak(streak);
    if (enabled) {
      pushLeaderboardEntry(streak);
    } else {
      deleteLeaderboardEntry();
    }
    renderStreakPanel('leaderboard');
  }

  function sanitizePublicName(value) {
    var cleaned = String(value || 'Learner')
      .replace(/[@<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    return cleaned || 'Learner';
  }

  function publicNameForUser(streak) {
    if (streak.publicName) return sanitizePublicName(streak.publicName);
    if (_user && _user.displayName) return sanitizePublicName(_user.displayName);
    return 'Learner';
  }

  function pushLeaderboardEntry(streak) {
    if (!_user || !_db || !streak.publicOptIn) return Promise.resolve();
    return _db.collection('leaderboard').doc(_user.uid).set({
      displayName: publicNameForUser(streak),
      current: Number(streak.current) || 0,
      best: Number(streak.best) || 0,
      targetMinutes: Number(streak.targetMinutes) || DEFAULT_STREAK_TARGET_MINUTES,
      lastCompletedDate: streak.lastCompletedDate || '',
      updatedAt: Date.now(),
    }, { merge: true }).catch(function (err) {
      console.warn('[IMAuth] Leaderboard update failed:', err.message);
    });
  }

  function deleteLeaderboardEntry() {
    if (!_user || !_db) return Promise.resolve();
    return _db.collection('leaderboard').doc(_user.uid).delete().catch(function (err) {
      console.warn('[IMAuth] Leaderboard delete failed:', err.message);
    });
  }

  function renderLeaderboard(body) {
    var streak = readStreak();
    var signedIn = Boolean(_user);
    body.innerHTML =
      '<div class="leaderboard-intro">' +
        '<h3>Community leaderboard</h3>' +
        '<p>Share only your display name and streak numbers. Your watch history stays private.</p>' +
      '</div>' +
      '<div class="leaderboard-opt">' +
        '<div><strong>' + (streak.publicOptIn ? 'You are sharing your streak' : 'Join the leaderboard') + '</strong>' +
        '<span>' + (signedIn ? 'You can leave whenever you want.' : 'Sign in first so your rank can follow you.') + '</span></div>' +
        '<button type="button" ' + (!signedIn ? 'disabled ' : '') + 'data-streak-opt-in="' + (streak.publicOptIn ? 'off' : 'on') + '">' +
          (streak.publicOptIn ? 'Leave' : 'Join') +
        '</button>' +
      '</div>' +
      '<div class="leaderboard-list" id="leaderboard-list">' +
        '<p class="leaderboard-empty">Loading community streaks...</p>' +
      '</div>';

    if (!_db) {
      document.getElementById('leaderboard-list').innerHTML =
        '<p class="leaderboard-empty">Leaderboard sync is still connecting. Try again in a moment.</p>';
      return;
    }

    if (streak.publicOptIn) pushLeaderboardEntry(streak);
    _db.collection('leaderboard')
      .orderBy('current', 'desc')
      .limit(25)
      .get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          rows.push(Object.assign({ id: doc.id }, doc.data()));
        });
        var list = document.getElementById('leaderboard-list');
        if (!list) return;
        if (!rows.length) {
          list.innerHTML = '<p class="leaderboard-empty">No public streaks yet. You can be among the first to start it.</p>';
          return;
        }
        list.innerHTML = rows.map(function (row, index) {
          var own = _user && row.id === _user.uid;
          var nameHtml = own
            ? '<span class="leaderboard-name-wrap">' +
                '<span class="leaderboard-name">' + escapeHtml(row.displayName || 'Learner') + ' <em>You</em></span>' +
                '<button type="button" class="leaderboard-edit-btn" data-edit-name aria-label="Edit your display name">' + buildEditIconSvg() + '</button>' +
              '</span>'
            : '<span class="leaderboard-name">' + escapeHtml(row.displayName || 'Learner') + '</span>';
          return '<div class="leaderboard-row ' + (own ? 'is-you' : '') + '">' +
            '<span class="leaderboard-rank">' + (index + 1) + '</span>' +
            nameHtml +
            '<strong>' + (Number(row.current) || 0) + ' days</strong>' +
          '</div>';
        }).join('');
      })
      .catch(function () {
        var list = document.getElementById('leaderboard-list');
        if (list) {
          list.innerHTML = '<p class="leaderboard-empty">The public leaderboard needs Firestore rules for the leaderboard collection before it can load.</p>';
        }
      });
  }

  function startEditLeaderboardName(row) {
    if (!row) return;
    var rankHtml = row.querySelector('.leaderboard-rank').outerHTML;
    var currentName = publicNameForUser(readStreak());
    row.innerHTML =
      rankHtml +
      '<form class="leaderboard-name-edit" data-edit-name-form>' +
        '<input type="text" class="leaderboard-name-input" value="' + escapeHtml(currentName) + '" maxlength="60" aria-label="Your display name" autocomplete="off" />' +
        '<button type="submit" class="leaderboard-name-save" aria-label="Save name">' + buildCheckIconSvg() + '</button>' +
        '<button type="button" class="leaderboard-name-cancel" data-cancel-name aria-label="Cancel edit">' + buildSmallCloseIconSvg() + '</button>' +
      '</form>';
    var input = row.querySelector('.leaderboard-name-input');
    input.focus();
    input.select();
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        renderStreakPanel('leaderboard');
      }
    });
  }

  function saveLeaderboardName(value) {
    var streak = readStreak();
    streak.publicName = sanitizePublicName(value);
    writeStreak(streak);
    pushLeaderboardEntry(streak).then(function () {
      renderStreakPanel('leaderboard');
    });
  }

  /* ── Auth button injection ────────────────────────────────────────────── */

  function buildAuthButton() {
    var btn = document.createElement('button');
    btn.className = 'auth-btn';
    btn.type = 'button';
    setAuthButtonState(btn);
    btn.addEventListener('click', function () {
      if (_user) {
        window.location.href = pageUrl('pages/settings.html');
      } else {
        window.location.href = pageUrl('pages/sign-in.html');
      }
    });
    return btn;
  }

  function setAuthButtonState(btn) {
    if (!btn) return;
    if (_user) {
      var name = _user.displayName || _user.email || 'Account';
      if (_user.photoURL) {
        btn.innerHTML = '<img src="' + _user.photoURL + '" alt="" class="auth-avatar" referrerpolicy="no-referrer" />';
      } else {
        btn.innerHTML = '<span class="auth-avatar auth-initials" aria-hidden="true">' +
          name[0].toUpperCase() + '</span>';
      }
      btn.setAttribute('aria-label', 'Account — ' + name);
      btn.classList.add('is-signed-in');
    } else {
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
        '<circle cx="12" cy="7" r="4"/></svg><span>Sign in</span>';
      btn.setAttribute('aria-label', 'Sign in with Google');
      btn.classList.remove('is-signed-in');
    }
  }

  function updateAllAuthButtons() {
    document.querySelectorAll('.auth-btn').forEach(setAuthButtonState);
  }

  function injectAuthButton() {
    var navShell = document.querySelector('.nav-shell');
    if (!navShell || navShell.querySelector('.auth-btn')) return;
    var btn = buildAuthButton();
    var navMore = navShell.querySelector('.nav-more');
    if (navMore) {
      navShell.insertBefore(btn, navMore);
    } else {
      navShell.appendChild(btn);
    }
  }

  /* ── Settings page wiring ─────────────────────────────────────────────── */

  function wireSettingsPage() {
    var signInBtn  = document.getElementById('settings-sign-in-btn');
    var signOutBtn = document.getElementById('settings-sign-out-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', function () {
        window.IMAuth.signIn().catch(function (err) {
          if (err.code !== 'auth/popup-closed-by-user' &&
              err.code !== 'auth/cancelled-popup-request') {
            console.warn('[IMAuth] Sign-in error:', err.message);
          }
        });
      });
    }
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        window.IMAuth.signOut();
      });
    }
  }

  function updateSettingsPanel(user) {
    var signedOut = document.getElementById('auth-signed-out');
    var signedIn  = document.getElementById('auth-signed-in');
    if (!signedOut || !signedIn) return;

    if (user) {
      signedOut.hidden = true;
      signedIn.hidden  = false;
      var photoEl = document.getElementById('auth-profile-photo');
      var nameEl  = document.getElementById('auth-profile-name');
      var emailEl = document.getElementById('auth-profile-email');
      if (photoEl) {
        if (user.photoURL) {
          photoEl.src = user.photoURL;
          photoEl.hidden = false;
        } else {
          photoEl.hidden = true;
        }
      }
      if (nameEl)  nameEl.textContent  = user.displayName || '';
      if (emailEl) emailEl.textContent = user.email || '';
    } else {
      signedOut.hidden = false;
      signedIn.hidden  = true;
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  window.IMAuth = {
    get currentUser() { return _user; },

    signIn: function () {
      if (!window.firebase) return Promise.reject(new Error('Firebase not loaded'));
      var provider = new firebase.auth.GoogleAuthProvider();
      return firebase.auth().signInWithPopup(provider);
    },

    signOut: function () {
      if (!window.firebase) return Promise.resolve();
      return firebase.auth().signOut();
    },

    onAuthStateChanged: function (fn) {
      _listeners.push(fn);
      fn(_user); // call immediately with current known state
    },

    onLocalWrite: function (key) {
      if (_user && key && (key.startsWith(PROGRESS_PREFIX) || key === SAVED_KEY || key === STREAK_KEY)) {
        schedulePush();
      }
      if (key === STREAK_KEY) {
        updateAllStreakButtons();
      }
    },
  };

  /* ── Firebase SDK loader ──────────────────────────────────────────────── */

  function initFirebase() {
    if (_initialized) return;
    _initialized = true;

    var config = {
      apiKey:            'AIzaSyDDhswD5qCyDgantteFtloqLYVBzNPE5Jc',
      authDomain:        'improving-muslim.firebaseapp.com',
      projectId:         'improving-muslim',
      storageBucket:     'improving-muslim.firebasestorage.app',
      messagingSenderId: '583479819699',
      appId:             '1:583479819699:web:657f2278614b0b78dd5fc6',
    };

    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      _db = firebase.firestore();

      firebase.auth().onAuthStateChanged(function (user) {
        _user = user;
        injectStreakButton();
        injectAuthButton();
        updateAllStreakButtons();
        updateAllAuthButtons();
        updateSettingsPanel(user);
        if (user) {
          pullAndMerge();
        } else {
          notifyListeners();
        }
      });
    } catch (err) {
      console.warn('[IMAuth] Firebase init error:', err.message);
    }
  }

  function loadSDKs(callback) {
    if (window.firebase && window.firebase.auth && window.firebase.firestore) {
      callback();
      return;
    }
    var sdks = [
      FIREBASE_BASE + 'firebase-app-compat.js',
      FIREBASE_BASE + 'firebase-auth-compat.js',
      FIREBASE_BASE + 'firebase-firestore-compat.js',
    ];
    var loaded = 0;
    sdks.forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      // Dynamic scripts execute in download order by default; force insertion
      // order so app-compat always runs before auth-compat and firestore-compat.
      s.async = false;
      s.onload = function () {
        loaded++;
        if (loaded === sdks.length) callback();
      };
      s.onerror = function () {
        console.warn('[IMAuth] Failed to load Firebase SDK:', src);
      };
      document.head.appendChild(s);
    });
  }

  /* ── Bootstrap ────────────────────────────────────────────────────────── */

  // Inject the button shell as early as possible (before Firebase loads)
  // so the nav doesn't visually shift when auth state resolves.
  function earlyInject() {
    injectStreakButton();
    injectAuthButton();
    wireSettingsPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      earlyInject();
      loadSDKs(initFirebase);
    });
  } else {
    earlyInject();
    loadSDKs(initFirebase);
  }
})();
