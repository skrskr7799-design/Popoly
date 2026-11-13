import { validateGameState } from '../domain/invariants';
import { asPersistenceError, decodeCampaignSaveShape } from './decode';
import { verifySaveChecksum } from './checksum';
import type { CampaignSaveV1, DigestProvider, LoadCompatibility, PersistenceResult } from './types';

export interface LoadedCampaign {
  save: CampaignSaveV1;
  state: CampaignSaveV1['state'];
  recoveredFromMigration: false;
}

export async function loadCampaignSave(
  serialized: string,
  compatibility: LoadCompatibility,
  digest?: DigestProvider,
): Promise<PersistenceResult<LoadedCampaign>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return { ok: false, error: { code: 'save.json_invalid', message: 'The save file is not valid JSON.' } };
  }
  const decoded = decodeCampaignSaveShape(parsed);
  if (!decoded.ok) return decoded;
  const save = decoded.value;
  try {
    if (!await verifySaveChecksum(save, digest)) {
      return { ok: false, error: { code: 'save.checksum_mismatch', message: 'The save checksum does not match its contents; the file may be damaged or modified.' } };
    }
    if (!compatibility.isSimulationCompatible(save.simulationVersion)) {
      return { ok: false, error: { code: 'save.simulation_unsupported', message: `Simulation version "${save.simulationVersion}" is not compatible with this build.` } };
    }
    if (!compatibility.isScenarioCompatible(save.scenarioId, save.scenarioVersion)) {
      return { ok: false, error: { code: 'save.scenario_unsupported', message: `Scenario "${save.scenarioId}" version "${save.scenarioVersion}" is not supported by this build.` } };
    }
    const issues = validateGameState(save.state);
    if (issues.length > 0) {
      return { ok: false, error: { code: 'save.state_invalid', message: 'The saved GameState violates domain invariants.', issues } };
    }
    return { ok: true, value: { save, state: structuredClone(save.state), recoveredFromMigration: false } };
  } catch (error) {
    return { ok: false, error: asPersistenceError(error, 'save.load_failed') };
  }
}
