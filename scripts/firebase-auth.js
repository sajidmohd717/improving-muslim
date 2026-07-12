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

  var utils = window.IMUtils || {};
  var FIREBASE_VERSION = '10.12.0';
  var FIREBASE_BASE    = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/';
  var PROGRESS_PREFIX  = utils.PROGRESS_PREFIX || 'lecture-progress:';
  var NOTES_PREFIX     = utils.NOTES_PREFIX || 'lecture-notes:';
  var SAVED_KEY        = utils.SAVED_KEY || 'improving-muslim:saved-items';
  var STREAK_KEY       = utils.STREAK_KEY || 'improving-muslim:study-streak';
  var STREAK_TARGET_MINUTES = utils.DEFAULT_STREAK_TARGET_MINUTES || 15;
  var PUSH_DEBOUNCE_MS = 3000;

  var _user         = null;
  var _db           = null;
  var _pushTimer    = null;
  var _listeners    = [];
  var _initialized  = false;
  var _authReady    = false;

  /* ── Firestore document reference ────────────────────────────────────── */

  function userDoc() {
    if (!_user || !_db) return null;
    return _db.collection('users').doc(_user.uid).collection('data').doc('sync');
  }

  /* ── Merge helpers ────────────────────────────────────────────────────── */

  // Generic "newest updatedAt wins per key" merge -- also reused for notes,
  // since both are maps of storageKey -> { ..., updatedAt }.
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

    var sameToday = l.todayDate && l.todayDate === c.todayDate;
    var newer = (l.updatedAt || 0) >= (c.updatedAt || 0) ? l : c;
    return Object.assign({}, newer, {
      targetMinutes: STREAK_TARGET_MINUTES,
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
    var progress = {}, notes = {}, saved = [], streak = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(PROGRESS_PREFIX)) {
          try { progress[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
        } else if (k && k.startsWith(NOTES_PREFIX)) {
          try { notes[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
        }
      }
    } catch (_) {}
    try { saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (_) {}
    try { streak = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}'); } catch (_) {}
    return { progress: progress, notes: notes, saved: saved, streak: streak };
  }

  function writeLocal(data) {
    try {
      Object.keys(data.progress || {}).forEach(function (k) {
        localStorage.setItem(k, JSON.stringify(data.progress[k]));
      });
      Object.keys(data.notes || {}).forEach(function (k) {
        localStorage.setItem(k, JSON.stringify(data.notes[k]));
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
          notes:    mergeProgress(local.notes, cloud.notes || {}),
          saved:    mergeSaved(local.saved, cloud.saved || []),
          streak:   mergeStreak(local.streak, cloud.streak || {}),
        };
        writeLocal(payload);
      } else {
        payload = { progress: local.progress, notes: local.notes, saved: local.saved, streak: local.streak };
      }
      payload.lastSyncedAt = Date.now();
      return doc.set(payload);
    }).then(function () {
      notifyListeners();
    }).catch(function (err) {
      console.warn('[IMAuth] Sync pull failed:', err.message);
      notifyListeners();
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
        if (window.IMStreakUI) window.IMStreakUI.pushLeaderboardEntry();
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

  function logSearchEvent(event) {
    if (!_user || !_db || !event) return Promise.resolve(false);
    var query = String(event.query || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!query) return Promise.resolve(false);
    return _db.collection('searchEvents').add({
      query: query,
      queryLower: query.toLowerCase(),
      resultCount: Math.max(0, Number(event.resultCount) || 0),
      contentType: String(event.contentType || 'all').slice(0, 30),
      category: String(event.category || 'foryou').slice(0, 60),
      userId: _user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    }).then(function () {
      return true;
    }).catch(function (err) {
      console.warn('[IMAuth] Search log failed:', err.message);
      return false;
    });
  }

  /* -- Auth button injection ----------------------------------------------- */

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
    get authReady() { return _authReady; },

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

    getFirestore: function () {
      return _db;
    },

    onLocalWrite: function (key) {
      if (_user && key && (key.startsWith(PROGRESS_PREFIX) || key.startsWith(NOTES_PREFIX) || key === SAVED_KEY || key === STREAK_KEY)) {
        schedulePush();
      }
      if (key === STREAK_KEY) {
        if (window.IMStreakUI) window.IMStreakUI.updateButtons();
      }
    },

    logSearch: logSearchEvent,

    // Permanently deletes this account's synced data (progress, notes, saved
    // items, streak, leaderboard entry) from Firestore. Does not touch
    // localStorage -- callers are expected to clear local keys separately so
    // the debounced push (which reads from localStorage) can't resurrect the
    // deleted cloud doc afterward.
    resetCloudData: function () {
      if (!_user || !_db) return Promise.reject(new Error('Not signed in'));
      clearTimeout(_pushTimer);
      var tasks = [userDoc().delete()];
      if (window.IMStreakUI) tasks.push(window.IMStreakUI.deleteLeaderboardEntry());
      return Promise.all(tasks);
    },
  };

  if (window.IMStreakUI) {
    window.IMStreakUI.configure({
      getUser: function () { return _user; },
      getDb: function () { return _db; },
    });
  }

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
        _authReady = true;
        if (window.IMStreakUI) window.IMStreakUI.injectButton();
        injectAuthButton();
        if (window.IMStreakUI) window.IMStreakUI.updateButtons();
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
    if (window.IMStreakUI) window.IMStreakUI.injectButton();
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
