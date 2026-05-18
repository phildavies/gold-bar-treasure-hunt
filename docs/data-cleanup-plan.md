# Data Cleanup And Standardization Plan

Target spreadsheet:

```text
https://docs.google.com/spreadsheets/d/1AdVgrGRQjc-cisIOE6Bx55RHLFmP9NqThOFBFC2Uq3Y/edit
```

Focus tabs:

- `QR_Scans`
- `QR_Player_Unique`
- `QR_Player_Master`

No live Sheet rows should be deleted or edited automatically during this phase.

## Current Issues

### QR_Scans

Observed from current live data:

- 178 data rows.
- 67 rows contain encoded/Albato placeholder payload values such as `{%882501:...%}`.
- 83 rows are incomplete for production logic because they are missing `qr_id`, `scan_key`, or `player_uuid`.
- 53 rows contain mixed-case QR IDs.
- 94 rows share scan keys with other rows, which is expected for repeated scans but must not count as unique progress.
- 0 rows inspected had leading/trailing spaces in `qr_id`, but trimming should still be enforced.

Examples of inconsistent QR IDs:

```text
BirdBath01
birdbath01
birdbaths01
WindChimes01
windchimes01
GreenGoldFountain01
SlateFountain01
Bell01
Letsgo
Test02
```

### QR_Player_Unique

Observed from current live data:

- 100 data rows.
- 19 rows contain encoded/Albato placeholder payload values.
- 20 rows are bad or formula-error affected, including `#REF!` or placeholder content.
- 54 rows contain mixed-case scan keys.

Current purpose appears to be a unique scan rollup using `scan_key` as the primary key.

Risk:

- If formulas rely on mixed-case scan keys, new normalized scan keys may not visually match older rows unless formulas also normalize data.

### QR_Player_Master

Observed from current live data:

- 22 data rows.
- 1 row has a blank `player_uuid`.
- 3 duplicate player UUID rows were found:
  - `9070ea41-6394-4333-aa59-940a86eb4d6a`
  - `0de220d1-9529-4a45-89cb-af2fff1be1be`
  - `81d0fed9-67d5-454e-8705-39ca99c078e2`
- 1 row contains encoded/placeholder data.
- Header row includes a `#REF!` column name from previous formula breakage.

Risk:

- Duplicate player rows can make staff reports confusing.
- Reward/tier formulas should not be trusted until scan tracking is stable.

## Normalization Rules

### QR ID

All future QR IDs must be normalized before writing:

```text
trim spaces
lowercase
allow only a-z, 0-9, underscore, hyphen
max length 80
```

Examples:

```text
BirdBath01       -> birdbath01
 WindChimes01   -> windchimes01
Green Gold 01   -> greengold01
```

### Player UUID

All future player UUIDs must be normalized before writing:

```text
trim spaces
lowercase
allow only a-z, 0-9, underscore, hyphen
max length 120
```

The frontend now generates and persists `player_uuid`. `player_id` is only an optional display name.

### Scan Key

All future scan keys must be generated as:

```text
player_uuid + "_" + normalized_qr_id
```

Example:

```text
9070ea41-6394-4333-aa59-940a86eb4d6a_windchimes01
```

## Backend Changes

`backend/apps-script.js` now includes:

- `normalizeQR()`
- `normalizePlayer()`
- `normalizeScanKey()`

Future scans are normalized before:

- duplicate detection
- writing to `QR_Scans`
- progress counting
- updating `QR_Player_Master`

Duplicate detection now normalizes historical rows during comparison, so a new scan for `windchimes01` can match older `WindChimes01` rows for the same player UUID.

## What Should Remain

Keep these rows in place:

- Valid historical scan rows with a real `player_uuid`, real `qr_id`, and usable `scan_key`.
- Duplicate scan rows, because they are useful audit/history records.
- Player rows with real UUIDs in `QR_Player_Master`, even if they were test users, until a backup exists.
- `Game Tiers` as-is.

## What Should Be Archived

Archive, rather than delete:

- Rows containing `{%882501:...%}` placeholders.
- Rows where `player_uuid` is blank and cannot be reconstructed.
- Rows where `qr_id` is blank or encoded.
- Obvious test rows such as `test_test`, `testQR`, `Test02`, or `birdbath-live-test-01` after testing is complete.
- Duplicate `QR_Player_Master` rows after choosing the row with the best/latest data.

Recommended archive approach:

1. Duplicate the entire spreadsheet.
2. Add filter views to identify malformed rows.
3. Copy malformed rows into archive tabs:
   - `Archive_QR_Scans_Malformed`
   - `Archive_QR_Player_Unique_Malformed`
   - `Archive_QR_Player_Master_Duplicates`
4. Hide archive tabs, do not delete them.
5. Only then clean active reporting formulas.

## What Logic Should Ignore

Production logic should ignore rows that:

- have blank `player_uuid`
- have blank `qr_id`
- contain `{%` or `%}` placeholder payload fragments
- produce a blank normalized QR ID
- produce a blank normalized player UUID

Duplicate rows in `QR_Scans` should not be ignored entirely; they should be logged but not counted as unique progress.

## Safe Migration Strategy

### Phase 1: Stop New Mess

Already implemented:

- normalize all future QR IDs
- normalize all future player UUIDs
- generate scan keys consistently
- keep writing to the existing `QR_Scans` columns A:E
- update only safe progress columns in `QR_Player_Master`

### Phase 2: Add Review Columns

Do not overwrite current values yet. Add optional helper columns later:

```text
normalized_qr_id
normalized_player_uuid
normalized_scan_key
row_status
cleanup_notes
```

Use formulas first, not destructive edits.

### Phase 3: Filter And Archive

Create filter views:

- encoded payload rows
- blank UUID rows
- blank QR rows
- test rows
- duplicate player rows

Move copies of these rows to archive tabs. Keep originals until the team confirms reporting is correct.

### Phase 4: Repair Rollups

After archive review:

- Repair `QR_Player_Unique` formulas to use normalized values.
- Repair or remove the `#REF!` column in `QR_Player_Master`.
- Decide whether reward/tier formulas should stay in Sheets or move into Apps Script.

## Rollback Precautions

Before any manual cleanup:

1. Duplicate the Google Sheet.
2. Export `QR_Scans` as CSV.
3. Export `QR_Player_Master` as CSV.
4. Record the Apps Script deployment version.
5. Test cleanup in the duplicate sheet first.
6. Keep archive tabs hidden, not deleted.

Rollback path:

- Restore formulas from the duplicate sheet.
- Restore archived rows from archive tabs.
- Redeploy the previous Apps Script version if needed.

## Production Readiness Rule

The live dataset is stable enough for production only when:

- all new `QR_Scans` rows have lowercase `qr_id`
- all new `scan_key` values use normalized QR IDs
- all new rows have `player_uuid`
- duplicate scans return `is_duplicate: true`
- unique progress counts do not increase on duplicate scans
- staff can inspect `QR_Scans` without needing to decode placeholder payload rows
