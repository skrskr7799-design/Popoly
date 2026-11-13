import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { calculateOperatingQuarter } from '../systems/economy';
import { buildQuarterReport } from '../systems/quarterReport';
import { createRandomState, nextRandom } from '../engine/random';
import { validateGameState } from '../domain/invariants';
import { advanceQuarter } from '../engine/advanceQuarter';

describe('The Compute Bottleneck opening state', () => {
  it('initializes with valid ownership and entity references', () => {
    const state = initializeGame(2035);
    expect(validateGameState(state)).toEqual([]);
    expect(state.ownership.reduce((sum, stake) => sum + stake.shares, 0)).toBe(10_000_000);
  });

  it('reconciles the opening operating quarter', () => {
    const state = initializeGame();
    const company = state.operatingCompanies[0]!;
    const market = state.regionalMarkets[0]!;
    const result = calculateOperatingQuarter(company, market);

    expect(result.effectiveCapacityMW).toBeCloseTo(19.7, 8);
    expect(result.deliveredWorkloadMW).toBe(17);
    expect(result.energyConsumedMWh).toBe(36_720);
    expect(result.revenueCents).toBe(816_500_000);
    expect(result.energyCostCents).toBe(264_384_000);
    expect(result.totalOperatingCostCents).toBe(565_384_000);
    expect(result.operatingCashContributionCents).toBe(251_116_000);
  });

  it('recognizes revenue only for delivered workload and protects contracted demand first', () => {
    const state = initializeGame();
    const company = state.operatingCompanies[0]!;
    const market = state.regionalMarkets[0]!;
    const constrained = {
      ...company,
      deliveredWorkloadMW: 10,
      capacity: { ...company.capacity, gridAllocationMW: 10.2, reliability: 1 },
    };
    const result = calculateOperatingQuarter(constrained, market);

    expect(result.deliveredWorkloadMW).toBe(10);
    expect(result.fulfilledContracts.map((line) => line.deliveredMW)).toEqual([8, 2, 0]);
    expect(result.revenueCents).toBe(505_000_000);
  });

  it('keeps subsidiary and holding cash legally separate', () => {
    const state = initializeGame();
    const report = buildQuarterReport(state);
    const nodeworks = report.entityCashBridges.find((line) => line.organizationId === 'nodeworks')!;
    const meridian = report.entityCashBridges.find((line) => line.organizationId === 'meridian-group')!;

    expect(report.totalInterestExpenseCents).toBe(37_500_000);
    expect(nodeworks.interestExpenseCents).toBe(31_500_000);
    expect(nodeworks.netCashChangeCents).toBe(219_616_000);
    expect(nodeworks.closingCashCents).toBe(639_616_000);
    expect(meridian.interestExpenseCents).toBe(6_000_000);
    expect(meridian.closingCashCents).toBe(1_394_000_000);
  });

  it('produces repeatable pseudo-random sequences for the same seed', () => {
    const first = createRandomState(42);
    const second = createRandomState(42);
    const a = nextRandom(first);
    const b = nextRandom(second);
    expect(a).toEqual(b);
    expect(nextRandom(a.nextState)).toEqual(nextRandom(b.nextState));
  });

  it('rejects an ownership ledger that does not reconcile', () => {
    const state = initializeGame();
    state.ownership[0] = { ...state.ownership[0]!, shares: 7_199_999 };
    expect(validateGameState(state).some((issue) => issue.code === 'ownership.share_ledger_mismatch')).toBe(true);
  });
});


describe('atomic quarter transition', () => {
  it('commits one quarter and applies entity cash bridges without merging legal entities', () => {
    const state = initializeGame();
    const result = advanceQuarter(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.quarter).toBe(1);
    expect(result.state.quarter).toBe(2);
    expect(result.state.organizations.find((item) => item.id === 'nodeworks')!.cashCents).toBe(639_616_000);
    expect(result.state.organizations.find((item) => item.id === 'meridian-group')!.cashCents).toBe(1_394_000_000);
    expect(state.quarter).toBe(1);
    expect(state.organizations.find((item) => item.id === 'nodeworks')!.cashCents).toBe(420_000_000);
  });

  it('accepts a workload decision and resolves revenue from delivered workload', () => {
    const state = initializeGame();
    const result = advanceQuarter(state, {
      workloadDecisions: [{ companyId: 'nodeworks', desiredWorkloadMW: 10 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.companies[0]!.operations.deliveredWorkloadMW).toBe(10);
    expect(result.report.companies[0]!.operations.revenueCents).toBe(505_000_000);
    expect(result.state.operatingCompanies[0]!.deliveredWorkloadMW).toBe(10);
  });

  it('rejects invalid commands atomically and leaves the original state unchanged', () => {
    const state = initializeGame();
    const before = JSON.stringify(state);
    const result = advanceQuarter(state, {
      workloadDecisions: [{ companyId: 'nodeworks', desiredWorkloadMW: 99 }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.code).toBe('command.workload_out_of_range');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects duplicate decisions for the same company', () => {
    const state = initializeGame();
    const result = advanceQuarter(state, {
      workloadDecisions: [
        { companyId: 'nodeworks', desiredWorkloadMW: 10 },
        { companyId: 'nodeworks', desiredWorkloadMW: 12 },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((item) => item.code === 'command.workload_duplicate')).toBe(true);
    expect(state.quarter).toBe(1);
  });
});
