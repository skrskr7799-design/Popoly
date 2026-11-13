import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { advanceQuarter } from '../engine/advanceQuarter';
import { canonicalJson } from '../persistence/canonicalJson';
import { createCampaignSave, serializeCampaignSave } from '../persistence/save';
import { loadCampaignSave } from '../persistence/load';
import { restoreCampaign } from '../persistence/restore';
import { IndexedDbCampaignSaveRepository } from '../persistence/indexedDbRepository';
import { exportCampaignSave, importCampaignSave } from '../persistence/transfer';
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
  it('rotates revisions and recovers the previous valid campaign without overwriting corruption', async () => {
    const repository = new MemoryCampaignRepository();
    const first = await createCampaignSave(initializeGame(2035), metadata, testDigest);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(await repository.commit(first.value)).toEqual({ ok: true, value: undefined });

    const laterState = initializeGame(2035);
    laterState.quarter = 2;
    const second = await createCampaignSave(laterState, {
      ...metadata, updatedAt: '2035-04-01T00:00:00.000Z',
    }, testDigest);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(await repository.commit(second.value)).toEqual({ ok: true, value: undefined });

    const previous = await repository.read(metadata.campaignId, 'previous');
    expect(previous).toEqual({ ok: true, value: serializeCampaignSave(first.value) });

    repository.corruptCurrent(metadata.campaignId, '{corrupt');
    const restored = await restoreCampaign(repository, metadata.campaignId, compatibility, testDigest);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.recoveredFromPrevious).toBe(true);
    expect(restored.value.state.quarter).toBe(1);
    expect(restored.value.currentRevisionError?.code).toBe('save.json_invalid');
    expect(await repository.read(metadata.campaignId, 'current')).toEqual({ ok: true, value: '{corrupt' });
  });

  it('continues deterministically after restoring a saved campaign snapshot', async () => {
    const opening = advanceQuarter(initializeGame(2035));
    expect(opening.ok).toBe(true);
    if (!opening.ok) return;

    const created = await createCampaignSave(opening.state, {
      ...metadata, updatedAt: '2035-04-01T00:00:00.000Z',
    }, testDigest);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const loaded = await loadCampaignSave(serializeCampaignSave(created.value), compatibility, testDigest);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const uninterrupted = advanceQuarter(opening.state);
    const restored = advanceQuarter(loaded.value.state);
    expect(restored).toEqual(uninterrupted);
  });

});

async function makeIndexedDbSave(campaignId: string, quarter: number, updatedAt: string): Promise<CampaignSaveV1> {
  const state = initializeGame(2035);
  state.quarter = quarter;
  const created = await createCampaignSave(state, {
    campaignId,
    createdAt: '2035-01-01T00:00:00.000Z',
    updatedAt,
    simulationVersion: '0.1.0',
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
}

async function corruptIndexedDbCurrent(databaseName: string, campaignId: string): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('campaigns', 'readwrite');
    const store = transaction.objectStore('campaigns');
    const request = store.get(campaignId);
    request.onsuccess = () => {
      const record = request.result as { current: string; previous: string | null };
      store.put({ ...record, current: '{broken' , campaignId });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Corruption transaction aborted.'));
  });
  database.close();
}

