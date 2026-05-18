(function (window, document) {
  "use strict";

  var LOG_PREFIX = "[GoldBarTreasureHunt]";
  var DEFAULT_CONFIG = {
    apiUrl: "",
    albatoWebhookUrl: "",
    debug: true,
    testMode: true,
    requestTimeoutMs: 12000,
    retryCount: 1,
    retryDelayMs: 1500,
    enableOfflineQueue: true,
    enableVibration: true,
    selectors: {
      playerForm: "[data-gb-player-form]",
      playerInput: "[data-gb-player-input]",
      playerDisplay: "[data-gb-player-display]",
      progressText: "[data-gb-progress]",
      messageBox: "[data-gb-message]"
    }
  };

  var state = {
    initialized: false,
    playerUuid: "",
    playerId: "",
    qrId: "",
    apiStatus: "idle",
    uniqueScanCount: 0,
    totalScanCount: 0,
    lastScanWasDuplicate: false,
    lastResponse: null,
    lastError: "",
    apiLatencyMs: null,
    retryAttempt: 0,
    queuedCount: 0,
    queueStatus: "idle"
  };

  var QUEUE_STORAGE_KEY = "goldbar_pending_scans";

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

  function shouldLog() {
    var config = getConfig();
    return config.debug !== false || config.testMode === true;
  }

  function log(message, data) {
    if (!shouldLog()) {
      return;
    }

    if (data !== undefined) {
      window.console.log(LOG_PREFIX, message, data);
    } else {
      window.console.log(LOG_PREFIX, message);
    }
  }

  function warn(message, data) {
    if (!shouldLog()) {
      return;
    }

    if (data !== undefined) {
      window.console.warn(LOG_PREFIX, message, data);
    } else {
      window.console.warn(LOG_PREFIX, message);
    }
  }

  function groupLog(title, data) {
    if (!shouldLog()) {
      return;
    }

    if (window.console.groupCollapsed) {
      window.console.groupCollapsed(LOG_PREFIX + " " + title);
      window.console.log(data);
      window.console.groupEnd();
    } else {
      log(title, data);
    }
  }

  function notifyStateChange() {
    window.dispatchEvent(new CustomEvent("goldbar:state", { detail: state }));
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = window.AbortController ? new window.AbortController() : null;
    var timeoutId = null;
    var requestOptions = options || {};

    if (controller) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, timeoutMs || DEFAULT_CONFIG.requestTimeoutMs);
      requestOptions.signal = controller.signal;
    }

    return window.fetch(url, requestOptions).finally(function () {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    });
  }

  function postJsonWithRetry(url, payload, config) {
    var attempts = Number(config.retryCount || 0) + 1;

    function attempt(attemptNumber) {
      groupLog("scan submitted", {
        attempt: attemptNumber,
        max_attempts: attempts,
        payload: payload
      });
      state.retryAttempt = attemptNumber;
      notifyStateChange();

      var startedAt = Date.now();
      return fetchWithTimeout(
        url,
        {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        },
        config.requestTimeoutMs
      )
        .then(function (response) {
          state.apiLatencyMs = Date.now() - startedAt;
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          return response.json();
        })
        .catch(function (error) {
          if (attemptNumber < attempts && (!window.navigator || window.navigator.onLine !== false)) {
            warn("scan attempt failed; retrying", {
              attempt: attemptNumber,
              error: String(error.message || error)
            });
            return sleep(config.retryDelayMs || DEFAULT_CONFIG.retryDelayMs).then(function () {
              return attempt(attemptNumber + 1);
            });
          }

          throw error;
        });
    }

    return attempt(1);
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function cleanQrId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);
  }

  function showMessage(message, type) {
    var config = getConfig();
    var selector = config.selectors && config.selectors.messageBox;
    var box = selector ? document.querySelector(selector) : null;

    state.lastError = type === "error" ? message : "";

    if (box) {
      box.textContent = message || "";
      box.dataset.gbMessageType = type || "info";
      box.hidden = !message;
    }

    notifyStateChange();
  }

  function updatePlayerUi(config) {
    var display = document.querySelector(config.selectors.playerDisplay);
    var input = document.querySelector(config.selectors.playerInput);

    if (display) {
      display.textContent = state.playerId || state.playerUuid || "No player set";
    }

    if (input && !input.value) {
      input.value = state.playerId || "";
    }
  }

  function updateProgressUi(config) {
    var progress = document.querySelector(config.selectors.progressText);

    groupLog("progress count", {
      unique_scan_count: state.uniqueScanCount,
      total_scan_count: state.totalScanCount
    });

    if (progress) {
      progress.textContent = "Found " + state.uniqueScanCount + " clues";
      progress.dataset.gbUniqueScans = String(state.uniqueScanCount);
      progress.dataset.gbTotalScans = String(state.totalScanCount);
    }

    notifyStateChange();
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
      .catch(function (error) {
        warn("Albato mirror failed", { error: String(error.message || error) });
      });
  }

  function readQueue() {
    try {
      return JSON.parse(window.localStorage.getItem(QUEUE_STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeQueue(queue) {
    try {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      warn("offline queue write failed", { error: String(error.message || error) });
    }

    state.queuedCount = queue.length;
    state.queueStatus = queue.length ? "queued" : "idle";
    notifyStateChange();
  }

  function queueScan(payload, reason) {
    var config = getConfig();

    if (config.enableOfflineQueue === false) {
      return;
    }

    var queue = readQueue();
    var exists = queue.some(function (item) {
      return item.scan_key === payload.player_uuid + "_" + payload.qr_id;
    });

    if (!exists) {
      queue.push({
        scan_key: payload.player_uuid + "_" + payload.qr_id,
        payload: payload,
        queued_at: new Date().toISOString(),
        reason: reason || "offline"
      });
      writeQueue(queue);
    }
  }

  function flushQueue() {
    var config = getConfig();
    var queue = readQueue();

    if (!queue.length || !config.apiUrl || (window.navigator && window.navigator.onLine === false)) {
      state.queuedCount = queue.length;
      notifyStateChange();
      return Promise.resolve();
    }

    state.queueStatus = "retrying";
    state.queuedCount = queue.length;
    notifyStateChange();

    var item = queue[0];
    return postJsonWithRetry(config.apiUrl, item.payload, config)
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.error || "Queued scan failed");
        }

        queue.shift();
        writeQueue(queue);
        applyScanResult(config, result);
        return flushQueue();
      })
      .catch(function (error) {
        state.queueStatus = "retry_failed";
        warn("queued scan retry failed", { error: String(error.message || error) });
        notifyStateChange();
      });
  }

  function vibrateSuccess(config) {
    if (config.enableVibration === false || !window.navigator || !window.navigator.vibrate) {
      return;
    }

    if (!state.lastScanWasDuplicate) {
      window.navigator.vibrate(80);
    }
  }

  function applyScanResult(config, result) {
    state.apiStatus = "ok";
    state.uniqueScanCount = Number(result.unique_scan_count || 0);
    state.totalScanCount = Number(result.total_scan_count || 0);
    state.lastScanWasDuplicate = Boolean(result.is_duplicate);
    state.lastResponse = result;
    state.retryAttempt = 0;

    groupLog("API response", result);

    if (state.lastScanWasDuplicate) {
      groupLog("duplicate detected", {
        player_uuid: state.playerUuid,
        qr_id: state.qrId,
        scan_key: result.scan_key
      });
      showMessage("Duplicate scan. This clue was already saved for this player.", "info");
    } else {
      showMessage("Clue saved.", "success");
    }

    updateProgressUi(config);
    vibrateSuccess(config);
  }

  function buildScanPayload() {
    return {
      action: "track_scan",
      player_uuid: state.playerUuid,
      player_id: state.playerId,
      qr_id: state.qrId,
      timestamp: new Date().toISOString(),
      page_url: window.location.href,
      user_agent: window.navigator.userAgent
    };
  }

  function sendScan(config) {
    if (!config.apiUrl) {
      state.apiStatus = "not_configured";
      warn("missing API URL");
      showMessage("Tracking is not configured yet.", "error");
      return Promise.resolve();
    }

    if (!state.qrId) {
      state.apiStatus = "missing_qr_id";
      warn("missing qr_id");
      showMessage("This page is missing a QR code ID.", "error");
      return Promise.resolve();
    }

    if (!state.playerUuid) {
      state.apiStatus = "missing_player_uuid";
      warn("missing player_uuid");
      showMessage("Could not create a player ID on this device. Please try another browser.", "error");
      return Promise.resolve();
    }

    if (window.navigator && window.navigator.onLine === false) {
      state.apiStatus = "offline";
      warn("offline before scan submission");
      queueScan(buildScanPayload(), "offline");
      showMessage("You appear to be offline. Reconnect and reload this page to save the clue.", "error");
      return Promise.resolve();
    }

    var payload = buildScanPayload();

    state.apiStatus = "submitting";
    state.apiLatencyMs = null;
    notifyStateChange();

    return postJsonWithRetry(config.apiUrl, payload, config)
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.error || "Tracking failed");
        }

        applyScanResult(config, result);
        sendAlbatoMirror(config, payload);
      })
      .catch(function (error) {
        state.apiStatus = "failed";
        warn("API failure", { error: String(error.message || error) });
        if (window.navigator && window.navigator.onLine === false) {
          queueScan(payload, "offline_after_attempt");
        }
        showMessage("Connection problem. The clue is visible, but tracking did not save. Try again with stronger signal.", "error");
      });
  }

  function loadProgress(config) {
    if (!config.apiUrl || !state.playerUuid) {
      updateProgressUi(config);
      return Promise.resolve();
    }

    if (window.navigator && window.navigator.onLine === false) {
      warn("offline before progress lookup");
      updateProgressUi(config);
      return Promise.resolve();
    }

    var url =
      config.apiUrl +
      "?action=get_progress&player_uuid=" +
      encodeURIComponent(state.playerUuid) +
      "&cache_bust=" +
      encodeURIComponent(Date.now());

    return fetchWithTimeout(url, { method: "GET", mode: "cors" }, config.requestTimeoutMs)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (result) {
        groupLog("API response", result);
        if (result.ok) {
          state.apiStatus = "progress_loaded";
          state.uniqueScanCount = Number(result.unique_scan_count || 0);
          state.totalScanCount = Number(result.total_scan_count || 0);
        }
        updateProgressUi(config);
      })
      .catch(function (error) {
        warn("progress lookup failed", { error: String(error.message || error) });
        updateProgressUi(config);
      });
  }

  function bindPlayerForm(config) {
    var form = document.querySelector(config.selectors.playerForm);
    var input = document.querySelector(config.selectors.playerInput);

    if (!form || !input) {
      warn("player form not found; display name remains optional");
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      state.playerId = window.GoldBarPlayer.setDisplayName(input.value);
      updatePlayerUi(config);
      showMessage("Display name saved. Tracking this clue now.", "success");
      loadProgress(config).then(function () {
        return sendScan(config);
      });
    });
  }

  function init() {
    var config = getConfig();

    if (state.initialized) {
      return;
    }

    if (!window.GoldBarPlayer) {
      warn("player.js is not loaded yet; retrying init");
      window.setTimeout(init, 100);
      return;
    }

    state.initialized = true;
    state.playerUuid = window.GoldBarPlayer.getPlayerUuid();
    state.playerId = window.GoldBarPlayer.getDisplayName();
    state.qrId = cleanQrId(getQueryParam("qr_id"));

    groupLog("test mode init", {
      player_uuid: state.playerUuid,
      player_id: state.playerId || null,
      qr_id: state.qrId || null,
      api_url_configured: Boolean(config.apiUrl)
    });

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

  window.addEventListener("online", function () {
    log("browser online");
    showMessage("Connection restored. Reload this page if a scan did not save.", "info");
    flushQueue();
  });

  window.addEventListener("offline", function () {
    state.apiStatus = "offline";
    warn("browser offline");
    showMessage("You are offline. Scans cannot save until connection returns.", "error");
  });

  window.GoldBarTreasureHunt = {
    state: state,
    init: init,
    getQueryParam: getQueryParam,
    cleanQrId: cleanQrId,
    sendScan: sendScan,
    flushQueue: flushQueue,
    readQueue: readQueue,
    getConfig: getConfig
  };

  state.queuedCount = readQueue().length;
  notifyStateChange();
})(window, document);
