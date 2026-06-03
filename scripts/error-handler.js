/**
 * Global error handler.
 * Registered before any other scripts so it catches crashes in script.js,
 * watch-page.js, history-page.js, etc.
 * Shows a friendly in-page fallback instead of a blank page.
 */
(function () {
  var _shown = false;

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

  function handle(src) {
    /* Ignore errors from third-party origins (browser extensions, CDNs) */
    if (src && src.length &&
        src.indexOf(location.hostname) === -1 &&
        src.indexOf('localhost') === -1) {
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  window.onerror = function (_msg, src) {
    handle(src);
    return false; /* keep the error visible in DevTools */
  };

  window.addEventListener('unhandledrejection', function () {
    handle(location.href);
  });
})();
