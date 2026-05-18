(function (window) {
  "use strict";

  var STORAGE_KEY = "goldbar_treasure_player_id";

  function normalizePlayerId(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80);
  }

  function getPlayerId() {
    try {
      return normalizePlayerId(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return "";
    }
  }

  function setPlayerId(playerId) {
    var cleanPlayerId = normalizePlayerId(playerId);
    if (!cleanPlayerId) {
      return "";
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, cleanPlayerId);
    } catch (error) {
      return "";
    }

    return cleanPlayerId;
  }

  function clearPlayerId() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // localStorage can be unavailable in private browsing modes.
    }
  }

  function createSuggestedPlayerId() {
    var datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return "GB-" + datePart + "-" + randomPart;
  }

  window.GoldBarPlayer = {
    storageKey: STORAGE_KEY,
    normalizePlayerId: normalizePlayerId,
    getPlayerId: getPlayerId,
    setPlayerId: setPlayerId,
    clearPlayerId: clearPlayerId,
    createSuggestedPlayerId: createSuggestedPlayerId
  };
})(window);
