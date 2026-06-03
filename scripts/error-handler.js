/**
 * Global error handler.
 * Registered before any other scripts so it catches crashes in script.js,
 * watch-page.js, history-page.js, etc.
 * Shows a friendly in-page fallback instead of a blank page and silently
 * reports the error to contact@improvingmuslim.com via FormSubmit.
 */
(function () {
  var _shown = false;
  var _reported = false;

  function report(msg, src) {
    if (_reported) return;
    _reported = true;

    var payload = new FormData();
    payload.set('_subject', 'Site error: ' + location.pathname);
    payload.set('_template', 'box');
    payload.set('page', location.href);
    payload.set('error', msg || '(no message)');
    payload.set('source', src || '(unknown)');
    payload.set('browser', navigator.userAgent);

    /* Fire-and-forget — we don't surface failures to the user */
    fetch('https://formsubmit.co/ajax/contact@improvingmuslim.com', {
      method: 'POST',
      body: payload,
      headers: { Accept: 'application/json' },
    }).catch(function () { /* silent */ });
  }

  function inject() {
    if (_shown) return;
    _shown = true;
    var main = document.querySelector('main');
    if (!main) return;

    main.innerHTML =
      '<section class="error-fallback" role="alert" aria-live="assertive">' +
        '<p class="error-fallback-icon" aria-hidden="true">&#9888;</p>' +
        '<h2 class="error-fallback-title">Something went wrong</h2>' +
        '<p class="error-fallback-body">' +
          'A script didn\'t load correctly. This can happen when a browser ' +
          'extension is interfering, when storage access is restricted, or on a ' +
          'slow connection. Try refreshing — it usually fixes it.' +
        '</p>' +
        '<div class="error-fallback-actions">' +
          '<button class="primary-link" onclick="location.reload()">Refresh the page</button>' +
          '<a class="quiet-link" href="/">Go to home</a>' +
        '</div>' +
      '</section>';
  }

  function handle(msg, src) {
    /* Ignore errors from third-party origins (browser extensions, CDNs) */
    if (src && src.length &&
        src.indexOf(location.hostname) === -1 &&
        src.indexOf('localhost') === -1) {
      return;
    }
    report(msg, src);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  window.onerror = function (msg, src) {
    handle(msg, src);
    return false; /* keep the error visible in DevTools */
  };

  window.addEventListener('unhandledrejection', function (event) {
    var msg = event.reason && event.reason.message ? event.reason.message : String(event.reason);
    handle(msg, location.href);
  });
})();
