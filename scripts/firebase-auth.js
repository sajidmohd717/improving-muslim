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
  var PENDING_ACCOUNT_WRITES_KEY = 'improving-muslim:pending-account-writes';
  var PUSH_DEBOUNCE_MS = 3000;

  var _user         = null;
  var _db           = null;
  var _pushTimer    = null;
  var _listeners    = [];
  var _initialized  = false;
  var _authReady    = false;
  var _syncReady    = false;
  var _unsubscribeSync = null;
  var _pendingWrites = {};
  var _resetting    = false;
  var _authGeneration = 0;
  // Keys changed locally since the last successful push. Only these are sent,
  // as a field-level merge, so a device never overwrites unrelated data another
  // device changed (no more whole-document last-write-wins).
  var _dirty        = {};
  // Saved-item keys known to exist in the cloud copy. Used to compute which
  // saved items the user *removed* locally so we can delete exactly those in
  // the cloud without touching items added on another device.
  var _lastSavedKeys = {};
  // Per-item saved changes made on this device since its last acknowledged
  // write. This is the user's intent, unlike the possibly stale whole array.
  var _savedChanges = {};

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

  // A signed-in user's click can happen before Firebase finishes restoring
  // auth/account state, or immediately before a full-page navigation. Keep a
  // small write-ahead journal so those personal-data changes survive the gap.
  function accountOwner() {
    try { return localStorage.getItem(STORAGE_OWNER_KEY) || ''; } catch (_) { return ''; }
  }

  function readPendingAccountJournal(user) {
    var journal = {};
    try { journal = JSON.parse(localStorage.getItem(PENDING_ACCOUNT_WRITES_KEY) || '{}'); } catch (_) {}
    if (!user || journal.owner !== 'user:' + user.uid || !journal.writes || typeof journal.writes !== 'object') {
      return { writes: {}, savedChanges: {} };
    }
    return {
      writes: journal.writes,
      savedChanges: journal.savedChanges && typeof journal.savedChanges === 'object' ? journal.savedChanges : {},
    };
  }

  function savedItemsByKey(raw) {
    var items;
    try { items = JSON.parse(raw || '[]'); } catch (_) { items = []; }
    var result = {};
    if (!Array.isArray(items)) return result;
    items.forEach(function (item) { if (item && item.key) result[item.key] = item; });
    return result;
  }

  function savedChangesBetween(previousRaw, currentRaw) {
    var previous = savedItemsByKey(previousRaw);
    var current = savedItemsByKey(currentRaw);
    var changes = {};
    Object.keys(previous).forEach(function (key) {
      if (!current[key]) changes[key] = null;
    });
    Object.keys(current).forEach(function (key) {
      if (!previous[key] || JSON.stringify(previous[key]) !== JSON.stringify(current[key])) changes[key] = current[key];
    });
    return changes;
  }

  function rememberPendingAccountWrite(key, previousRaw) {
    var owner = accountOwner();
    if (owner.indexOf('user:') !== 0) return;
    var journal = {};
    try { journal = JSON.parse(localStorage.getItem(PENDING_ACCOUNT_WRITES_KEY) || '{}'); } catch (_) {}
    if (journal.owner !== owner || !journal.writes || typeof journal.writes !== 'object') {
      journal = { owner: owner, writes: {} };
    }
    var currentRaw = null;
    try { currentRaw = localStorage.getItem(key); } catch (_) {}
    journal.writes[key] = currentRaw;
    if (key === SAVED_KEY) {
      if (!journal.savedChanges || typeof journal.savedChanges !== 'object') journal.savedChanges = {};
      Object.assign(journal.savedChanges, savedChangesBetween(previousRaw, currentRaw));
    }
    try { localStorage.setItem(PENDING_ACCOUNT_WRITES_KEY, JSON.stringify(journal)); } catch (_) {}
  }

  function forgetPendingAccountWrites(user, keys) {
    var journal = {};
    try { journal = JSON.parse(localStorage.getItem(PENDING_ACCOUNT_WRITES_KEY) || '{}'); } catch (_) {}
    if (!user || journal.owner !== 'user:' + user.uid || !journal.writes || typeof journal.writes !== 'object') return;
    keys.forEach(function (key) {
      delete journal.writes[key];
      if (key === SAVED_KEY) journal.savedChanges = {};
    });
    try {
      if (Object.keys(journal.writes).length) localStorage.setItem(PENDING_ACCOUNT_WRITES_KEY, JSON.stringify(journal));
      else localStorage.removeItem(PENDING_ACCOUNT_WRITES_KEY);
    } catch (_) {}
  }

  function clearPendingAccountWrites() {
    try { localStorage.removeItem(PENDING_ACCOUNT_WRITES_KEY); } catch (_) {}
  }

  function restoreGuestData() {
    var guest = {};
    try { guest = JSON.parse(localStorage.getItem(GUEST_DATA_KEY) || '{}'); } catch (_) {}
    replaceLocal(guest);
  }

  function prepareAccountStorage(user) {
    var owner = '';
    try { owner = localStorage.getItem(STORAGE_OWNER_KEY) || ''; } catch (_) {}

    // Keep the current account's cache visible while Firestore hydrates. This
    // avoids a Saved/History flash-to-empty on every page load and leaves the
    // last known account data usable if the network pull fails. A guest cache
    // or a different account's cache must still be isolated and cleared.
    if (owner === 'user:' + user.uid) return;
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

  function captureUnsyncedWrites() {
    var keys = {};
    Object.keys(_pendingWrites).forEach(function (key) { keys[key] = true; });
    Object.keys(_dirty).forEach(function (key) { keys[key] = true; });
    var captured = {};
    Object.keys(keys).forEach(function (key) {
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

  function savedArrayFromCloud(cloud) {
    if (cloud.savedItems && typeof cloud.savedItems === 'object') {
      return Object.keys(cloud.savedItems)
        .map(function (k) { return cloud.savedItems[k]; })
        .filter(Boolean)
        .sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    }
    return Array.isArray(cloud.saved) ? cloud.saved : [];
  }

  function applyAccountSnapshot(cloud, captured) {
    var savedArr = savedArrayFromCloud(cloud);
    replaceLocal({
      progress: cloud.progress || {},
      notes: cloud.notes || {},
      saved: savedArr,
      streak: cloud.streak || {},
    });
    _lastSavedKeys = {};
    savedArr.forEach(function (it) { if (it && it.key) _lastSavedKeys[it.key] = true; });
    applyPendingWrites(captured || {});
    if (captured && Object.prototype.hasOwnProperty.call(captured, SAVED_KEY) && Object.keys(_savedChanges).length) {
      var mergedSaved = {};
      savedArr.forEach(function (item) { if (item && item.key) mergedSaved[item.key] = item; });
      Object.keys(_savedChanges).forEach(function (key) {
        if (_savedChanges[key]) mergedSaved[key] = _savedChanges[key];
        else delete mergedSaved[key];
      });
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(Object.keys(mergedSaved)
          .map(function (key) { return mergedSaved[key]; })
          .sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); })));
      } catch (_) {}
    }
    if (window.IMStreakUI) window.IMStreakUI.updateButtons();
    notifyListeners();
  }

  function subscribeToAccountData(user, generation) {
    var doc = userDoc();
    if (!doc || typeof doc.onSnapshot !== 'function') return;
    if (_unsubscribeSync) _unsubscribeSync();
    _unsubscribeSync = doc.onSnapshot(function (snap) {
      if (!_user || _user.uid !== user.uid || generation !== _authGeneration || _resetting) return;
      // Local Firestore writes are already represented in localStorage. Wait
      // for the acknowledged snapshot so an intermediate cache event cannot
      // roll the UI backward.
      if (snap.metadata && snap.metadata.hasPendingWrites) return;
      // Firestore can first emit an empty/stale IndexedDB snapshot and then the
      // server result. The initial doc.get() already hydrated the best known
      // account state, so cache-only listener events must not erase it.
      if (snap.metadata && snap.metadata.fromCache) return;
      var captured = captureUnsyncedWrites();
      applyAccountSnapshot(snap.exists ? snap.data() : {}, captured);
      if (Object.keys(captured).length) schedulePush();
    }, function (err) {
      console.warn('[IMAuth] Live account sync failed:', err.message);
    });
  }

  function pullAccountData(user, generation) {
    var doc = userDoc();
    if (!doc) return Promise.resolve();
    return doc.get().then(function (snap) {
      if (!_user || _user.uid !== user.uid || generation !== _authGeneration) return;
      var pending = capturePendingWrites();
      var cloud = snap.exists ? snap.data() : {};
      applyAccountSnapshot(cloud, pending);
      _syncReady = true;
      if (Object.keys(pending).length) schedulePush();
      subscribeToAccountData(user, generation);
    }).catch(function (err) {
      // Never push an unknown local snapshot when the authoritative read
      // failed. A later page load can safely retry hydration.
      console.warn('[IMAuth] Account data pull failed:', err.message);
      notifyListeners();
    });
  }

  /* ── Debounced push ───────────────────────────────────────────────────── */

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return undefined; }
  }

  // Build a merge payload containing only the keys that changed locally.
  // Progress/notes are written per-key (added/updated keys carry their value;
  // removed keys carry FieldValue.delete()), so a merge never clobbers keys
  // this device didn't touch. Saved items move to a `savedItems` map keyed by
  // item.key for the same reason -- arrays can't be field-merged. Returns
  // { payload, committedSavedKeys } or null if nothing to send.
  function buildPushPayload(keys) {
    var del = firebase.firestore.FieldValue.delete();
    var payload = {};
    var progress = {}, notes = {};
    var touchedProgress = false, touchedNotes = false, touchedSaved = false, touchedStreak = false;

    keys.forEach(function (key) {
      if (key === SAVED_KEY) { touchedSaved = true; return; }
      if (key === STREAK_KEY) { touchedStreak = true; return; }
      var raw = null;
      try { raw = localStorage.getItem(key); } catch (_) {}
      if (key.indexOf(PROGRESS_PREFIX) === 0) {
        touchedProgress = true;
        if (raw === null) { progress[key] = del; }
        else { var pv = safeParse(raw); if (pv !== undefined) progress[key] = pv; }
      } else if (key.indexOf(NOTES_PREFIX) === 0) {
        touchedNotes = true;
        if (raw === null) { notes[key] = del; }
        else { var nv = safeParse(raw); if (nv !== undefined) notes[key] = nv; }
      }
    });

    if (touchedProgress && Object.keys(progress).length) payload.progress = progress;
    if (touchedNotes && Object.keys(notes).length) payload.notes = notes;

    var committedSavedKeys = null;
    var pushedSavedChanges = null;
    if (touchedSaved) {
      var savedItems = {};
      committedSavedKeys = Object.assign({}, _lastSavedKeys);
      pushedSavedChanges = Object.assign({}, _savedChanges);
      if (Object.keys(pushedSavedChanges).length) {
        Object.keys(pushedSavedChanges).forEach(function (key) {
          var item = pushedSavedChanges[key];
          if (item) {
            savedItems[key] = item;
            committedSavedKeys[key] = true;
          } else {
            savedItems[key] = del;
            delete committedSavedKeys[key];
          }
        });
      } else {
        // Compatibility fallback for callers that did not provide the prior
        // saved array: reconcile from the current local array and baseline.
        var items = [];
        try { items = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (_) {}
        committedSavedKeys = {};
        items.forEach(function (item) {
          if (item && item.key) { savedItems[item.key] = item; committedSavedKeys[item.key] = true; }
        });
        Object.keys(_lastSavedKeys).forEach(function (k) {
          if (!committedSavedKeys[k]) savedItems[k] = del;
        });
      }
      payload.savedItems = savedItems;
      // Retire the legacy whole-array field so it can't shadow the map later.
      payload.saved = del;
    }

    if (touchedStreak) {
      var streak = safeParse(localStorage.getItem(STREAK_KEY) || '{}');
      if (streak && typeof streak === 'object') payload.streak = streak;
    }

    if (!Object.keys(payload).length) return null;
    return { payload: payload, committedSavedKeys: committedSavedKeys, savedChanges: pushedSavedChanges };
  }

  function pushNow() {
    clearTimeout(_pushTimer);
    _pushTimer = null;
    if (!_user || !_syncReady || _resetting) return;
    var doc = userDoc();
    if (!doc) return;
    var keys = Object.keys(_dirty);
    if (!keys.length) return;
    _dirty = {}; // cleared up front; re-added on failure so the retry is exact
    var built = buildPushPayload(keys);
    if (!built) return;
    if (built.savedChanges) _savedChanges = {};
    built.payload.lastSyncedAt = Date.now();
    doc.set(built.payload, { merge: true }).then(function () {
      if (built.committedSavedKeys) _lastSavedKeys = built.committedSavedKeys;
      var committedKeys = [];
      keys.forEach(function (key) {
        if (!_dirty[key]) {
          delete _pendingWrites[key];
          committedKeys.push(key);
        }
      });
      forgetPendingAccountWrites(_user, committedKeys);
      if (window.IMStreakUI) window.IMStreakUI.pushLeaderboardEntry();
    }).catch(function (err) {
      keys.forEach(function (k) { _dirty[k] = true; });
      if (built.savedChanges) _savedChanges = Object.assign({}, built.savedChanges, _savedChanges);
      console.warn('[IMAuth] Sync push failed:', err.message);
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

    onLocalWrite: function (key, previousRaw) {
      var personalKey = key && (key.startsWith(PROGRESS_PREFIX) || key.startsWith(NOTES_PREFIX) || key === SAVED_KEY || key === STREAK_KEY);
      // IMAuth is available before the Firebase SDK/auth callback completes.
      // Journal writes made in that startup window when this browser cache is
      // already owned by an account, as well as normal signed-in writes.
      if (key === SAVED_KEY && personalKey) {
        var currentRaw = null;
        try { currentRaw = localStorage.getItem(key); } catch (_) {}
        Object.assign(_savedChanges, savedChangesBetween(previousRaw, currentRaw));
      }
      if (personalKey && (!_authReady || _user)) rememberPendingAccountWrite(key, previousRaw);
      if (_user && personalKey) {
        _dirty[key] = true;
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
        _dirty = {};
        _lastSavedKeys = {};
        _savedChanges = {};
        clearPendingAccountWrites();
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

      // Enable IndexedDB offline persistence. This is essential for a
      // multi-page site: every navigation is a full reload, so a debounced
      // push (or a pagehide-flushed doc.set) that hasn't finished its network
      // round-trip would otherwise be discarded when the page tears down --
      // and the next page's authoritative doc.get() would overwrite local with
      // the stale pre-write snapshot, silently dropping a just-made save,
      // progress update, note, or history clear. With persistence, the pending
      // mutation is durable across reloads (re-sent on the next load) and the
      // authoritative pull's doc.get() returns the local view with that pending
      // write already overlaid, so cloud authority no longer clobbers unsynced
      // local changes. Must be called before any other Firestore use.
      // synchronizeTabs lets multiple open tabs share one persistence layer;
      // if it can't be enabled (old browser, private mode), we fall back to the
      // previous in-memory behaviour.
      try {
        _db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
          console.warn('[IMAuth] Offline persistence unavailable:', err.code || err.message);
        });
      } catch (err) {
        console.warn('[IMAuth] Offline persistence not supported:', err.message);
      }

      firebase.auth().onAuthStateChanged(function (user) {
        var generation = ++_authGeneration;
        var journal = user ? readPendingAccountJournal(user) : { writes: {}, savedChanges: {} };
        var journalWrites = journal.writes;
        clearTimeout(_pushTimer);
        if (_unsubscribeSync) {
          _unsubscribeSync();
          _unsubscribeSync = null;
        }
        _user = user;
        _authReady = true;
        _syncReady = false;
        _pendingWrites = {};
        _dirty = {};
        _lastSavedKeys = {};
        _savedChanges = Object.assign({}, journal.savedChanges);
        if (user) prepareAccountStorage(user);
        else {
          clearPendingAccountWrites();
          activateGuestStorage();
        }
        if (user && Object.keys(journalWrites).length) {
          applyPendingWrites(journalWrites);
          Object.keys(journalWrites).forEach(function (key) {
            _pendingWrites[key] = true;
            _dirty[key] = true;
          });
        }
        if (window.IMStreakUI) window.IMStreakUI.injectButton();
        injectAuthButton();
        if (!user && window.IMStreakUI) window.IMStreakUI.updateButtons();
        updateAllAuthButtons();
        updateSettingsPanel(user);
        // Announce the auth state immediately so UI that only depends on
        // signed-in-vs-guest (e.g. the "Synced across your devices" storage
        // note on History/Saved) updates right away, instead of waiting on --
        // or being stranded by -- the Firestore data pull, which can be slow
        // on a cold SDK/network and can even skip its own notify on a rapid
        // second auth callback. The pull then fires a second notification once
        // the cloud data lands so lists re-render with it.
        notifyListeners();
        if (user) pullAccountData(user, generation);
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
