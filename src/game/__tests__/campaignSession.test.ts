import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CampaignSession, GUIDED_CAMPAIGN_QUARTERS } from '../campaign/session';
import { IndexedDbCampaignSaveRepository } from '../persistence/indexedDbRepository';
import type { MoneyCents } from '../domain/types';

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
    snapshot.organizations[0]!.cashCents = 0 as MoneyCents;
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
    if (!accepted.ok) return;
    expect(accepted.report.quarter).toBe(1);
    expect(session.state.quarter).toBe(2);
    expect(session.currentReport.quarter).toBe(session.state.quarter);
    expect(session.currentReport.contractsInRenewalWindow).toEqual(
      session.state.operatingCompanies.flatMap((company) => company.contracts
        .filter((contract) => contract.flexibility === 'contracted' && contract.termEndQuarter !== undefined &&
          contract.termEndQuarter - session.state.quarter <= (contract.renewalNoticeQuarters ?? 0))
        .map((contract) => contract.id)),
    );
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
    });
    expect(session.advance({ launchInitiatives: ['commission-market-study'] }).ok).toBe(true);
    expect((await session.save()).ok).toBe(true);

    const restored = await CampaignSession.restore(session.campaignId, repository, {
      now: fixedClock(),
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;

    expect(restored.value.recoveredFromPrevious).toBe(false);
    expect(restored.value.session.state).toEqual(session.state);
    expect(restored.value.session.currentReport).toEqual(session.currentReport);
    expect(restored.value.session.currentReport.quarter).toBe(session.state.quarter);

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

  it('restores an active creditor workout and continues with identical outcomes', async () => {
    const repository = new IndexedDbCampaignSaveRepository({
      databaseName: 'popoly-session-workout-restore',
    });
    const session = CampaignSession.start({
      seed: 2035,
      campaignId: 'campaign-session-workout-restore',
      repository,
      now: fixedClock(),
    });
    const proposed = session.proposeCreditorWorkout({
      entityId: 'nodeworks',
      standstillQuarters: 1,
      maturityExtensionQuarters: 1,
      interestReductionBps: 0,
      principalWriteDownBps: 0,
      tradePayableWriteDownBps: 0,
      covenantWaiver: false,
      deadlineQuarters: 2,
      minimumOperatingCashContributionCents: -1_000_000_000_000,
      maximumOperatingPayablesCents: 1_000_000_000_000,
      maximumDebtArrearsCents: 1_000_000_000_000,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.workout.status).toBe('active');
    expect((await session.save()).ok).toBe(true);

    const restored = await CampaignSession.restore(session.campaignId, repository, {
      now: fixedClock(),
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.session.state).toEqual(session.state);
    expect(restored.value.session.state.creditorWorkouts).toEqual(session.state.creditorWorkouts);

    const uninterrupted = session.advance();
    const resumed = restored.value.session.advance();
    expect(resumed).toEqual(uninterrupted);
  });

  it('restores active administration without relaxing its operating restrictions', async () => {
    const repository = new IndexedDbCampaignSaveRepository({
      databaseName: 'popoly-session-administration-restore',
    });
    const session = CampaignSession.start({
      seed: 2035,
      campaignId: 'campaign-session-administration-restore',
      repository,
      now: fixedClock(),
    });
    const filed = session.openAdministration('nodeworks', 'voluntary');
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    expect((await session.save()).ok).toBe(true);

    const restored = await CampaignSession.restore(session.campaignId, repository, {
      now: fixedClock(),
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.session.state.administrationCases).toEqual(session.state.administrationCases);
    expect(restored.value.session.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.status)
      .toBe('administration');

    const restricted = restored.value.session.advance({
      launchInitiatives: ['capacity-expansion-phase-i'],
    });
    expect(restricted.ok).toBe(false);
    if (!restricted.ok) {
      expect(restricted.issues.some((item) => item.code === 'administration.investment_restricted')).toBe(true);
    }
    expect(restored.value.session.state).toEqual(session.state);
  });

  it('restores a concluded liquidation and keeps ordinary quarter progression closed', async () => {
    const repository = new IndexedDbCampaignSaveRepository({
      databaseName: 'popoly-session-liquidation-restore',
    });
    const session = CampaignSession.start({
      seed: 2035,
      campaignId: 'campaign-session-liquidation-restore',
      repository,
      now: fixedClock(),
    });
    const filed = session.openAdministration('nodeworks', 'debt-default');
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    const liquidated = session.liquidateAdministration(filed.administrationCase.id);
    expect(liquidated.ok).toBe(true);
    if (!liquidated.ok) return;
    expect((await session.save()).ok).toBe(true);

    const restored = await CampaignSession.restore(session.campaignId, repository, {
      now: fixedClock(),
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.session.state).toEqual(session.state);
    expect(restored.value.session.state.administrationCases?.[0]?.status).toBe('liquidated');

    const next = restored.value.session.advance();
    expect(next.ok).toBe(false);
    if (!next.ok) {
      expect(next.issues.some((item) => item.code === 'campaign.company_liquidated')).toBe(true);
    }
  });
});
