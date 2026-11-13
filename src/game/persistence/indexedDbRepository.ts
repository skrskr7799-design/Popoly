import { canonicalJson } from './canonicalJson';
import type { CampaignSaveV1, PersistenceError, PersistenceResult } from './types';
import type { CampaignSaveRepository, CampaignSaveSummary, SaveRevision } from './repository';

interface StoredCampaign {
  campaignId: string;
  current: string;
  previous: string | null;
  updatedAt: string;
  quarter: number;
  scenarioId: string;
  scenarioVersion: string;
}

export interface IndexedDbRepositoryOptions {
  databaseName?: string;
  storeName?: string;
  factory?: IDBFactory;
}

function storageError(error: unknown): PersistenceError {
  return {
    code: 'storage.indexeddb_failed',
    message: error instanceof Error ? error.message : 'IndexedDB operation failed.',
  };
}

/** IndexedDB implementation. Current/previous revision rotation is one transaction. */
export class IndexedDbCampaignSaveRepository implements CampaignSaveRepository {
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly factory: IDBFactory | undefined;

  constructor(options: IndexedDbRepositoryOptions = {}) {
    this.databaseName = options.databaseName ?? 'popoly-campaign-saves';
    this.storeName = options.storeName ?? 'campaigns';
    this.factory = options.factory ?? globalThis.indexedDB;
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!this.factory) {
        reject(new Error('IndexedDB is not available in this environment.'));
        return;
      }
      const request = this.factory.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: 'campaignId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open the campaign database.'));
      request.onblocked = () => reject(new Error('Campaign database upgrade is blocked by another open connection.'));
    });
  }

  async list(): Promise<PersistenceResult<CampaignSaveSummary[]>> {
    let database: IDBDatabase | undefined;
    try {
      database = await this.openDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database!.transaction(this.storeName, 'readonly');
        const request = transaction.objectStore(this.storeName).getAll() as IDBRequest<StoredCampaign[]>;
        request.onsuccess = () => resolve({
          ok: true,
          value: request.result.map(({ campaignId, updatedAt, quarter, scenarioId, scenarioVersion }) => ({
            campaignId, updatedAt, quarter, scenarioId, scenarioVersion,
          })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        });
        request.onerror = () => reject(request.error ?? new Error('Could not list saved campaigns.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Campaign listing transaction was aborted.'));
      });
    } catch (error) {
      return { ok: false, error: storageError(error) };
    } finally {
      database?.close();
    }
  }

  async read(campaignId: string, revision: SaveRevision = 'current'): Promise<PersistenceResult<string | null>> {
    let database: IDBDatabase | undefined;
    try {
      database = await this.openDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database!.transaction(this.storeName, 'readonly');
        const request = transaction.objectStore(this.storeName).get(campaignId) as IDBRequest<StoredCampaign | undefined>;
        request.onsuccess = () => resolve({ ok: true, value: request.result?.[revision] ?? null });
        request.onerror = () => reject(request.error ?? new Error('Could not read the requested campaign revision.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Campaign read transaction was aborted.'));
      });
    } catch (error) {
      return { ok: false, error: storageError(error) };
    } finally {
      database?.close();
    }
  }

  async commit(save: CampaignSaveV1): Promise<PersistenceResult<void>> {
    let database: IDBDatabase | undefined;
    try {
      const serialized = canonicalJson(save);
      database = await this.openDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database!.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(save.campaignId) as IDBRequest<StoredCampaign | undefined>;
        request.onsuccess = () => {
          const existing = request.result;
          const record: StoredCampaign = {
            campaignId: save.campaignId,
            current: serialized,
            previous: existing?.current ?? existing?.previous ?? null,
            updatedAt: save.updatedAt,
            quarter: save.quarter,
            scenarioId: save.scenarioId,
            scenarioVersion: save.scenarioVersion,
          };
          store.put(record);
        };
        request.onerror = () => {
          try { transaction.abort(); } catch { /* transaction may already be inactive */ }
        };
        transaction.oncomplete = () => resolve({ ok: true, value: undefined });
        transaction.onerror = () => reject(transaction.error ?? new Error('Campaign save transaction failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Campaign save transaction was aborted.'));
      });
    } catch (error) {
      return { ok: false, error: storageError(error) };
    } finally {
      database?.close();
    }
  }

  async delete(campaignId: string): Promise<PersistenceResult<void>> {
    let database: IDBDatabase | undefined;
    try {
      database = await this.openDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database!.transaction(this.storeName, 'readwrite');
        transaction.objectStore(this.storeName).delete(campaignId);
        transaction.oncomplete = () => resolve({ ok: true, value: undefined });
        transaction.onerror = () => reject(transaction.error ?? new Error('Campaign deletion failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Campaign deletion was aborted.'));
      });
    } catch (error) {
      return { ok: false, error: storageError(error) };
    } finally {
      database?.close();
    }
  }
}
