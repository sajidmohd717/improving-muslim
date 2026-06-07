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

  /* ── Read / write localStorage ────────────────────────────────────────── */

  function readLocal() {
    var progress = {}, saved = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(PROGRESS_PREFIX)) {
          try { progress[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
        }
      }
    } catch (_) {}
    try { saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (_) {}
    return { progress: progress, saved: saved };
  }

  function writeLocal(data) {
    try {
      Object.keys(data.progress || {}).forEach(function (k) {
        localStorage.setItem(k, JSON.stringify(data.progress[k]));
      });
      if (Array.isArray(data.saved)) {
        localStorage.setItem(SAVED_KEY, JSON.stringify(data.saved));
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
        };
        writeLocal(payload);
      } else {
        payload = { progress: local.progress, saved: local.saved };
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
      });
    }, PUSH_DEBOUNCE_MS);
  }

  /* ── Notify state listeners ───────────────────────────────────────────── */

  function notifyListeners() {
    _listeners.forEach(function (fn) {
      try { fn(_user); } catch (_) {}
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
        // Resolve settings URL relative to current page's base
        var base = document.querySelector('base');
        var href = base ? base.href : '/';
        window.location.href = new URL('pages/settings.html', href).href;
      } else {
        window.IMAuth.signIn().catch(function (err) {
          if (err.code !== 'auth/popup-closed-by-user' &&
              err.code !== 'auth/cancelled-popup-request') {
            console.warn('[IMAuth] Sign-in error:', err.message);
          }
        });
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
        '<circle cx="12" cy="7" r="4"/></svg>';
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
      if (_user && key && (key.startsWith(PROGRESS_PREFIX) || key === SAVED_KEY)) {
        schedulePush();
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
        injectAuthButton();
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
