import { canonicalJson } from './canonicalJson';
import type { CampaignSaveV1, DigestProvider } from './types';

export const sha256Digest: DigestProvider = async (data) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable in this environment.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(data).buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export function checksumPayload(save: Omit<CampaignSaveV1, 'checksum'> | CampaignSaveV1): Omit<CampaignSaveV1, 'checksum'> {
  const { checksum: _checksum, ...payload } = save as CampaignSaveV1;
  return payload;
}

export async function calculateSaveChecksum(
  payload: Omit<CampaignSaveV1, 'checksum'>,
  digest: DigestProvider = sha256Digest,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  return `sha256:${await digest(bytes)}`;
}

export async function verifySaveChecksum(
  save: CampaignSaveV1,
  digest: DigestProvider = sha256Digest,
): Promise<boolean> {
  const { checksum, ...payload } = save;
  return checksum === await calculateSaveChecksum(payload, digest);
}
