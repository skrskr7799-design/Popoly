import { canonicalJson } from './canonicalJson';
import { loadCampaignSave, type LoadedCampaign } from './load';
import type { CampaignSaveRepository } from './repository';
import type { DigestProvider, LoadCompatibility, PersistenceResult } from './types';

/** Export only a fully validated current revision as the portable envelope JSON. */
export async function exportCampaignSave(
  repository: CampaignSaveRepository,
  campaignId: string,
  compatibility: LoadCompatibility,
  digest?: DigestProvider,
): Promise<PersistenceResult<string>> {
  const stored = await repository.read(campaignId, 'current');
  if (!stored.ok) return stored;
  if (stored.value === null) {
    return { ok: false, error: { code: 'export.campaign_missing', message: 'The requested campaign has no current save revision.' } };
  }
  const loaded = await loadCampaignSave(stored.value, compatibility, digest);
  if (!loaded.ok) return loaded;
  return { ok: true, value: canonicalJson(loaded.value.save) };
}

/**
 * Validate an imported envelope before storage and reject ID collisions.
 * The repository's createOnly transaction closes the race between the
 * collision preflight and the actual IndexedDB write.
 */
export async function importCampaignSave(
  repository: CampaignSaveRepository,
  serialized: string,
  compatibility: LoadCompatibility,
  digest?: DigestProvider,
): Promise<PersistenceResult<LoadedCampaign>> {
  const loaded = await loadCampaignSave(serialized, compatibility, digest);
  if (!loaded.ok) return loaded;

  const current = await repository.read(loaded.value.save.campaignId, 'current');
  if (!current.ok) return current;
  const previous = await repository.read(loaded.value.save.campaignId, 'previous');
  if (!previous.ok) return previous;
  if (current.value !== null || previous.value !== null) {
    return {
      ok: false,
      error: {
        code: 'import.campaign_exists',
        message: 'A campaign with this ID already exists. Import was cancelled to prevent overwriting it.',
      },
    };
  }

  const committed = await repository.commit(loaded.value.save, { createOnly: true });
  if (!committed.ok) {
    if (committed.error.code === 'storage.campaign_exists') {
      return {
        ok: false,
        error: {
          code: 'import.campaign_exists',
          message: 'A campaign with this ID was created during import. No existing data was overwritten.',
        },
      };
    }
    return committed;
  }
  return loaded;
}