describe('IndexedDB campaign repository', () => {
  it('commits, lists, reads, rotates and deletes campaign revisions', async () => {
    const databaseName = 'popoly-idb-basic-test';
    const repository = new IndexedDbCampaignSaveRepository({ databaseName });
    const first = await makeIndexedDbSave('idb-basic', 1, '2035-01-01T00:00:00.000Z');
    const second = await makeIndexedDbSave('idb-basic', 2, '2035-04-01T00:00:00.000Z');

    expect(await repository.commit(first)).toEqual({ ok: true, value: undefined });
    expect(await repository.commit(second)).toEqual({ ok: true, value: undefined });

    const current = await repository.read('idb-basic', 'current');
    const previous = await repository.read('idb-basic', 'previous');
    expect(current).toEqual({ ok: true, value: serializeCampaignSave(second) });
    expect(previous).toEqual({ ok: true, value: serializeCampaignSave(first) });

    const listed = await repository.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toEqual([{
        campaignId: 'idb-basic',
        updatedAt: '2035-04-01T00:00:00.000Z',
        quarter: 2,
        scenarioId: second.scenarioId,
        scenarioVersion: second.scenarioVersion,
      }]);
    }

    expect(await repository.delete('idb-basic')).toEqual({ ok: true, value: undefined });
    expect(await repository.read('idb-basic', 'current')).toEqual({ ok: true, value: null });
  });

  it('preserves the last known-good backup when the current IndexedDB record is corrupt', async () => {
    const databaseName = 'popoly-idb-corruption-test';
    const repository = new IndexedDbCampaignSaveRepository({ databaseName });
    const first = await makeIndexedDbSave('idb-corrupt', 1, '2035-01-01T00:00:00.000Z');
    const second = await makeIndexedDbSave('idb-corrupt', 2, '2035-04-01T00:00:00.000Z');
    const third = await makeIndexedDbSave('idb-corrupt', 3, '2035-07-01T00:00:00.000Z');

    expect((await repository.commit(first)).ok).toBe(true);
    expect((await repository.commit(second)).ok).toBe(true);
    await corruptIndexedDbCurrent(databaseName, 'idb-corrupt');
    expect((await repository.commit(third)).ok).toBe(true);

    const previous = await repository.read('idb-corrupt', 'previous');
    expect(previous).toEqual({ ok: true, value: serializeCampaignSave(first) });
  });

  it('rejects a stale concurrent write instead of silently overwriting the first commit', async () => {
    const repository = new IndexedDbCampaignSaveRepository({ databaseName: 'popoly-idb-concurrency-test' });
    const first = await makeIndexedDbSave('idb-concurrent', 1, '2035-01-01T00:00:00.000Z');
    const second = await makeIndexedDbSave('idb-concurrent', 2, '2035-04-01T00:00:00.000Z');

    const results = await Promise.all([repository.commit(first), repository.commit(second)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const rejected = results.find((result) => !result.ok);
    if (rejected && !rejected.ok) expect(rejected.error.code).toBe('storage.concurrent_write');
  });
});

describe('campaign JSON transfer', () => {
  it('exports a validated campaign and imports it into a separate IndexedDB repository', async () => {
    const source = new IndexedDbCampaignSaveRepository({ databaseName: 'popoly-export-source-test' });
    const destination = new IndexedDbCampaignSaveRepository({ databaseName: 'popoly-import-destination-test' });
    const save = await makeIndexedDbSave('portable-campaign', 4, '2036-01-01T00:00:00.000Z');
    expect((await source.commit(save)).ok).toBe(true);

    const exported = await exportCampaignSave(source, save.campaignId, compatibility);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = await importCampaignSave(destination, exported.value, compatibility);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.save.campaignId).toBe(save.campaignId);
    expect(imported.value.state).toEqual(save.state);
    expect(await destination.read(save.campaignId, 'current')).toEqual({
      ok: true,
      value: serializeCampaignSave(save),
    });
  });

  it('rejects a damaged import without writing anything', async () => {
    const destination = new IndexedDbCampaignSaveRepository({ databaseName: 'popoly-import-damaged-test' });
    const save = await makeIndexedDbSave('damaged-import', 2, '2035-04-01T00:00:00.000Z');
    const tampered = { ...save, state: { ...save.state, seed: save.state.seed + 1 } };

    const imported = await importCampaignSave(destination, JSON.stringify(tampered), compatibility);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.error.code).toBe('save.checksum_mismatch');
    expect(await destination.read(save.campaignId, 'current')).toEqual({ ok: true, value: null });
  });

  it('rejects an existing campaign ID without replacing its current revision', async () => {
    const repository = new IndexedDbCampaignSaveRepository({ databaseName: 'popoly-import-collision-test' });
    const existing = await makeIndexedDbSave('import-collision', 1, '2035-01-01T00:00:00.000Z');
    const incoming = await makeIndexedDbSave('import-collision', 5, '2036-04-01T00:00:00.000Z');
    expect((await repository.commit(existing)).ok).toBe(true);

    const imported = await importCampaignSave(repository, serializeCampaignSave(incoming), compatibility);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.error.code).toBe('import.campaign_exists');
    expect(await repository.read(existing.campaignId, 'current')).toEqual({
      ok: true,
      value: serializeCampaignSave(existing),
    });
  });

  it('atomically rejects concurrent imports that target the same new campaign ID', async () => {
    const repository = new IndexedDbCampaignSaveRepository({ databaseName: 'popoly-import-race-test' });
    const first = await makeIndexedDbSave('import-race', 1, '2035-01-01T00:00:00.000Z');
    const second = await makeIndexedDbSave('import-race', 2, '2035-04-01T00:00:00.000Z');

    const results = await Promise.all([
      importCampaignSave(repository, serializeCampaignSave(first), compatibility),
      importCampaignSave(repository, serializeCampaignSave(second), compatibility),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const rejected = results.find((result) => !result.ok);
    if (rejected && !rejected.ok) expect(rejected.error.code).toBe('import.campaign_exists');
  });
});

