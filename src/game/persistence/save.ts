import { validateGameState } from '../domain/invariants';
import type { GameState } from '../domain/types';
import { calculateSaveChecksum, sha256Digest } from './checksum';
import { canonicalJson } from './canonicalJson';
import { asPersistenceError } from './decode';
import type { CampaignSaveV1, DigestProvider, PersistenceResult, SaveMetadata } from './types';
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION } from './types';

export async function createCampaignSave(
  state: GameState,
  metadata: SaveMetadata,
  digest: DigestProvider = sha256Digest,
): Promise<PersistenceResult<CampaignSaveV1>> {
  try {
    const issues = validateGameState(state);
    if (issues.length > 0) {
      return { ok: false, error: { code: 'save.state_invalid', message: 'Cannot save an invalid GameState.', issues } };
    }
    if (!metadata.campaignId.trim() || !metadata.simulationVersion.trim() ||
        !Number.isFinite(Date.parse(metadata.createdAt)) || !Number.isFinite(Date.parse(metadata.updatedAt)) ||
        Date.parse(metadata.updatedAt) < Date.parse(metadata.createdAt)) {
      return { ok: false, error: { code: 'save.metadata_invalid', message: 'Campaign identity, timestamps, or simulation version are invalid.' } };
    }
    const payload = {
      format: SAVE_FORMAT,
      saveSchemaVersion: SAVE_SCHEMA_VERSION,
      simulationVersion: metadata.simulationVersion,
      campaignId: metadata.campaignId,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      scenarioId: state.scenarioId,
      scenarioVersion: state.scenarioVersion,
      gameStateSchemaVersion: state.schemaVersion,
      quarter: state.quarter,
      state: structuredClone(state),
    } satisfies Omit<CampaignSaveV1, 'checksum'>;
    const checksum = await calculateSaveChecksum(payload, digest);
    return { ok: true, value: { ...payload, checksum } };
  } catch (error) {
    return { ok: false, error: asPersistenceError(error, 'save.creation_failed') };
  }
}

export function serializeCampaignSave(save: CampaignSaveV1): string {
  return canonicalJson(save);
}
