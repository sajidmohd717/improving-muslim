/**
 * Firebase Authentication + Firestore sync for Improving Muslim.
 *
 * - Self-loads the Firebase compat SDK from Google CDN (no extra <script> tags needed).
 * - Injects a sign-in / avatar button into every .nav-shell automatically.
 * - On sign-in: the account's Firestore data replaces the personal-data cache.
 *   Guest/browser data is kept separately and never merged into an account.
 * - On every localStorage write (via IMUtils.writeJsonStorage): debounces a push to Firestore.
 * - On sign-out: restores the isolated guest/browser data snapshot.
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
  var STORAGE_OWNER_KEY = 'improving-muslim:personal-data-owner';
  var GUEST_DATA_KEY    = 'improving-muslim:guest-personal-data';
  var PUSH_DEBOUNCE_MS = 3000;

  var _user         = null;
  var _db           = null;
  var _pushTimer    = null;
  var _listeners    = [];
  var _initialized  = false;
  var _authReady    = false;
  var _syncReady    = false;
  var _pendingWrites = {};
  var _resetting    = false;
  var _authGeneration = 0;

  /* ── Firestore document reference ────────────────────────────────────── */

  function userDoc() {
    if (!_user || !_db) return null;
    return _db.collection('users').doc(_user.uid).collection('data').doc('sync');
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

  function clearLocal() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.startsWith(PROGRESS_PREFIX) || key.startsWith(NOTES_PREFIX) ||
            key === SAVED_KEY || key === STREAK_KEY)) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (_) {}
  }

  function replaceLocal(data) {
    clearLocal();
    writeLocal(data || {});
  }

  function saveGuestData() {
    try { localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(readLocal())); } catch (_) {}
  }

  function restoreGuestData() {
    var guest = {};
    try { guest = JSON.parse(localStorage.getItem(GUEST_DATA_KEY) || '{}'); } catch (_) {}
    replaceLocal(guest);
  }

  function prepareAccountStorage(user) {
    var owner = '';
    try { owner = localStorage.getItem(STORAGE_OWNER_KEY) || ''; } catch (_) {}

    // Preserve only genuine guest data. A cache belonging to any account is
    // discarded before the next account is hydrated.
    if (!owner || owner === 'guest') saveGuestData();
    clearLocal();
    try { localStorage.setItem(STORAGE_OWNER_KEY, 'user:' + user.uid); } catch (_) {}
  }

  function activateGuestStorage() {
    var owner = '';
    try { owner = localStorage.getItem(STORAGE_OWNER_KEY) || ''; } catch (_) {}
    if (owner.indexOf('user:') === 0) restoreGuestData();
    try { localStorage.setItem(STORAGE_OWNER_KEY, 'guest'); } catch (_) {}
  }

  function capturePendingWrites() {
    var captured = {};
    Object.keys(_pendingWrites).forEach(function (key) {
      try { captured[key] = localStorage.getItem(key); } catch (_) { captured[key] = null; }
    });
    return captured;
  }

  function applyPendingWrites(captured) {
    Object.keys(captured).forEach(function (key) {
      try {
        if (captured[key] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, captured[key]);
      } catch (_) {}
    });
  }

  /* ── Authoritative Firestore pull ─────────────────────────────────────── */

  function pullAccountData(user, generation) {
    var doc = userDoc();
    if (!doc) return Promise.resolve();
    return doc.get().then(function (snap) {
      if (!_user || _user.uid !== user.uid || generation !== _authGeneration) return;
      var pending = capturePendingWrites();
      var cloud = snap.exists ? snap.data() : {};
      replaceLocal({
        progress: cloud.progress || {},
        notes: cloud.notes || {},
        saved: Array.isArray(cloud.saved) ? cloud.saved : [],
        streak: cloud.streak || {},
      });
      applyPendingWrites(pending);
      _syncReady = true;
      if (Object.keys(pending).length) schedulePush();
      if (window.IMStreakUI) window.IMStreakUI.updateButtons();
      notifyListeners();
    }).catch(function (err) {
      // Never push an unknown local snapshot when the authoritative read
      // failed. A later page load can safely retry hydration.
      console.warn('[IMAuth] Account data pull failed:', err.message);
      notifyListeners();
    });
  }

  /* ── Debounced push ───────────────────────────────────────────────────── */

  function pushNow() {
    clearTimeout(_pushTimer);
    _pushTimer = null;
    if (!_user || !_syncReady || _resetting) return;
    var doc = userDoc();
    if (!doc) return;
    var local = readLocal();
    local.lastSyncedAt = Date.now();
    doc.set(local).catch(function (err) {
      console.warn('[IMAuth] Sync push failed:', err.message);
    }).then(function () {
      if (window.IMStreakUI) window.IMStreakUI.pushLeaderboardEntry();
    });
  }

  function schedulePush() {
    if (!_user || !_syncReady || _resetting) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
  }

  // This is a plain multi-page site: every navigation is a full page load,
  // so a pending debounced push (up to PUSH_DEBOUNCE_MS old) never fires --
  // setTimeout does not survive navigation. The next page then wipes local
  // storage and re-pulls the stale (pre-write) Firestore snapshot, silently
  // discarding whatever was just saved (e.g. a save/progress/note made just
  // before clicking to another page). "pagehide" fires reliably right as the
  // browser commits to leaving this page (navigation, tab close, or bfcache
  // eviction -- see error-handler.js's matching pageshow/persisted handling)
  // without the false positives "visibilitychange" gets from ordinary tab
  // switching/backgrounding, where the existing timer is still fine to wait out.
  window.addEventListener('pagehide', function () {
    if (_pushTimer) pushNow();
  });

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
    var localProgress = document.getElementById('local-progress-section');
    if (localProgress) localProgress.hidden = Boolean(user);

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
        if (_syncReady) schedulePush();
        else _pendingWrites[key] = true;
      }
      if (key === STREAK_KEY) {
        if (window.IMStreakUI) window.IMStreakUI.updateButtons();
      }
    },

    logSearch: logSearchEvent,

    // Delete cloud data and its local cache as one operation, with pushes
    // suspended so the deleted snapshot cannot be resurrected.
    resetCloudData: function () {
      if (!_user || !_db) return Promise.reject(new Error('Not signed in'));
      clearTimeout(_pushTimer);
      _resetting = true;
      ++_authGeneration; // invalidate any account pull already in flight
      var accountDelete = userDoc().delete().then(function () {
        clearLocal();
        _pendingWrites = {};
        _syncReady = true;
        notifyListeners();
      });
      var tasks = [accountDelete];
      if (window.IMStreakUI) tasks.push(window.IMStreakUI.deleteLeaderboardEntry());
      return Promise.all(tasks).finally(function () {
        _resetting = false;
      });
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
        var generation = ++_authGeneration;
        clearTimeout(_pushTimer);
        _user = user;
        _authReady = true;
        _syncReady = false;
        _pendingWrites = {};
        if (user) prepareAccountStorage(user);
        else activateGuestStorage();
        if (window.IMStreakUI) window.IMStreakUI.injectButton();
        injectAuthButton();
        if (!user && window.IMStreakUI) window.IMStreakUI.updateButtons();
        updateAllAuthButtons();
        updateSettingsPanel(user);
        if (user) {
          pullAccountData(user, generation);
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
