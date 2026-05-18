(function (window, document) {
  "use strict";

  var STORAGE_KEY = "goldbar_debug_overlay_visible";
  var overlay;
  var body;
  var toggle;

  function getState() {
    return (window.GoldBarTreasureHunt && window.GoldBarTreasureHunt.state) || {};
  }

  function isVisible() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "false";
    } catch (error) {
      return true;
    }
  }

  function setVisible(visible) {
    try {
      window.localStorage.setItem(STORAGE_KEY, visible ? "true" : "false");
    } catch (error) {
      // Ignore private browsing storage failures.
    }

    if (body) {
      body.hidden = !visible;
    }

    if (toggle) {
      toggle.textContent = visible ? "Hide" : "Show";
    }
  }

  function row(label, value) {
    return (
      '<div class="gb-debug-row">' +
      '<span class="gb-debug-label">' +
      label +
      "</span>" +
      '<span class="gb-debug-value">' +
      String(value || "-") +
      "</span>" +
      "</div>"
    );
  }

  function render() {
    if (!body) {
      return;
    }

    var state = getState();
    var duplicate = state.lastScanWasDuplicate === true ? "duplicate" : "new/not scanned";
    var progress = Number(state.uniqueScanCount || 0) + " unique / " + Number(state.totalScanCount || 0) + " total";

    body.innerHTML =
      row("player_uuid", state.playerUuid) +
      row("qr_id", state.qrId) +
      row("API", state.apiStatus) +
      row("duplicate", duplicate) +
      row("progress", progress);
  }

  function injectStyles() {
    if (document.getElementById("gb-debug-overlay-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "gb-debug-overlay-style";
    style.textContent =
      ".gb-debug-overlay{position:fixed;left:10px;right:10px;bottom:10px;z-index:2147483647;font:12px/1.35 Arial,sans-serif;color:#f8fafc;background:rgba(15,23,42,.94);border:1px solid rgba(255,255,255,.2);border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:520px;margin:0 auto;}" +
      ".gb-debug-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.14);}" +
      ".gb-debug-title{font-weight:700;}" +
      ".gb-debug-toggle{border:1px solid rgba(255,255,255,.32);background:transparent;color:#fff;border-radius:6px;padding:4px 8px;font:12px Arial,sans-serif;}" +
      ".gb-debug-body{padding:8px 10px;}" +
      ".gb-debug-row{display:grid;grid-template-columns:92px 1fr;gap:8px;padding:2px 0;}" +
      ".gb-debug-label{color:#cbd5e1;}" +
      ".gb-debug-value{color:#fff;word-break:break-all;}" +
      "@media (min-width:700px){.gb-debug-overlay{left:auto;right:16px;bottom:16px;width:420px;margin:0;}}";
    document.head.appendChild(style);
  }

  function init() {
    if (window.GoldBarTreasureHuntConfig && window.GoldBarTreasureHuntConfig.showDebugOverlay === false) {
      return;
    }

    if (overlay) {
      return;
    }

    injectStyles();

    overlay = document.createElement("div");
    overlay.className = "gb-debug-overlay";
    overlay.innerHTML =
      '<div class="gb-debug-head">' +
      '<span class="gb-debug-title">Gold Bar scan debug</span>' +
      '<button class="gb-debug-toggle" type="button">Hide</button>' +
      "</div>" +
      '<div class="gb-debug-body"></div>';

    document.body.appendChild(overlay);
    body = overlay.querySelector(".gb-debug-body");
    toggle = overlay.querySelector(".gb-debug-toggle");

    toggle.addEventListener("click", function () {
      setVisible(body.hidden);
    });

    setVisible(isVisible());
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("goldbar:state", render);

  window.GoldBarDebugOverlay = {
    render: render,
    setVisible: setVisible
  };
})(window, document);
