/* Auth navigation and Settings-page rendering, independent of Firebase I/O. */
(function () {
  'use strict';

  var options = {
    getUser: function () { return null; },
    getSyncStatus: function () { return 'local'; },
    signIn: function () { return Promise.reject(new Error('Authentication is not ready')); },
    signOut: function () { return Promise.resolve(); },
  };
  var settingsWired = false;

  function configure(nextOptions) {
    options = Object.assign({}, options, nextOptions || {});
  }

  function pageUrl(path) {
    return new URL(path, document.baseURI || window.location.href).href;
  }

  function setButtonState(button) {
    if (!button) return;
    var user = options.getUser();
    if (user) {
      var name = user.displayName || user.email || 'Account';
      button.innerHTML = user.photoURL
        ? '<img src="' + user.photoURL + '" alt="" class="auth-avatar" referrerpolicy="no-referrer" />'
        : '<span class="auth-avatar auth-initials" aria-hidden="true">' + name[0].toUpperCase() + '</span>';
      button.setAttribute('aria-label', 'Account — ' + name);
      button.classList.add('is-signed-in');
    } else {
      button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
        '<circle cx="12" cy="7" r="4"/></svg><span>Sign in</span>';
      button.setAttribute('aria-label', 'Sign in with Google');
      button.classList.remove('is-signed-in');
    }
  }

  function buildButton() {
    var button = document.createElement('button');
    button.className = 'auth-btn';
    button.type = 'button';
    setButtonState(button);
    button.addEventListener('click', function () {
      window.location.href = pageUrl(options.getUser() ? 'pages/settings.html' : 'pages/sign-in.html');
    });
    return button;
  }

  function updateButtons() {
    document.querySelectorAll('.auth-btn').forEach(setButtonState);
  }

  function injectButton() {
    var navShell = document.querySelector('.nav-shell');
    if (!navShell || navShell.querySelector('.auth-btn')) return;
    var button = buildButton();
    var navMore = navShell.querySelector('.nav-more');
    if (navMore) navShell.insertBefore(button, navMore);
    else navShell.appendChild(button);
  }

  function wireSettingsPage() {
    if (settingsWired) return;
    settingsWired = true;
    var signInButton = document.getElementById('settings-sign-in-btn');
    var signOutButton = document.getElementById('settings-sign-out-btn');
    if (signInButton) {
      signInButton.addEventListener('click', function () {
        options.signIn().catch(function (error) {
          if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            console.warn('[IMAuth] Sign-in error:', error.message);
          }
        });
      });
    }
    if (signOutButton) signOutButton.addEventListener('click', options.signOut);
  }

  function updateSyncIndicator() {
    var status = document.getElementById('auth-sync-status');
    if (!status || !options.getUser()) return;
    var copy = {
      connecting: 'Connecting to your synced learning data…',
      syncing: 'Saving your latest changes…',
      offline: 'Saved on this device. Your changes will sync when the connection returns.',
      synced: 'Your learning progress is synced across devices.',
    };
    var syncStatus = options.getSyncStatus();
    status.textContent = copy[syncStatus] || copy.connecting;
    status.dataset.syncStatus = syncStatus;
  }

  function updateSettingsPanel(user) {
    var signedOut = document.getElementById('auth-signed-out');
    var signedIn = document.getElementById('auth-signed-in');
    if (!signedOut || !signedIn) return;
    var localProgress = document.getElementById('local-progress-section');
    if (localProgress) localProgress.hidden = Boolean(user);
    if (!user) {
      signedOut.hidden = false;
      signedIn.hidden = true;
      return;
    }

    signedOut.hidden = true;
    signedIn.hidden = false;
    var photo = document.getElementById('auth-profile-photo');
    var name = document.getElementById('auth-profile-name');
    var email = document.getElementById('auth-profile-email');
    if (photo) {
      if (user.photoURL) {
        photo.src = user.photoURL;
        photo.hidden = false;
      } else {
        photo.hidden = true;
      }
    }
    if (name) name.textContent = user.displayName || '';
    if (email) email.textContent = user.email || '';
    updateSyncIndicator();
  }

  window.IMAuthUI = {
    configure: configure,
    injectButton: injectButton,
    updateButtons: updateButtons,
    wireSettingsPage: wireSettingsPage,
    updateSettingsPanel: updateSettingsPanel,
    updateSyncIndicator: updateSyncIndicator,
  };
})();
