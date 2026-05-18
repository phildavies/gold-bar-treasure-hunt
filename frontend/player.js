(function (window) {
  "use strict";

  var UUID_STORAGE_KEY = "goldbar_treasure_player_uuid";
  var LEGACY_PLAYER_ID_KEY = "goldbar_treasure_player_id";
  var DISPLAY_NAME_STORAGE_KEY = "goldbar_treasure_player_display_name";
  var LOG_PREFIX = "[GoldBarTreasureHunt]";

  function log(message, data) {
    if (window.GoldBarTreasureHuntConfig && window.GoldBarTreasureHuntConfig.debug === false) {
      return;
    }

    if (data !== undefined) {
      window.console.log(LOG_PREFIX, message, data);
    } else {
      window.console.log(LOG_PREFIX, message);
    }
  }

  function normalizePlayerId(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 120);
  }

  function normalizeDisplayName(value) {
    return String(value || "")
      .trim()
      .replace(/[<>]/g, "")
      .slice(0, 120);
  }

  function createPlayerUuid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    var datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var randomPart = Math.random().toString(36).slice(2, 12);
    return "gb-" + datePart + "-" + randomPart;
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key) || readCookie(key);
    } catch (error) {
      log("localStorage read unavailable", { key: key, error: String(error.message || error) });
      return readCookie(key);
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      writeCookie(key, value);
      return true;
    } catch (error) {
      log("localStorage write unavailable", { key: key, error: String(error.message || error) });
      writeCookie(key, value);
      return Boolean(readCookie(key));
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // localStorage can be unavailable in private browsing modes.
    }
    writeCookie(key, "", -1);
  }

  function readCookie(key) {
    var prefix = encodeURIComponent(key) + "=";
    var parts = String(document.cookie || "").split("; ");

    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].indexOf(prefix) === 0) {
        return decodeURIComponent(parts[i].slice(prefix.length));
      }
    }

    return "";
  }

  function writeCookie(key, value, days) {
    var maxAge = days && days < 0 ? 0 : 60 * 60 * 24 * (days || 365);
    document.cookie =
      encodeURIComponent(key) +
      "=" +
      encodeURIComponent(value || "") +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  function getPlayerUuid() {
    var playerUuid = normalizePlayerId(readStorage(UUID_STORAGE_KEY));
    var legacyPlayerId = normalizePlayerId(readStorage(LEGACY_PLAYER_ID_KEY));

    if (!playerUuid && legacyPlayerId) {
      playerUuid = legacyPlayerId;
      writeStorage(UUID_STORAGE_KEY, playerUuid);
      log("player_uuid migrated from legacy player_id", { player_uuid: playerUuid });
    }

    if (!playerUuid) {
      playerUuid = createPlayerUuid();
      writeStorage(UUID_STORAGE_KEY, playerUuid);
      log("player_uuid generated", { player_uuid: playerUuid });
    } else {
      log("player_uuid loaded", { player_uuid: playerUuid });
    }

    return playerUuid;
  }

  function getDisplayName() {
    var displayName = normalizeDisplayName(readStorage(DISPLAY_NAME_STORAGE_KEY));
    log("player display name loaded", { player_id: displayName || null });
    return displayName;
  }

  function setDisplayName(playerId) {
    var displayName = normalizeDisplayName(playerId);

    if (displayName) {
      writeStorage(DISPLAY_NAME_STORAGE_KEY, displayName);
      log("player display name saved", { player_id: displayName });
      return displayName;
    }

    removeStorage(DISPLAY_NAME_STORAGE_KEY);
    log("player display name cleared");
    return "";
  }

  function clearPlayer() {
    removeStorage(UUID_STORAGE_KEY);
    removeStorage(LEGACY_PLAYER_ID_KEY);
    removeStorage(DISPLAY_NAME_STORAGE_KEY);
    log("player cleared");
  }

  function createSuggestedPlayerId() {
    return getDisplayName();
  }

  window.GoldBarPlayer = {
    storageKey: UUID_STORAGE_KEY,
    uuidStorageKey: UUID_STORAGE_KEY,
    displayNameStorageKey: DISPLAY_NAME_STORAGE_KEY,
    normalizePlayerId: normalizePlayerId,
    normalizeDisplayName: normalizeDisplayName,
    getPlayerUuid: getPlayerUuid,
    getDisplayName: getDisplayName,
    setDisplayName: setDisplayName,
    clearPlayer: clearPlayer,
    createSuggestedPlayerId: createSuggestedPlayerId,
    // Backward-compatible aliases for older snippets.
    getPlayerId: getPlayerUuid,
    setPlayerId: setDisplayName,
    clearPlayerId: clearPlayer,
    log: log
  };
})(window);
