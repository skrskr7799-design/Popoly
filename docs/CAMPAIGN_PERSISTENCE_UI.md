# Campaign Persistence UI

**Status:** Browser storage and JSON transfer controls connected to CampaignSession  
**Scope:** Package 3 of the first vertical slice  
**Branch:** `docs/game-foundation`

## Capabilities

- New campaigns receive an `IndexedDbCampaignSaveRepository` and can be explicitly saved.
- The archive lists local campaign IDs, scenario metadata, quarter, and last update time.
- Saved campaigns can be restored through `CampaignSession.restore`, which runs checksum, version, structural, and GameState invariant validation.
- If the current revision is invalid or missing, the restore pipeline attempts the previous valid revision and reports that recovery to the player.
- A validated campaign can be exported as canonical JSON.
- JSON imports pass the full compatibility and validation pipeline and use atomic create-only storage semantics; an import cannot overwrite a campaign with the same ID.
- The archive is accessible from both the opening screen and an active campaign.

## Storage boundaries

- Browser saves are local to the current browser profile/device through IndexedDB.
- Save remains explicit; no autosave has been introduced.
- The current and previous revision rotation and optimistic concurrency behavior remain owned by the persistence repository.
- Import/export use the existing `exportCampaignSave` and `importCampaignSave` APIs rather than duplicating serialization or checksum logic in the UI.
- The UI does not silently delete or replace saved campaigns.

## Recovery behavior

`CampaignSession.restore` delegates to `restoreCampaign`. A valid current revision is preferred. If current cannot be loaded, the previous revision is validated and restored. The player sees a recovery message and can explicitly save the restored state to establish a new current revision.

## Not yet verified

- CI checks compile the browser bundle and run persistence tests, including fake IndexedDB coverage.
- A real browser smoke test is still required for IndexedDB persistence across reload, file import/export downloads, and recovery messaging.
