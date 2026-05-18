var CONFIG = {
  SPREADSHEET_ID: "PASTE_GOOGLE_SHEET_ID_HERE",
  ALLOWED_QR_IDS: [],
  SHEETS: {
    SCANS: "scans",
    PLAYERS: "players"
  }
};

function doGet(e) {
  try {
    var action = getParam_(e, "action");

    if (action === "get_progress") {
      return json_(getProgress_(getParam_(e, "player_id")));
    }

    if (action === "health") {
      ensureSheets_();
      return json_({
        ok: true,
        service: "Gold Bar Treasure Hunt Scan Tracking API",
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
    var playerId = cleanId_(payload.player_id, "player_id");
    var qrId = cleanId_(payload.qr_id, "qr_id");
    var scanKey = playerId + "_" + qrId;
    var now = payload.timestamp ? new Date(payload.timestamp) : new Date();

    validateQrId_(qrId);
    ensureSheets_();

    var scansSheet = getSheet_(CONFIG.SHEETS.SCANS);
    var playersSheet = getSheet_(CONFIG.SHEETS.PLAYERS);
    var existingKeys = getColumnValues_(scansSheet, 4);
    var isDuplicate = existingKeys.indexOf(scanKey) !== -1;
    var uniqueScanCount = countUniqueScans_(playerId) + (isDuplicate ? 0 : 1);
    var totalScanCount = countTotalScans_(playerId) + 1;

    scansSheet.appendRow([
      now,
      playerId,
      qrId,
      scanKey,
      isDuplicate,
      uniqueScanCount,
      totalScanCount,
      payload.page_url || "",
      payload.user_agent || ""
    ]);

    upsertPlayer_(playersSheet, {
      playerId: playerId,
      firstSeen: now,
      lastSeen: now,
      uniqueScanCount: uniqueScanCount,
      totalScanCount: totalScanCount
    });

    return {
      ok: true,
      player_id: playerId,
      qr_id: qrId,
      scan_key: scanKey,
      is_duplicate: isDuplicate,
      unique_scan_count: uniqueScanCount,
      total_scan_count: totalScanCount
    };
  } finally {
    lock.releaseLock();
  }
}

function getProgress_(playerId) {
  var cleanPlayerId = cleanId_(playerId, "player_id");
  ensureSheets_();

  return {
    ok: true,
    player_id: cleanPlayerId,
    unique_scan_count: countUniqueScans_(cleanPlayerId),
    total_scan_count: countTotalScans_(cleanPlayerId)
  };
}

function ensureSheets_() {
  var ss = getSpreadsheet_();

  ensureSheet_(ss, CONFIG.SHEETS.SCANS, [
    "timestamp",
    "player_id",
    "qr_id",
    "scan_key",
    "is_duplicate",
    "unique_scan_count",
    "total_scan_count",
    "page_url",
    "user_agent"
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.PLAYERS, [
    "player_id",
    "first_seen",
    "last_seen",
    "unique_scan_count",
    "total_scan_count"
  ]);
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var hasHeaders = firstRow.some(function (value) {
    return String(value || "").trim() !== "";
  });

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function upsertPlayer_(sheet, player) {
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]) === player.playerId) {
      sheet.getRange(i + 1, 3, 1, 3).setValues([[
        player.lastSeen,
        player.uniqueScanCount,
        player.totalScanCount
      ]]);
      return;
    }
  }

  sheet.appendRow([
    player.playerId,
    player.firstSeen,
    player.lastSeen,
    player.uniqueScanCount,
    player.totalScanCount
  ]);
}

function countUniqueScans_(playerId) {
  var scansSheet = getSheet_(CONFIG.SHEETS.SCANS);
  var values = scansSheet.getDataRange().getValues();
  var qrIds = {};

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][1]) === playerId && String(values[i][4]).toLowerCase() !== "true") {
      qrIds[String(values[i][2])] = true;
    }
  }

  return Object.keys(qrIds).length;
}

function countTotalScans_(playerId) {
  var scansSheet = getSheet_(CONFIG.SHEETS.SCANS);
  var values = scansSheet.getDataRange().getValues();
  var count = 0;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][1]) === playerId) {
      count += 1;
    }
  }

  return count;
}

function getColumnValues_(sheet, columnNumber) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, columnNumber, lastRow - 1, 1).getValues().map(function (row) {
    return String(row[0] || "");
  });
}

function validateQrId_(qrId) {
  if (CONFIG.ALLOWED_QR_IDS.length && CONFIG.ALLOWED_QR_IDS.indexOf(qrId) === -1) {
    throw new Error("Unknown QR code");
  }
}

function cleanId_(value, label) {
  var cleanValue = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  if (!cleanValue) {
    throw new Error("Missing " + label);
  }

  return cleanValue;
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
