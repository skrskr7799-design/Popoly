import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CampaignSession, GUIDED_CAMPAIGN_QUARTERS } from '../campaign/session';
import { IndexedDbCampaignSaveRepository } from '../persistence/indexedDbRepository';
import type { DigestProvider } from '../persistence/types';

const digest: DigestProvider = async (data) => {
  let hash = 2166136261;
  for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};

function fixedClock() {
  let tick = Date.parse('2035-01-01T00:00:00.000Z');
  return () => new Date(tick += 1_000);
}

describe('CampaignSession', () => {
  it('starts a validated campaign with an opening report and isolated state snapshots', () => {
    const session = CampaignSession.start({
      seed: 2035,
      campaignId: 'campaign-session-start',
      now: fixedClock(),
    });

    expect(session.state.quarter).toBe(1);
    expect(session.currentReport.quarter).toBe(1);
    expect(session.completedQuarters).toBe(0);
    expect(session.stage).toBe('guided');

    const snapshot = session.state;
    snapshot.organizations[0]!.cashCents = 0 as typeof snapshot.organizations[number]['cashCents'];
    expect(session.state.organizations[0]!.cashCents).not.toBe(0);
  });

  it('commits only successful quarter transitions and preserves the last report on rejection', () => {
    const session = CampaignSession.start({
      campaignId: 'campaign-session-atomic',
      now: fixedClock(),
    });
    const before = session.state;
    const previousReport = session.currentReport;

    const rejected = session.advance({
      workloadDecisions: [{ companyId: 'missing-company', desiredWorkloadMW: 1 }],
    });
    expect(rejected.ok).toBe(false);
    expect(session.state).toEqual(before);
    expect(session.currentReport).toEqual(previousReport);

    const accepted = session.advance({ launchInitiatives: ['commission-market-study'] });
    expect(accepted.ok).toBe(true);
    expect(session.state.quarter).toBe(2);
    expect(session.currentReport.quarter).toBe(1);
    expect(session.completedQuarters).toBe(1);
  });

  it('marks the guided evaluation complete after eight resolved quarters and continues in sandbox', () => {
    const session = CampaignSession.start({
      campaignId: 'campaign-session-eight',
      now: fixedClock(),
    });

    for (let quarter = 0; quarter < GUIDED_CAMPAIGN_QUARTERS; quarter += 1) {
      const result = session.advance();
      expect(result.ok).toBe(true);
    }

    expect(session.state.quarter).toBe(9);
    expect(session.completedQuarters).toBe(8);
    expect(session.stage).toBe('sandbox');
    expect(session.advance().ok).toBe(true);
    expect(session.state.quarter).toBe(10);
  });

  it('saves and restores a campaign, then continues deterministically', async () => {
    const repository = new IndexedDbCampaignSaveRepository({
      databaseName: 'popoly-campaign-session-roundtrip',
    });
    const session = CampaignSession.start({
      seed: 2035,
      campaignId: 'campaign-session-roundtrip',
      repository,
      now: fixedClock(),
      digest,
    });
    expect(session.advance({ launchInitiatives: ['commission-market-study'] }).ok).toBe(true);
    expect((await session.save()).ok).toBe(true);

    const restored = await CampaignSession.restore(session.campaignId, repository, {
      now: fixedClock(),
      digest,
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;

    expect(restored.value.recoveredFromPrevious).toBe(false);
    expect(restored.value.session.state).toEqual(session.state);

    const uninterrupted = session.advance();
    const resumed = restored.value.session.advance();
    expect(resumed).toEqual(uninterrupted);
  });

  it('reports a clear error when saving without a repository', async () => {
    const session = CampaignSession.start({
      campaignId: 'campaign-session-no-repository',
      now: fixedClock(),
    });
    const result = await session.save();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('campaign.repository_unavailable');
  });
});
