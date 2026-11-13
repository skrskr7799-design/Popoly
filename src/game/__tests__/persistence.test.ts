import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { canonicalJson } from '../persistence/canonicalJson';
import { createCampaignSave, serializeCampaignSave } from '../persistence/save';
import { loadCampaignSave } from '../persistence/load';
import { restoreCampaign } from '../persistence/restore';
import type { CampaignSaveRepository } from '../persistence/repository';
import type { CampaignSaveV1, PersistenceResult } from '../persistence/types';
import type { DigestProvider, LoadCompatibility } from '../persistence/types';

const metadata = {
  campaignId: 'campaign-test-001',
  createdAt: '2035-01-01T00:00:00.000Z',
  updatedAt: '2035-01-01T00:00:00.000Z',
  simulationVersion: '0.1.0',
};
const compatibility: LoadCompatibility = {
  isSimulationCompatible: (version) => version === '0.1.0',
  isScenarioCompatible: (id, version) => id === 'the-compute-bottleneck' && version === '0.1.0',
};
const testDigest: DigestProvider = async (data) => {
  // A deterministic test double; production uses Web Crypto SHA-256.
  let hash = 2166136261;
  for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};


class MemoryCampaignRepository implements CampaignSaveRepository {
  private readonly records = new Map<string, { current: string; previous: string | null }>();

  async list(): Promise<PersistenceResult<{ campaignId: string; updatedAt: string; quarter: number; scenarioId: string; scenarioVersion: string }[]>> {
    return { ok: true, value: [] };
  }

  async read(campaignId: string, revision: 'current' | 'previous' = 'current'): Promise<PersistenceResult<string | null>> {
    return { ok: true, value: this.records.get(campaignId)?.[revision] ?? null };
  }

  async commit(save: CampaignSaveV1): Promise<PersistenceResult<void>> {
    const existing = this.records.get(save.campaignId);
    this.records.set(save.campaignId, {
      current: serializeCampaignSave(save),
      previous: existing?.current ?? existing?.previous ?? null,
    });
    return { ok: true, value: undefined };
  }

  async delete(campaignId: string): Promise<PersistenceResult<void>> {
    this.records.delete(campaignId);
    return { ok: true, value: undefined };
  }

  corruptCurrent(campaignId: string, value: string): void {
    const record = this.records.get(campaignId);
    if (record) this.records.set(campaignId, { ...record, current: value });
  }
}

describe('campaign save core', () => {
  it('serializes object keys canonically regardless of insertion order', () => {
    expect(canonicalJson({ z: 1, nested: { b: 2, a: 1 }, a: true }))
      .toBe(canonicalJson({ a: true, nested: { a: 1, b: 2 }, z: 1 }));
  });

  it('rejects values that cannot be represented as canonical JSON', () => {
    expect(() => canonicalJson({ missing: undefined })).toThrow(/undefined/);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/cyclic/);
  });

  it('round-trips a valid authoritative GameState without UI-store coupling', async () => {
    const state = initializeGame(2035);
    const created = await createCampaignSave(state, metadata, testDigest);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const serialized = serializeCampaignSave(created.value);
    const loaded = await loadCampaignSave(serialized, compatibility, testDigest);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state).toEqual(state);
    expect(loaded.value.save.campaignId).toBe(metadata.campaignId);
    expect(loaded.value.save.quarter).toBe(state.quarter);
    expect(loaded.value.recoveredFromMigration).toBe(false);
  });

  it('rejects a checksum mismatch without returning state', async () => {
    const created = await createCampaignSave(initializeGame(2035), metadata, testDigest);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const tampered = { ...created.value, state: { ...created.value.state, seed: created.value.state.seed + 1 } };
    const loaded = await loadCampaignSave(JSON.stringify(tampered), compatibility, testDigest);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('save.checksum_mismatch');
  });

  it('returns structured errors for malformed JSON and malformed nested state', async () => {
    const malformedJson = await loadCampaignSave('{broken', compatibility, testDigest);
    expect(malformedJson.ok).toBe(false);
    if (!malformedJson.ok) expect(malformedJson.error.code).toBe('save.json_invalid');

    const created = await createCampaignSave(initializeGame(2035), metadata, testDigest);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const malformed = JSON.parse(serializeCampaignSave(created.value)) as Record<string, unknown>;
    malformed.state = { schemaVersion: 1, organizations: [null] };
    const loaded = await loadCampaignSave(JSON.stringify(malformed), compatibility, testDigest);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('save.state_shape_invalid');
  });

  it('rejects unsupported simulation and scenario versions', async () => {
    const created = await createCampaignSave(initializeGame(2035), metadata, testDigest);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const incompatible: LoadCompatibility = {
      isSimulationCompatible: () => false,
      isScenarioCompatible: () => false,
    };
    const loaded = await loadCampaignSave(serializeCampaignSave(created.value), incompatible, testDigest);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('save.simulation_unsupported');
  });

  it('does not mutate the source state while creating or loading a save', async () => {
    const state = initializeGame(2035);
    const before = structuredClone(state);
    const created = await createCampaignSave(state, metadata, testDigest);
    expect(state).toEqual(before);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const loaded = await loadCampaignSave(serializeCampaignSave(created.value), compatibility, testDigest);
    expect(loaded.ok).toBe(true);
    expect(state).toEqual(before);
    if (loaded.ok) {
      loaded.value.state.quarter += 1;
      expect(state.quarter).toBe(before.quarter);
    }
  });
});
