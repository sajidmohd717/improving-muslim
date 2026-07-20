/*
 * Watch-page stall and error handling. Exposes window.IMWatchStall.
 *
 * Diagnoses why a video failed and shows a user-facing message with a retry
 * button. Cause precedence: real MediaError > slow connection > unknown
 * stall. Stalls and errors surface a user-controlled retry; non-connection
 * causes are reported to the contact inbox so broken files get investigated.
 * A silent player.load() must never interrupt a play request or resume seek.
 *
 * watch-page.js calls IMWatchStall.init({ player, videoSrc }) BEFORE setting
 * the source and calling player.load(), so the loadstart listener is armed
 * for the first load. setVideoLoading is shared with watch-page.js, which
 * also toggles the spinner around its own load/no-video paths. Loaded on the
 * watch template before watch-page.js.
 */
(() => {
  "use strict";

  const loadingIndicator = document.querySelector("#video-loading");
  const unavailable = document.querySelector("#video-unavailable");

  function setVideoLoading(isLoading) {
    loadingIndicator?.classList.toggle("is-hidden", !isLoading);
  }

  const STALL_TIMEOUT_MS = 20_000;
  let stallTimer = null;
  let manualRetries = 0;
  let hasLoadedMetadata = false;

  function clearStallTimer() {
    if (stallTimer !== null) {
      clearTimeout(stallTimer);
      stallTimer = null;
    }
  }

  function diagnoseVideoFailure(videoEl) {
    const err = videoEl.error;
    if (err) {
      if (err.code === MediaError.MEDIA_ERR_DECODE) {
        return { cause: 'decode', heading: 'Playback error', body: 'This video has a decode error — it may be corrupted. We\'ve been notified and will look into it.' };
      }
      if (err.code === MediaError.MEDIA_ERR_NETWORK) {
        return { cause: 'network', heading: 'Network error', body: 'Couldn\'t reach this video — check your internet connection and try refreshing.' };
      }
      if (err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        return { cause: 'unsupported', heading: 'Format not supported', body: 'Your browser can\'t play this video format. Try a different browser.' };
      }
      return { cause: 'error', heading: 'Playback error', body: 'An error occurred playing this video. Please try refreshing the page.' };
    }
    const conn = navigator.connection;
    const slowConn = conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
    const hasData = videoEl.buffered.length > 0;
    // Safari and Firefox never expose navigator.connection, so a stall there is
    // most likely a connection hiccup, not a broken file.
    if (slowConn || hasData || !conn) {
      return { cause: 'slow', heading: 'Connection trouble', body: 'This is usually a connection hiccup. Check your internet and try again.' };
    }
    return { cause: 'stall', heading: 'Video couldn\'t load', body: 'This is usually a connection hiccup — try again in a moment. We\'ve also been notified in case it\'s a problem on our side.' };
  }

  function init({ player, videoSrc }) {
    function retryVideoLoad() {
      manualRetries += 1;
      hasLoadedMetadata = false;
      unavailable.classList.add("is-hidden");
      setVideoLoading(true);
      // load() fires loadstart (re-arming the stall timer) and loadedmetadata
      // (restoring the saved resume position), so no extra bookkeeping needed.
      player.load();
    }

    function reportVideoIssue(src, cause, readyState) {
      const conn = navigator.connection;
      const payload = new FormData();
      payload.set('_subject', `Video ${cause}: ` + location.pathname);
      payload.set('_template', 'box');
      payload.set('page', location.href);
      payload.set('cause', cause);
      payload.set('error', `readyState: ${readyState}, buffered: ${player.buffered.length}, errorCode: ${player.error?.code ?? 'none'}, connection: ${conn?.effectiveType ?? 'unknown'}, manualRetries: ${manualRetries}`);
      payload.set('videoSrc', src || '(unknown)');
      payload.set('browser', navigator.userAgent);
      fetch('https://formsubmit.co/ajax/contact@improvingmuslim.com', {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' },
      }).catch(() => { /* silent */ });
    }

    function showVideoError(videoEl, src) {
      const { cause, heading, body } = diagnoseVideoFailure(videoEl);
      unavailable.innerHTML = `<strong>${heading}</strong><span>${body}</span><button type="button" class="video-retry-btn">Try again</button>`;
      unavailable.querySelector(".video-retry-btn").addEventListener("click", () => {
        retryVideoLoad();
      });
      unavailable.classList.remove("is-hidden");
      // Only report issues we need to investigate; slow connections are expected
      if (cause !== 'slow') {
        reportVideoIssue(src, cause, videoEl.readyState);
      }
    }

    player.addEventListener("loadstart", () => {
      unavailable.classList.add("is-hidden");
      setVideoLoading(Boolean(videoSrc));
      hasLoadedMetadata = false;

      if (videoSrc) {
        clearStallTimer();
        stallTimer = setTimeout(() => {
          if (player.readyState < 2) {
            setVideoLoading(false);
            showVideoError(player, videoSrc);
          }
        }, STALL_TIMEOUT_MS);
      }
    });

    player.addEventListener("loadedmetadata", () => {
      hasLoadedMetadata = true;
      // Once native controls know the duration and the watch page has started
      // restoring the saved position, let the browser own any buffering UI.
      setVideoLoading(false);
    });

    player.addEventListener("waiting", () => {
      // Resume seeks and mid-playback buffering already have native feedback.
      setVideoLoading(Boolean(videoSrc) && !hasLoadedMetadata);
    });

    player.addEventListener("canplay", () => {
      clearStallTimer();
      setVideoLoading(false);
    });

    player.addEventListener("playing", () => {
      clearStallTimer();
      setVideoLoading(false);
    });

    player.addEventListener("error", () => {
      clearStallTimer();
      setVideoLoading(false);
      if (player.currentSrc) {
        showVideoError(player, player.currentSrc);
      }
    });
  }

  window.IMWatchStall = { init, setVideoLoading };
})();
