import type { CampaignSaveV1, PersistenceResult } from './types';

export type SaveRevision = 'current' | 'previous';

export interface CampaignSaveSummary {
  campaignId: string;
  updatedAt: string;
  quarter: number;
  scenarioId: string;
  scenarioVersion: string;
}

export interface CampaignSaveCommitOptions {
  /** Reject an existing campaign atomically; used by import to prevent overwrite. */
  createOnly?: boolean;
}

export interface CampaignSaveRepository {
  list(): Promise<PersistenceResult<CampaignSaveSummary[]>>;
  read(campaignId: string, revision?: SaveRevision): Promise<PersistenceResult<string | null>>;
  commit(save: CampaignSaveV1, options?: CampaignSaveCommitOptions): Promise<PersistenceResult<void>>;
  delete(campaignId: string): Promise<PersistenceResult<void>>;
}
