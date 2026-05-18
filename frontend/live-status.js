(function (window, document) {
  "use strict";

  var container;
  var statusEl;
  var progressEl;
  var detailEl;

  function getState() {
    return (window.GoldBarTreasureHunt && window.GoldBarTreasureHunt.state) || {};
  }

  function statusLabel(state) {
    if (window.navigator && window.navigator.onLine === false) {
      return "Offline";
    }

    if (state.queueStatus === "retrying") {
      return "Retrying queued scan";
    }

    if (state.apiStatus === "submitting") {
      return state.retryAttempt > 1 ? "Retrying scan" : "Saving scan";
    }

    if (state.apiStatus === "failed" || state.apiStatus === "offline") {
      return "Scan not saved";
    }

    if (state.lastScanWasDuplicate) {
      return "Already found";
    }

    if (state.apiStatus === "ok") {
      return "Clue saved";
    }

    if (state.apiStatus === "missing_qr_id") {
      return "QR code problem";
    }

    return "Ready";
  }

  function statusClass(state) {
    if (window.navigator && window.navigator.onLine === false) {
      return "is-offline";
    }

    if (state.apiStatus === "failed" || state.apiStatus === "missing_qr_id" || state.apiStatus === "not_configured") {
      return "is-error";
    }

    if (state.queueStatus === "retrying" || state.apiStatus === "submitting") {
      return "is-pending";
    }

    if (state.lastScanWasDuplicate) {
      return "is-duplicate";
    }

    if (state.apiStatus === "ok") {
      return "is-success";
    }

    return "is-idle";
  }

  function render() {
    if (!container) {
      return;
    }

    var state = getState();
    container.className = "gb-live-status " + statusClass(state);
    statusEl.textContent = statusLabel(state);
    progressEl.textContent = "Found " + Number(state.uniqueScanCount || 0) + " clues";

    var details = [];

    if (state.qrId) {
      details.push("QR: " + state.qrId);
    }

    if (state.apiLatencyMs !== null && state.apiLatencyMs !== undefined) {
      details.push("API: " + state.apiLatencyMs + " ms");
    }

    if (state.queuedCount) {
      details.push("Queued: " + state.queuedCount);
    }

    if (state.retryAttempt > 1) {
      details.push("Retry attempt: " + state.retryAttempt);
    }

    if (state.lastScanWasDuplicate) {
      details.push("Duplicate scan");
    }

    if (state.lastError) {
      details.push(state.lastError);
    }

    detailEl.textContent = details.join(" | ");
  }

  function injectStyles() {
    if (document.getElementById("gb-live-status-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "gb-live-status-style";
    style.textContent =
      ".gb-live-status{position:fixed;left:12px;right:12px;top:12px;z-index:2147483646;padding:12px 14px;border-radius:8px;font:14px/1.35 Arial,sans-serif;color:#102018;background:#eef2f7;border:1px solid #cbd5e1;box-shadow:0 8px 24px rgba(15,23,42,.22);}" +
      ".gb-live-title{font-weight:700;font-size:16px;margin-bottom:4px;}" +
      ".gb-live-progress{font-weight:700;margin-bottom:3px;}" +
      ".gb-live-detail{font-size:12px;opacity:.86;word-break:break-word;}" +
      ".gb-live-status.is-success{background:#dcfce7;border-color:#22c55e;color:#052e16;}" +
      ".gb-live-status.is-duplicate{background:#fef3c7;border-color:#f59e0b;color:#422006;}" +
      ".gb-live-status.is-error,.gb-live-status.is-offline{background:#fee2e2;border-color:#ef4444;color:#450a0a;}" +
      ".gb-live-status.is-pending{background:#dbeafe;border-color:#3b82f6;color:#172554;}" +
      "@media (min-width:700px){.gb-live-status{left:auto;right:16px;top:16px;width:360px;}}";
    document.head.appendChild(style);
  }

  function init() {
    if (container) {
      return;
    }

    injectStyles();

    container = document.createElement("div");
    container.className = "gb-live-status is-idle";
    container.innerHTML =
      '<div class="gb-live-title"></div>' +
      '<div class="gb-live-progress">Found 0 clues</div>' +
      '<div class="gb-live-detail"></div>';

    document.body.appendChild(container);
    statusEl = container.querySelector(".gb-live-title");
    progressEl = container.querySelector(".gb-live-progress");
    detailEl = container.querySelector(".gb-live-detail");

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("goldbar:state", render);
  window.addEventListener("online", render);
  window.addEventListener("offline", render);

  window.GoldBarLiveStatus = {
    render: render
  };
})(window, document);
