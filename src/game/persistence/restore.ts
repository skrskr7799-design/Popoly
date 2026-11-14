import { loadCampaignSave } from './load';
import type { CampaignSaveRepository } from './repository';
import type { DigestProvider, LoadCompatibility, PersistenceError, PersistenceResult } from './types';
import type { LoadedCampaign } from './load';

export interface RestoredCampaign extends LoadedCampaign {
  recoveredFromPrevious: boolean;
  currentRevisionError?: PersistenceError;
}

export async function restoreCampaign(
  repository: CampaignSaveRepository,
  campaignId: string,
  compatibility: LoadCompatibility,
  digest?: DigestProvider,
): Promise<PersistenceResult<RestoredCampaign>> {
  const currentRead = await repository.read(campaignId, 'current');
  if (!currentRead.ok) return currentRead;
  const currentSerialized = currentRead.value;
  let currentError: PersistenceError | undefined;

  if (currentSerialized !== null) {
    const current = await loadCampaignSave(currentSerialized, compatibility, digest);
    if (current.ok) {
      return { ok: true, value: { ...current.value, recoveredFromPrevious: false } };
    }
    currentError = current.error;
  } else {
    currentError = { code: 'save.current_missing', message: 'The current campaign revision is missing.' };
  }

  const previousRead = await repository.read(campaignId, 'previous');
  if (!previousRead.ok) return previousRead;
  if (previousRead.value === null) {
    return {
      ok: false,
      error: {
        code: 'save.recovery_unavailable',
        message: `The current campaign revision is unavailable (${currentError.message}) and no previous revision exists.`,
      },
    };
  }

  const previous = await loadCampaignSave(previousRead.value, compatibility, digest);
  if (!previous.ok) {
    return {
      ok: false,
      error: {
        code: 'save.recovery_failed',
        message: `Neither campaign revision could be restored. Current: ${currentError.message} Previous: ${previous.error.message}`,
      },
    };
  }
  return {
    ok: true,
    value: {
      ...previous.value,
      recoveredFromPrevious: true,
      currentRevisionError: currentError,
    },
  };
}
