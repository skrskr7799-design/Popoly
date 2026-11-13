import type { GameState, ValidationIssue } from '../domain/types';

export const SAVE_FORMAT = 'popoly-campaign-save' as const;
export const SAVE_SCHEMA_VERSION = 1 as const;

export interface CampaignSaveV1 {
  format: typeof SAVE_FORMAT;
  saveSchemaVersion: typeof SAVE_SCHEMA_VERSION;
  simulationVersion: string;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
  scenarioId: string;
  scenarioVersion: string;
  gameStateSchemaVersion: number;
  quarter: number;
  checksum: string;
  state: GameState;
}

export interface SaveMetadata {
  campaignId: string;
  createdAt: string;
  updatedAt: string;
  simulationVersion: string;
}

export interface PersistenceError {
  code: string;
  message: string;
  issues?: ValidationIssue[];
}

export type PersistenceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PersistenceError };

export type DigestProvider = (data: Uint8Array) => Promise<string>;

export interface LoadCompatibility {
  isSimulationCompatible: (simulationVersion: string) => boolean;
  isScenarioCompatible: (scenarioId: string, scenarioVersion: string) => boolean;
}
