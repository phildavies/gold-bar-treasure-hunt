var CONFIG = {
  SPREADSHEET_ID: "1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y",
  ALLOWED_QR_IDS: [],
  SHEETS: {
    SCANS: "QR_Scans",
    UNIQUE: "QR_Player_Unique",
    PLAYERS: "QR_Player_Master",
    TIERS: "Game Tiers"
  },
  COLUMNS: {
    SCANS: {
      PLAYER_ID: 1,
      QR_ID: 2,
      TIMESTAMP: 3,
      SCAN_KEY: 4,
      PLAYER_UUID: 5
    },
    PLAYERS: {
      PLAYER_UUID: 1,
      PLAYER_ID: 2,
      CREATED_AT: 5,
      LAST_SEEN_AT: 6,
      UNIQUE_SCAN_COUNT: 7,
      LAST_QR_ID: 8,
      LAST_SCAN_AT: 9
    }
  }
};

function doGet(e) {
  try {
    var action = getParam_(e, "action");

    if (action === "get_progress") {
      return json_(getProgress_(getParam_(e, "player_id") || getParam_(e, "player_uuid")));
    }

    if (action === "health") {
      validateRequiredSheets_();
      return json_({
        ok: true,
        service: "Gold Bar Treasure Hunt Scan Tracking API",
        spreadsheet_id: CONFIG.SPREADSHEET_ID,
        sheets: CONFIG.SHEETS,
        scan_key_format: "player_uuid + '_' + qr_id",
        timestamp: new Date().toISOString()
      });
    }

    return json_({ ok: false, error: "Unknown action" });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    var action = String(payload.action || "track_scan");

    if (action === "track_scan") {
      return json_(trackScan_(payload));
    }

    return json_({ ok: false, error: "Unknown action" });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function trackScan_(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    validateRequiredSheets_();

    var playerIdentity = getPlayerIdentity_(payload);
    var qrId = normalizeQR(payload.qr_id || payload.qr || payload.qrId);
    var scanKey = normalizeScanKey(playerIdentity.playerUuid, qrId);
    var now = payload.timestamp ? new Date(payload.timestamp) : new Date();

    validateQrId_(qrId);

    var scansSheet = getSheet_(CONFIG.SHEETS.SCANS);
    var existingScanKeys = getExistingNormalizedScanKeys_(scansSheet);
    var isDuplicate = existingScanKeys.indexOf(scanKey) !== -1;

    appendScan_(scansSheet, {
      playerId: playerIdentity.displayName,
      playerUuid: playerIdentity.playerUuid,
      qrId: qrId,
      timestamp: now,
      scanKey: scanKey
    });

    var progress = calculateProgress_(playerIdentity.playerUuid);
    upsertPlayerMaster_(playerIdentity, qrId, now, progress.uniqueScanCount);

    return {
      ok: true,
      player_id: playerIdentity.displayName || playerIdentity.playerUuid,
      player_uuid: playerIdentity.playerUuid,
      qr_id: qrId,
      scan_key: scanKey,
      scan_key_format: "player_uuid + '_' + qr_id",
      is_duplicate: isDuplicate,
      unique_scan_count: progress.uniqueScanCount,
      total_scan_count: progress.totalScanCount
    };
  } finally {
    lock.releaseLock();
  }
}

function getProgress_(playerIdOrUuid) {
  validateRequiredSheets_();

  var playerUuid = normalizePlayer(playerIdOrUuid);
  var progress = calculateProgress_(playerUuid);

  return {
    ok: true,
    player_id: playerUuid,
    player_uuid: playerUuid,
    unique_scan_count: progress.uniqueScanCount,
    total_scan_count: progress.totalScanCount
  };
}

function getPlayerIdentity_(payload) {
  var rawUuid = payload.player_uuid || payload.playerUuid || payload.uuid || payload.player_id;
  var playerUuid = normalizePlayer(rawUuid);
  var displayName = cleanOptionalText_(payload.player_name || payload.display_name || payload.name || "");

  if (!displayName && payload.player_uuid && payload.player_id && payload.player_uuid !== payload.player_id) {
    displayName = cleanOptionalText_(payload.player_id);
  }

  return {
    playerUuid: playerUuid,
    displayName: displayName
  };
}

function appendScan_(sheet, scan) {
  sheet.appendRow([
    scan.playerId,
    scan.qrId,
    scan.timestamp,
    scan.scanKey,
    scan.playerUuid
  ]);
}

function calculateProgress_(playerUuid) {
  var scansSheet = getSheet_(CONFIG.SHEETS.SCANS);
  var values = scansSheet.getDataRange().getValues();
  var qrIds = {};
  var totalScanCount = 0;

  for (var i = 1; i < values.length; i += 1) {
    var rowPlayerUuid = normalizeOptionalPlayer_(values[i][CONFIG.COLUMNS.SCANS.PLAYER_UUID - 1]);
    var scanKey = String(values[i][CONFIG.COLUMNS.SCANS.SCAN_KEY - 1] || "").trim();
    var qrId = normalizeOptionalQR_(values[i][CONFIG.COLUMNS.SCANS.QR_ID - 1]);

    if (!rowPlayerUuid && scanKey.indexOf("_") !== -1) {
      rowPlayerUuid = normalizeOptionalPlayer_(scanKey.split("_")[0]);
    }

    if (rowPlayerUuid === playerUuid) {
      totalScanCount += 1;
      if (qrId) {
        qrIds[qrId] = true;
      }
    }
  }

  return {
    uniqueScanCount: Object.keys(qrIds).length,
    totalScanCount: totalScanCount
  };
}

function upsertPlayerMaster_(playerIdentity, qrId, seenAt, uniqueScanCount) {
  var sheet = getSheet_(CONFIG.SHEETS.PLAYERS);
  var values = sheet.getDataRange().getValues();
  var playerUuidCol = CONFIG.COLUMNS.PLAYERS.PLAYER_UUID;

  for (var i = 1; i < values.length; i += 1) {
    if (normalizeOptionalPlayer_(values[i][playerUuidCol - 1]) === playerIdentity.playerUuid) {
      sheet.getRange(i + 1, CONFIG.COLUMNS.PLAYERS.LAST_SEEN_AT).setValue(seenAt);
      sheet.getRange(i + 1, CONFIG.COLUMNS.PLAYERS.UNIQUE_SCAN_COUNT).setValue(uniqueScanCount);
      sheet.getRange(i + 1, CONFIG.COLUMNS.PLAYERS.LAST_QR_ID).setValue(qrId);
      sheet.getRange(i + 1, CONFIG.COLUMNS.PLAYERS.LAST_SCAN_AT).setValue(seenAt);

      if (playerIdentity.displayName && !values[i][CONFIG.COLUMNS.PLAYERS.PLAYER_ID - 1]) {
        sheet.getRange(i + 1, CONFIG.COLUMNS.PLAYERS.PLAYER_ID).setValue(playerIdentity.displayName);
      }
      return;
    }
  }

  var row = [];
  row[CONFIG.COLUMNS.PLAYERS.PLAYER_UUID - 1] = playerIdentity.playerUuid;
  row[CONFIG.COLUMNS.PLAYERS.PLAYER_ID - 1] = playerIdentity.displayName;
  row[CONFIG.COLUMNS.PLAYERS.CREATED_AT - 1] = seenAt;
  row[CONFIG.COLUMNS.PLAYERS.LAST_SEEN_AT - 1] = seenAt;
  row[CONFIG.COLUMNS.PLAYERS.UNIQUE_SCAN_COUNT - 1] = uniqueScanCount;
  row[CONFIG.COLUMNS.PLAYERS.LAST_QR_ID - 1] = qrId;
  row[CONFIG.COLUMNS.PLAYERS.LAST_SCAN_AT - 1] = seenAt;

  sheet.appendRow(row);
}

function validateRequiredSheets_() {
  var missing = [];
  Object.keys(CONFIG.SHEETS).forEach(function (key) {
    if (!getSpreadsheet_().getSheetByName(CONFIG.SHEETS[key])) {
      missing.push(CONFIG.SHEETS[key]);
    }
  });

  if (missing.length) {
    throw new Error("Missing required sheet tab(s): " + missing.join(", "));
  }
}

function getExistingNormalizedScanKeys_(sheet) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, 5).getValues().map(function (row) {
    var playerUuid = normalizeOptionalPlayer_(row[CONFIG.COLUMNS.SCANS.PLAYER_UUID - 1]);
    var qrId = normalizeOptionalQR_(row[CONFIG.COLUMNS.SCANS.QR_ID - 1]);
    var scanKey = String(row[CONFIG.COLUMNS.SCANS.SCAN_KEY - 1] || "").trim();

    if (!playerUuid && scanKey.indexOf("_") !== -1) {
      playerUuid = normalizeOptionalPlayer_(scanKey.split("_")[0]);
    }

    if (!qrId && scanKey.indexOf("_") !== -1) {
      qrId = normalizeOptionalQR_(scanKey.slice(scanKey.indexOf("_") + 1));
    }

    if (!playerUuid || !qrId) {
      return "";
    }

    return normalizeScanKey(playerUuid, qrId);
  }).filter(function (scanKey) {
    return scanKey !== "";
  });
}

function validateQrId_(qrId) {
  var allowedQrIds = CONFIG.ALLOWED_QR_IDS.map(function (allowedQrId) {
    return normalizeOptionalQR_(allowedQrId);
  });

  if (allowedQrIds.length && allowedQrIds.indexOf(qrId) === -1) {
    throw new Error("Unknown QR code");
  }
}

function normalizeQR(value) {
  var cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  if (!cleanValue) {
    throw new Error("Missing qr_id");
  }

  return cleanValue;
}

function normalizePlayer(value) {
  var cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);

  if (!cleanValue) {
    throw new Error("Missing player_uuid");
  }

  return cleanValue;
}

function normalizeScanKey(playerUuid, qrId) {
  return normalizePlayer(playerUuid) + "_" + normalizeQR(qrId);
}

function normalizeOptionalQR_(value) {
  var cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  return cleanValue;
}

function normalizeOptionalPlayer_(value) {
  var cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);

  return cleanValue;
}

function cleanOptionalText_(value) {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, 120);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  return JSON.parse(e.postData.contents);
}

function getParam_(e, name) {
  return e && e.parameter ? String(e.parameter[name] || "") : "";
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name) {
  return getSpreadsheet_().getSheetByName(name);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
