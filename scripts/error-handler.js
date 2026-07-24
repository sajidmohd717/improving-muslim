/**
 * Production error reporting and fatal-page recovery.
 *
 * Load this before every other script on monitored pages. It catches:
 *   - first-party script and stylesheet download failures,
 *   - uncaught JavaScript errors with line, column, and stack,
 *   - actionable unhandled promise rejections, and
 *   - recoverable incidents reported through window.IMErrorReporter.
 *
 * Incidents that happen together are batched into one privacy-conscious
 * FormSubmit email. Optional assets can set data-error-severity="recoverable"
 * so a failed enhancement is reported without replacing the working page.
 */
(function () {
  "use strict";

  var REPORT_ENDPOINT = "https://formsubmit.co/ajax/contact@improvingmuslim.com";
  var REPORT_DELAY_MS = 700;
  var SESSION_DEDUPE_MS = 10 * 60 * 1000;
  var MAX_EVENTS = 6;
  var currentScript = document.currentScript;
  var release = currentScript && currentScript.getAttribute("data-release")
    ? currentScript.getAttribute("data-release")
    : "unknown";

  var shown = false;
  var injectQueued = false;
  var reportTimer = null;
  var events = [];
  var sentFingerprints = {};
  var incidentId = createIncidentId();

  function truncate(value, maxLength) {
    var text = value == null ? "" : String(value);
    if (text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength - 1)) + "\u2026";
  }

  function createIncidentId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return "IM-" + window.crypto.randomUUID().split("-")[0].toUpperCase();
      }
    } catch (_) {
      // Older or restricted browsers fall through to a non-cryptographic ID.
    }
    return "IM-" + Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function absoluteUrl(value) {
    if (!value) return "";
    if (String(value).charAt(0) === "(") return String(value);
    try {
      return new URL(value, location.href).href;
    } catch (_) {
      return String(value);
    }
  }

  function isFirstPartyUrl(value) {
    if (!value) return true;
    try {
      var url = new URL(value, location.href);
      return url.origin === location.origin ||
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1";
    } catch (_) {
      return false;
    }
  }

  function isReportableHost() {
    var hostname = String(location.hostname || "").toLowerCase();
    return hostname === "improvingmuslim.com" ||
      hostname.slice(-20) === ".improvingmuslim.com" ||
      hostname === "sajidmohd717.github.io";
  }

  function sanitizedPage() {
    try {
      return location.origin + location.pathname + location.hash;
    } catch (_) {
      return String(location.href || "").split("?")[0];
    }
  }

  function queryKeys() {
    try {
      var keys = [];
      new URLSearchParams(location.search).forEach(function (_, key) {
        if (keys.indexOf(key) === -1) keys.push(key);
      });
      return keys.sort().join(", ") || "(none)";
    } catch (_) {
      return "(unavailable)";
    }
  }

  function campaignSummary() {
    try {
      var params = new URLSearchParams(location.search);
      var names = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
      var parts = [];
      names.forEach(function (name) {
        var value = params.get(name);
        if (value) parts.push(name.replace("utm_", "") + "=" + truncate(value, 80));
      });
      return parts.join("; ") || "(none)";
    } catch (_) {
      return "(unavailable)";
    }
  }

  function sanitizedReferrer() {
    if (!document.referrer) return "(direct or unavailable)";
    try {
      var url = new URL(document.referrer);
      return url.origin + url.pathname;
    } catch (_) {
      return "(unavailable)";
    }
  }

  function browserSummary() {
    var ua = navigator.userAgent || "";
    var parts = [];
    var match = ua.match(/Instagram\/([^\s]+)/i);
    if (match) parts.push("Instagram in-app browser " + match[1]);
    match = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
    if (match) parts.push("Chrome " + match[1]);
    match = ua.match(/(?:Version\/)([\d.]+).*Safari\//);
    if (!/Chrome|CriOS/.test(ua) && match) parts.push("Safari " + match[1]);
    match = ua.match(/Android\s+([\d.]+)/i);
    if (match) parts.push("Android " + match[1]);
    match = ua.match(/;\s*([^;()]+?)\s+Build\//i);
    if (match) parts.push(match[1]);
    if (/iPhone/i.test(ua)) parts.push("iPhone");
    else if (/iPad/i.test(ua)) parts.push("iPad");
    return parts.join("; ") || "Unrecognized browser";
  }

  function deviceSummary() {
    var screenSize = window.screen
      ? window.screen.width + "x" + window.screen.height
      : "unavailable";
    return [
      "viewport=" + window.innerWidth + "x" + window.innerHeight,
      "screen=" + screenSize,
      "dpr=" + (window.devicePixelRatio || 1),
      "touch=" + (navigator.maxTouchPoints || 0),
      "language=" + (navigator.language || "unknown"),
    ].join("; ");
  }

  function networkSummary() {
    var connection = navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    var parts = ["online=" + String(navigator.onLine !== false)];
    if (connection) {
      if (connection.effectiveType) parts.push("type=" + connection.effectiveType);
      if (typeof connection.downlink === "number") parts.push("downlink=" + connection.downlink + "Mbps");
      if (typeof connection.rtt === "number") parts.push("rtt=" + connection.rtt + "ms");
      if (typeof connection.saveData === "boolean") parts.push("saveData=" + connection.saveData);
    }
    return parts.join("; ");
  }

  function navigationSummary() {
    var parts = [
      "readyState=" + document.readyState,
      "visibility=" + (document.visibilityState || "unknown"),
    ];
    try {
      var navigation = performance.getEntriesByType("navigation")[0];
      if (navigation) {
        parts.push("navigation=" + navigation.type);
        parts.push("transfer=" + navigation.transferSize + "B");
      }
      parts.push("pageAge=" + Math.round(performance.now()) + "ms");
    } catch (_) {
      // Performance APIs are useful context, but never required for reporting.
    }
    return parts.join("; ");
  }

  function assetVersions() {
    var versions = [];
    try {
      Array.prototype.forEach.call(document.querySelectorAll("script[src]"), function (script) {
        var url = new URL(script.src, location.href);
        if (url.origin !== location.origin) return;
        var version = url.searchParams.get("v");
        versions.push(url.pathname + (version ? "@" + version : ""));
      });
    } catch (_) {
      return "(unavailable)";
    }
    return truncate(versions.join(", ") || "(none discovered)", 2400);
  }

  function normalizedEvent(details) {
    details = details || {};
    return {
      occurredAt: new Date().toISOString(),
      kind: truncate(details.kind || "javascript", 40),
      severity: details.severity === "recoverable" ? "recoverable" : "fatal",
      message: truncate(details.message || "(no message)", 1200),
      source: truncate(absoluteUrl(details.source) || "(unknown)", 1200),
      line: Number(details.line) || 0,
      column: Number(details.column) || 0,
      stack: truncate(details.stack || "", 5000),
      context: details.context || null,
    };
  }

  function eventSignature(event) {
    return [event.kind, event.severity, event.message, event.source, event.line, event.column].join("|");
  }

  function fingerprintFor(event) {
    var input = eventSignature(event);
    var hash = 5381;
    for (var index = 0; index < input.length; index += 1) {
      hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
    }
    return "IMF-" + (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }

  function safeSessionGet(key) {
    try {
      return Number(sessionStorage.getItem(key)) || 0;
    } catch (_) {
      return 0;
    }
  }

  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, String(value));
    } catch (_) {
      // Storage may be disabled in private or embedded browser contexts.
    }
  }

  function relatedEventSummary(related) {
    if (!related.length) return "(none)";
    return related.map(function (event, index) {
      var locationText = event.line
        ? " (" + event.source + ":" + event.line + ":" + event.column + ")"
        : " (" + event.source + ")";
      return (index + 1) + ". [" + event.severity + "/" + event.kind + "] " +
        event.message + locationText;
    }).join("\n");
  }

  function contextSummary(event) {
    if (!event.context) return "(none)";
    try {
      return truncate(JSON.stringify(event.context), 2000);
    } catch (_) {
      return "(unserializable)";
    }
  }

  function append(payload, name, value, maxLength) {
    payload.set(name, truncate(value || "(none)", maxLength || 5000));
  }

  function flushReports() {
    reportTimer = null;
    if (!events.length || !isReportableHost()) {
      events = [];
      return;
    }

    var batch = events.slice(0, MAX_EVENTS);
    events = [];
    var primary = batch[0];
    var fingerprint = fingerprintFor(primary);
    var dedupeKey = "im-error-reported:" + fingerprint;
    var now = Date.now();
    if (sentFingerprints[fingerprint] ||
        now - safeSessionGet(dedupeKey) < SESSION_DEDUPE_MS) {
      return;
    }
    sentFingerprints[fingerprint] = true;
    safeSessionSet(dedupeKey, now);

    if (typeof window.fetch !== "function" || typeof window.FormData !== "function") {
      return;
    }

    var payload = new FormData();
    payload.set("_subject", "Site " + primary.severity + " [" + primary.kind + "] " +
      location.pathname + " \u00b7 " + truncate(primary.message, 90));
    payload.set("_template", "box");
    append(payload, "incident", incidentId, 100);
    append(payload, "fingerprint", fingerprint, 100);
    append(payload, "severity", primary.severity, 40);
    append(payload, "kind", primary.kind, 40);
    append(payload, "occurred_at", primary.occurredAt, 100);
    append(payload, "release", release, 120);
    append(payload, "page", sanitizedPage(), 1200);
    append(payload, "query_keys", queryKeys(), 500);
    append(payload, "campaign", campaignSummary(), 800);
    append(payload, "referrer", sanitizedReferrer(), 1200);
    append(payload, "error", primary.message, 1600);
    append(payload, "source", primary.source, 1600);
    append(payload, "line_column", primary.line
      ? primary.line + ":" + primary.column
      : "(not supplied)", 100);
    append(payload, "stack", primary.stack || "(not supplied by browser)", 5000);
    append(payload, "context", contextSummary(primary), 2200);
    append(payload, "related_events", relatedEventSummary(batch.slice(1)), 5000);
    append(payload, "client", browserSummary(), 800);
    append(payload, "browser", navigator.userAgent || "(unknown)", 2000);
    append(payload, "device", deviceSummary(), 1000);
    append(payload, "network", networkSummary(), 1000);
    append(payload, "document", navigationSummary(), 1000);
    append(payload, "assets", assetVersions(), 2500);

    fetch(REPORT_ENDPOINT, {
      method: "POST",
      body: payload,
      headers: { Accept: "application/json" },
      keepalive: true,
    }).catch(function () {
      // Reporting must never create another visible or reportable error.
    });
  }

  function scheduleReport() {
    if (reportTimer !== null) return;
    reportTimer = window.setTimeout(flushReports, REPORT_DELAY_MS);
  }

  function fallbackCopy(kind) {
    if (kind === "resource") {
      return "A required part of the site could not be downloaded. Check your " +
        "connection and try again. If it keeps happening, open this page in " +
        "your regular browser.";
    }
    return "We couldn\u2019t start this page correctly. Your saved progress is safe. " +
      "Try refreshing the page; if the problem continues, use the reference " +
      "below when contacting us.";
  }

  function inject(kind) {
    if (shown) return;
    var main = document.querySelector("main");
    if (!main) return;
    shown = true;

    main.innerHTML =
      '<section class="error-fallback" role="alert" aria-live="assertive">' +
        '<p class="error-fallback-icon" aria-hidden="true">&#9888;</p>' +
        '<h2 class="error-fallback-title">This page didn\u2019t load completely</h2>' +
        '<p class="error-fallback-body">' + fallbackCopy(kind) +
          "<br><small>Reference: " + incidentId + "</small>" +
        "</p>" +
        '<div class="error-fallback-actions">' +
          '<button class="primary-link" type="button" data-error-retry>Try again</button>' +
          '<a class="quiet-link" href="/">Go to home</a>' +
        "</div>" +
      "</section>";

    var retry = main.querySelector("[data-error-retry]");
    if (retry) {
      retry.addEventListener("click", function () {
        location.reload();
      });
    }
  }

  function queueInjection(kind) {
    if (shown || injectQueued) return;
    if (document.readyState === "loading") {
      injectQueued = true;
      document.addEventListener("DOMContentLoaded", function () {
        injectQueued = false;
        inject(kind);
      }, { once: true });
    } else {
      inject(kind);
    }
  }

  function capture(details) {
    var event = normalizedEvent(details);
    var signature = eventSignature(event);
    var duplicate = events.some(function (queued) {
      return eventSignature(queued) === signature;
    });
    if (!duplicate && events.length < MAX_EVENTS) events.push(event);
    if (event.severity === "fatal") queueInjection(event.kind);
    scheduleReport();
    return incidentId;
  }

  function rejectionShouldBeIgnored(reason, message) {
    if (reason && reason.name === "AbortError") return true;
    var lower = String(message || "").toLowerCase();
    if (lower.indexOf("metamask") !== -1 ||
        lower.indexOf("ethereum") !== -1 ||
        lower.indexOf("wallet") !== -1 ||
        lower.indexOf("chrome-extension") !== -1 ||
        lower.indexOf("moz-extension") !== -1 ||
        lower.indexOf("safari-web-extension") !== -1) {
      return true;
    }
    if (reason && reason.name === "TypeError" &&
        (lower.indexOf("fetch") !== -1 ||
         lower.indexOf("load") !== -1 ||
         lower.indexOf("cancel") !== -1 ||
         lower.indexOf("network") !== -1)) {
      return true;
    }
    return document.hidden;
  }

  window.IMErrorReporter = {
    capture: capture,
    reportRecoverable: function (message, details) {
      details = details || {};
      details.message = message;
      details.severity = "recoverable";
      return capture(details);
    },
    incidentId: incidentId,
    release: release,
  };

  window.addEventListener("error", function (event) {
    var target = event.target;
    if (!target || target === window) return;
    var tagName = String(target.tagName || "").toLowerCase();
    var isScript = tagName === "script";
    var isStylesheet = tagName === "link" &&
      String(target.rel || "").toLowerCase() === "stylesheet";
    if (!isScript && !isStylesheet) return;

    var source = isScript ? target.src : target.href;
    if (!source || !isFirstPartyUrl(source)) return;
    var severity = target.getAttribute("data-error-severity") === "recoverable"
      ? "recoverable"
      : "fatal";
    capture({
      kind: "resource",
      severity: severity,
      message: "Failed to load " + (isScript ? "script" : "stylesheet") +
        ": " + absoluteUrl(source),
      source: source,
      context: {
        element: tagName,
        optional: severity === "recoverable",
      },
    });
  }, true);

  window.onerror = function (message, source, line, column, error) {
    if (source && !isFirstPartyUrl(source)) return false;
    if (source && source.indexOf(".js") === -1) return false;
    if (!source && String(message || "").toLowerCase() === "script error.") return false;

    capture({
      kind: error && error.name === "MissingDependencyError"
        ? "dependency"
        : "javascript",
      severity: "fatal",
      message: message,
      source: source,
      line: line,
      column: column,
      stack: error && error.stack,
      context: error && error.dependency
        ? { dependency: error.dependency, expectedAsset: error.expectedAsset || "" }
        : null,
    });
    return false;
  };

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    var message = reason && reason.message ? reason.message : String(reason);
    if (rejectionShouldBeIgnored(reason, message)) return;
    capture({
      kind: "promise",
      severity: "recoverable",
      message: message,
      source: "(unhandled rejection)",
      stack: reason && reason.stack,
    });
  });

  window.addEventListener("pagehide", function () {
    if (reportTimer !== null) {
      window.clearTimeout(reportTimer);
      flushReports();
    }
  });

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      shown = false;
      injectQueued = false;
      events = [];
      incidentId = createIncidentId();
      window.IMErrorReporter.incidentId = incidentId;
    }
  });
})();
