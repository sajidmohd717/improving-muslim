/**
 * Streak navigation button, personal streak panel, and leaderboard UI.
 *
 * Depends on window.IMUtils for streak storage/normalization, and accepts
 * auth/database accessors from firebase-auth.js when Firebase is ready.
 */
(function () {
  'use strict';

  var utils = window.IMUtils || {};
  var DEFAULT_STREAK_TARGET_MINUTES = utils.DEFAULT_STREAK_TARGET_MINUTES || 15;
  var STREAK_RANKS = utils.STREAK_RANKS || [
    { name: 'Platinum', min: 40 },
    { name: 'Silver', min: 20 },
    { name: 'Bronze', min: 10 },
    { name: 'Iron', min: 5 },
  ];
  var getStreakRank = utils.getStreakRank || function (days) {
    for (var i = 0; i < STREAK_RANKS.length; i++) {
      if ((Number(days) || 0) >= STREAK_RANKS[i].min) return STREAK_RANKS[i];
    }
    return null;
  };

  var getUser = function () { return null; };
  var getDb = function () { return null; };

  function configure(options) {
    options = options || {};
    if (typeof options.getUser === 'function') getUser = options.getUser;
    if (typeof options.getDb === 'function') getDb = options.getDb;
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
    if (utils.localDateKey) return utils.localDateKey(date);
    date = date || new Date();
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function readStreak() {
    if (utils.readStudyStreak) return utils.readStudyStreak();
    try {
      return JSON.parse(localStorage.getItem('improving-muslim:study-streak') || '{}');
    } catch (_) {
      return {};
    }
  }

  function writeStreak(streak) {
    if (utils.writeStudyStreak) return utils.writeStudyStreak(streak);
    try {
      streak.updatedAt = Date.now();
      localStorage.setItem('improving-muslim:study-streak', JSON.stringify(streak));
      updateButtons();
      return true;
    } catch (_) {
      return false;
    }
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

  function buildButton() {
    var btn = document.createElement('button');
    btn.className = 'nav-streak-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', function () {
      openPanel('personal');
    });
    setButtonState(btn);
    return btn;
  }

  function setButtonState(btn) {
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

  function updateButtons() {
    document.querySelectorAll('.nav-streak-btn').forEach(setButtonState);
  }

  function injectButton() {
    var navShell = document.querySelector('.nav-shell');
    if (!navShell || navShell.querySelector('.nav-streak-btn')) return;
    var btn = buildButton();
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

  function ensurePanel() {
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
      if (close) closePanel();
      var tab = event.target.closest('[data-streak-tab]');
      if (tab) renderPanel(tab.dataset.streakTab);
      var opt = event.target.closest('[data-streak-opt-in]');
      if (opt) updatePublicOptIn(opt.dataset.streakOptIn === 'on');
      var editBtn = event.target.closest('[data-edit-name]');
      if (editBtn) startEditLeaderboardName(editBtn.closest('.leaderboard-row'));
      var cancelBtn = event.target.closest('[data-cancel-name]');
      if (cancelBtn) renderPanel('leaderboard');
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
        closePanel();
      }
    });

    return panel;
  }

  function openPanel(tabName) {
    var panel = ensurePanel();
    renderPanel(tabName || 'personal');
    panel.classList.remove('is-hidden');
    document.body.classList.add('streak-panel-open');
    var closeBtn = panel.querySelector('.streak-panel-close');
    if (closeBtn) closeBtn.focus();
  }

  function closePanel() {
    var panel = document.getElementById('streak-panel');
    if (!panel) return;
    panel.classList.add('is-hidden');
    document.body.classList.remove('streak-panel-open');
  }

  function renderPanel(tabName) {
    var panel = ensurePanel();
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
    var rank = getStreakRank(streak.current);
    var nextRank = null;
    for (var i = STREAK_RANKS.length - 1; i >= 0; i--) {
      if (STREAK_RANKS[i].min > streak.current) { nextRank = STREAK_RANKS[i]; break; }
    }
    var rankBadgeHtml = rank
      ? ' <span class="streak-rank-badge rank-' + rank.name.toLowerCase() + '">' + rank.name + '</span>'
      : '';
    var rankNoteHtml = nextRank
      ? '<p class="streak-rank-next">' + (nextRank.min - streak.current) + ' more ' + ((nextRank.min - streak.current) === 1 ? 'day' : 'days') + ' to ' + nextRank.name + '</p>'
      : (rank ? '<p class="streak-rank-next">Highest rank reached. Beautiful consistency.</p>' : '');
    body.innerHTML =
      '<div class="streak-panel-summary">' +
        '<div class="streak-panel-orb ' + (streak.current > 0 ? 'is-active' : '') + '" style="--streak-progress:' + percent + '%">' +
          buildFlameSvg() +
          '<strong>' + streak.current + '</strong>' +
        '</div>' +
        '<div class="streak-panel-copy">' +
          '<small>' + (complete ? 'Goal complete today' : 'Today in progress') + '</small>' +
          '<h3>' + (streak.current > 0 ? streak.current + ' day streak' : 'Start your streak today') + rankBadgeHtml + '</h3>' +
          '<p>' + formatStreakMinutes(todaySeconds) + ' of ' + streak.targetMinutes + ' minutes watched today. ' +
            (complete ? 'Beautifully kept.' : remaining + ' min left to keep it going.') + '</p>' +
          '<div class="streak-panel-track" aria-label="' + percent + '% of the daily learning goal complete"><span style="width:' + percent + '%"></span></div>' +
          rankNoteHtml +
        '</div>' +
      '</div>' +
      '<div class="streak-panel-stats">' +
        '<span><strong>' + streak.current + '</strong><small>Current</small></span>' +
        '<span><strong>' + streak.best + '</strong><small>Best</small></span>' +
        '<span><strong>' + streak.freezesAvailable + '</strong><small>' + (streak.freezesAvailable === 1 ? 'Freeze' : 'Freezes') + '</small></span>' +
      '</div>' +
      '<div class="streak-heatmap-wrap">' +
        '<div class="streak-heatmap-head"><strong>This month</strong><span>Filled days met your goal</span></div>' +
        '<div class="streak-heatmap" aria-label="Monthly streak heatmap">' + buildHeatmap(streak) + '</div>' +
      '</div>' +
      '<p class="streak-panel-note">Only actual lecture playback time counts. Skipping ahead does not fill the streak. Earn 1 streak freeze every 7-day streak (up to 2 banked) - it silently covers one missed day.</p>';
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
    var user = getUser();
    streak.publicOptIn = Boolean(enabled);
    if (enabled && !streak.publicName) {
      streak.publicName = sanitizePublicName(user && (user.displayName || user.email)
        ? String(user.displayName || user.email).split('@')[0]
        : 'Learner');
    }
    writeStreak(streak);
    if (enabled) {
      pushLeaderboardEntry(streak);
    } else {
      deleteLeaderboardEntry();
    }
    renderPanel('leaderboard');
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
    var user = getUser();
    if (streak.publicName) return sanitizePublicName(streak.publicName);
    if (user && user.displayName) return sanitizePublicName(user.displayName);
    return 'Learner';
  }

  function pushLeaderboardEntry(streak) {
    streak = streak || readStreak();
    var user = getUser();
    var db = getDb();
    if (!user || !db || !streak.publicOptIn) return Promise.resolve();
    return db.collection('leaderboard').doc(user.uid).set({
      displayName: publicNameForUser(streak),
      current: Number(streak.current) || 0,
      best: Number(streak.best) || 0,
      targetMinutes: Number(streak.targetMinutes) || DEFAULT_STREAK_TARGET_MINUTES,
      lastCompletedDate: streak.lastCompletedDate || '',
      updatedAt: Date.now(),
    }, { merge: true }).catch(function (err) {
      console.warn('[IMStreakUI] Leaderboard update failed:', err.message);
    });
  }

  function deleteLeaderboardEntry() {
    var user = getUser();
    var db = getDb();
    if (!user || !db) return Promise.resolve();
    return db.collection('leaderboard').doc(user.uid).delete().catch(function (err) {
      console.warn('[IMStreakUI] Leaderboard delete failed:', err.message);
    });
  }

  function renderLeaderboard(body) {
    var streak = readStreak();
    var user = getUser();
    var db = getDb();
    var signedIn = Boolean(user);
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

    if (!db) {
      document.getElementById('leaderboard-list').innerHTML =
        '<p class="leaderboard-empty">Leaderboard sync is still connecting. Try again in a moment.</p>';
      return;
    }

    if (streak.publicOptIn) pushLeaderboardEntry(streak);
    db.collection('leaderboard')
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
          var own = user && row.id === user.uid;
          var nameHtml = own
            ? '<span class="leaderboard-name-wrap">' +
                '<span class="leaderboard-name">' + escapeHtml(row.displayName || 'Learner') + ' <em>You</em></span>' +
                '<button type="button" class="leaderboard-edit-btn" data-edit-name aria-label="Edit your display name">' + buildEditIconSvg() + '</button>' +
              '</span>'
            : '<span class="leaderboard-name">' + escapeHtml(row.displayName || 'Learner') + '</span>';
          var rowRank = getStreakRank(Number(row.current) || 0);
          var rowRankHtml = rowRank
            ? '<span class="streak-rank-badge rank-' + rowRank.name.toLowerCase() + '">' + rowRank.name + '</span>'
            : '';
          return '<div class="leaderboard-row ' + (own ? 'is-you' : '') + '">' +
            '<span class="leaderboard-rank">' + (index + 1) + '</span>' +
            nameHtml +
            rowRankHtml +
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
        renderPanel('leaderboard');
      }
    });
  }

  function saveLeaderboardName(value) {
    var streak = readStreak();
    streak.publicName = sanitizePublicName(value);
    writeStreak(streak);
    pushLeaderboardEntry(streak).then(function () {
      renderPanel('leaderboard');
    });
  }

  window.IMStreakUI = {
    configure: configure,
    injectButton: injectButton,
    updateButtons: updateButtons,
    openPanel: openPanel,
    pushLeaderboardEntry: pushLeaderboardEntry,
    deleteLeaderboardEntry: deleteLeaderboardEntry,
  };
})();
