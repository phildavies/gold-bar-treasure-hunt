(function (window, document) {
  "use strict";

  var DEFAULT_CONFIG = {
    apiUrl: "",
    albatoWebhookUrl: "",
    selectors: {
      playerForm: "[data-gb-player-form]",
      playerInput: "[data-gb-player-input]",
      playerDisplay: "[data-gb-player-display]",
      progressText: "[data-gb-progress]",
      messageBox: "[data-gb-message]"
    }
  };

  var state = {
    playerId: "",
    qrId: "",
    uniqueScanCount: 0,
    totalScanCount: 0,
    lastScanWasDuplicate: false
  };

  function mergeConfig(base, override) {
    var merged = {};
    Object.keys(base).forEach(function (key) {
      merged[key] = base[key];
    });

    override = override || {};
    Object.keys(override).forEach(function (key) {
      if (key === "selectors") {
        merged.selectors = mergeConfig(base.selectors || {}, override.selectors || {});
      } else {
        merged[key] = override[key];
      }
    });

    return merged;
  }

  function getConfig() {
    return mergeConfig(DEFAULT_CONFIG, window.GoldBarTreasureHuntConfig || {});
  }

  function postJson(url, payload) {
    return window.fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json();
    });
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function cleanQrId(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);
  }

  function showMessage(message, type) {
    var config = getConfig();
    var selector = config.selectors && config.selectors.messageBox;
    var box = selector ? document.querySelector(selector) : null;

    if (!box) {
      return;
    }

    box.textContent = message || "";
    box.dataset.gbMessageType = type || "info";
    box.hidden = !message;
  }

  function updatePlayerUi(config) {
    var display = document.querySelector(config.selectors.playerDisplay);
    var input = document.querySelector(config.selectors.playerInput);

    if (display) {
      display.textContent = state.playerId || "No player set";
    }

    if (input && !input.value) {
      input.value = state.playerId || window.GoldBarPlayer.createSuggestedPlayerId();
    }
  }

  function updateProgressUi(config) {
    var progress = document.querySelector(config.selectors.progressText);

    if (progress) {
      progress.textContent =
        "Unique clues found: " + state.uniqueScanCount + " | Total scans: " + state.totalScanCount;
    }
  }

  function sendAlbatoMirror(config, payload) {
    if (!config.albatoWebhookUrl) {
      return Promise.resolve();
    }

    return window
      .fetch(config.albatoWebhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      })
      .catch(function () {
        // Albato mirroring is optional during migration.
      });
  }

  function applyScanResult(config, result) {
    state.uniqueScanCount = Number(result.unique_scan_count || 0);
    state.totalScanCount = Number(result.total_scan_count || 0);
    state.lastScanWasDuplicate = Boolean(result.is_duplicate);
    updateProgressUi(config);

    if (state.lastScanWasDuplicate) {
      showMessage("This clue was already saved for this player.", "info");
    } else {
      showMessage("Clue saved.", "success");
    }
  }

  function sendScan(config) {
    if (!config.apiUrl) {
      showMessage("Tracking is not configured yet.", "error");
      return Promise.resolve();
    }

    if (!state.qrId) {
      showMessage("This page is missing a QR code ID.", "error");
      return Promise.resolve();
    }

    if (!state.playerId) {
      showMessage("Enter your player name to save this clue.", "info");
      return Promise.resolve();
    }

    var payload = {
      action: "track_scan",
      player_id: state.playerId,
      qr_id: state.qrId,
      timestamp: new Date().toISOString(),
      page_url: window.location.href,
      user_agent: window.navigator.userAgent
    };

    return postJson(config.apiUrl, payload)
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.error || "Tracking failed");
        }

        applyScanResult(config, result);
        sendAlbatoMirror(config, payload);
      })
      .catch(function () {
        showMessage("This clue is visible, but tracking did not save. Please try again with signal.", "error");
      });
  }

  function loadProgress(config) {
    if (!config.apiUrl || !state.playerId) {
      updateProgressUi(config);
      return Promise.resolve();
    }

    var url =
      config.apiUrl +
      "?action=get_progress&player_id=" +
      encodeURIComponent(state.playerId) +
      "&cache_bust=" +
      encodeURIComponent(Date.now());

    return window
      .fetch(url, { method: "GET", mode: "cors" })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.ok) {
          state.uniqueScanCount = Number(result.unique_scan_count || 0);
          state.totalScanCount = Number(result.total_scan_count || 0);
          updateProgressUi(config);
        }
      })
      .catch(function () {
        updateProgressUi(config);
      });
  }

  function bindPlayerForm(config) {
    var form = document.querySelector(config.selectors.playerForm);
    var input = document.querySelector(config.selectors.playerInput);

    if (!form || !input) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var savedPlayerId = window.GoldBarPlayer.setPlayerId(input.value);
      if (!savedPlayerId) {
        showMessage("Please enter a simple player name or code.", "error");
        return;
      }

      state.playerId = savedPlayerId;
      updatePlayerUi(config);
      showMessage("Player saved. Tracking this clue now.", "success");
      loadProgress(config).then(function () {
        return sendScan(config);
      });
    });
  }

  function init() {
    var config = getConfig();

    if (!window.GoldBarPlayer) {
      throw new Error("Load player.js before tracking.js");
    }

    state.playerId = window.GoldBarPlayer.getPlayerId();
    state.qrId = cleanQrId(getQueryParam("qr_id"));

    bindPlayerForm(config);
    updatePlayerUi(config);
    updateProgressUi(config);

    loadProgress(config).then(function () {
      return sendScan(config);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.GoldBarTreasureHunt = {
    state: state,
    init: init,
    getQueryParam: getQueryParam,
    cleanQrId: cleanQrId,
    sendScan: sendScan
  };
})(window, document);
