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

  it('applies contract-specific service credits when provider reliability misses the SLA', () => {
    const state = initializeGame();
    const company = state.operatingCompanies[0]!;
    const market = state.regionalMarkets[0]!;
    const breached = {
      ...company,
      capacity: { ...company.capacity, reliability: 0.97 },
    };
    const result = calculateOperatingQuarter(breached, market);

    // Only the two fixed-term agreements carry a 98% SLA and 5% credit.
    expect(result.grossRevenueCents).toBe(816_500_000);
    expect(result.serviceCreditCents).toBe(32_525_000);
    expect(result.revenueCents).toBe(783_975_000);
    expect(result.fulfilledContracts.map((line) => line.serviceCreditCents)).toEqual([
      20_400_000, 12_125_000, 0,
    ]);
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


describe('explicit debt principal repayments', () => {
  it("repays principal from the borrower's own cash and leaves current-quarter interest unchanged", () => {
    const state = initializeGame();
    const result = advanceQuarter(state, {
      debtRepayments: [{ debtId: 'nodeworks-infrastructure-debt', principalCents: 100_000_000 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const debt = result.state.debts.find((item) => item.id === 'nodeworks-infrastructure-debt')!;
    const nodeworks = result.state.organizations.find((item) => item.id === 'nodeworks')!;
    const bridge = result.report.entityCashBridges.find((item) => item.organizationId === 'nodeworks')!;
    expect(debt.principalCents).toBe(1_300_000_000);
    expect(nodeworks.debtCents).toBe(1_300_000_000);
    expect(nodeworks.cashCents).toBe(539_616_000);
    expect(bridge.interestExpenseCents).toBe(31_500_000);
    expect(bridge.financingCashFlowCents).toBe(-100_000_000);
    expect(bridge.closingCashCents).toBe(539_616_000);
    expect(result.report.debtRepayments).toEqual([{
      debtId: 'nodeworks-infrastructure-debt',
      borrowerId: 'nodeworks',
      principalCents: 100_000_000,
      repaymentType: 'voluntary',
    }]);
    expect(state.debts.find((item) => item.id === 'nodeworks-infrastructure-debt')!.principalCents).toBe(1_400_000_000);
  });

  it('keeps a subsidiary debt repayment on the subsidiary balance sheet', () => {
    const state = initializeGame();
    const result = advanceQuarter(state, {
      debtRepayments: [{ debtId: 'nodeworks-infrastructure-debt', principalCents: 400_000_000 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.organizations.find((item) => item.id === 'meridian-group')!.cashCents).toBe(1_394_000_000);
    expect(result.state.organizations.find((item) => item.id === 'nodeworks')!.cashCents).toBe(239_616_000);
  });

  it('automatically services scheduled principal and records it as a financing outflow', () => {
    const state = initializeGame();
    state.debts = state.debts.map((debt) => debt.id === 'nodeworks-infrastructure-debt'
      ? { ...debt, scheduledPrincipalCentsPerQuarter: 50_000_000 as typeof debt.principalCents }
      : debt);
    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.debts.find((debt) => debt.id === 'nodeworks-infrastructure-debt')!.principalCents).toBe(1_350_000_000);
    expect(result.state.organizations.find((item) => item.id === 'nodeworks')!.debtCents).toBe(1_350_000_000);
    expect(result.report.debtRepayments).toContainEqual({
      debtId: 'nodeworks-infrastructure-debt', borrowerId: 'nodeworks',
      principalCents: 50_000_000, repaymentType: 'scheduled',
    });
    expect(result.report.entityCashBridges.find((item) => item.organizationId === 'nodeworks')!.financingCashFlowCents).toBe(-50_000_000);
  });

  it('repays the remaining principal in full when a debt reaches maturity', () => {
    const state = initializeGame();
    state.debts = state.debts.map((debt) => debt.id === 'nodeworks-infrastructure-debt'
      ? { ...debt, maturityQuarter: 1 }
      : debt);
    const nodeworks = state.organizations.find((item) => item.id === 'nodeworks')!;
    nodeworks.cashCents = 2_000_000_000 as typeof nodeworks.cashCents;
    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.debts.find((debt) => debt.id === 'nodeworks-infrastructure-debt')!.principalCents).toBe(0);
    expect(result.state.organizations.find((item) => item.id === 'nodeworks')!.debtCents).toBe(0);
    expect(result.report.debtRepayments).toContainEqual({
      debtId: 'nodeworks-infrastructure-debt', borrowerId: 'nodeworks',
      principalCents: 1_400_000_000, repaymentType: 'maturity',
    });
  });

  it('rejects overpayment, duplicate repayment and insufficient borrower cash atomically', () => {
    const state = initializeGame();
    const before = JSON.stringify(state);
    const overPrincipal = advanceQuarter(state, {
      debtRepayments: [{ debtId: 'nodeworks-infrastructure-debt', principalCents: 1_500_000_000 }],
    });
    expect(overPrincipal.ok).toBe(false);
    if (overPrincipal.ok) return;
    expect(overPrincipal.issues.some((item) => item.code === 'command.debt_repayment_exceeds_principal')).toBe(true);

    const duplicate = advanceQuarter(state, {
      debtRepayments: [
        { debtId: 'meridian-revolver', principalCents: 100_000_000 },
        { debtId: 'meridian-revolver', principalCents: 100_000_000 },
      ],
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.issues.some((item) => item.code === 'command.debt_repayment_duplicate')).toBe(true);

    const insufficient = advanceQuarter(state, {
      debtRepayments: [{ debtId: 'nodeworks-infrastructure-debt', principalCents: 500_000_000 }],
    });
    expect(insufficient.ok).toBe(false);
    if (insufficient.ok) return;
    expect(insufficient.issues.some((item) => item.code === 'command.debt_repayment_insufficient_cash')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
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

  it('opens a renewal window and applies accepted price, guaranteed volume and term next quarter', () => {
    const first = advanceQuarter(initializeGame());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.report.contractsInRenewalWindow).toEqual([]);
    const state = first.state;
    const renewal = advanceQuarter(state, { contractRenewals: [{
      contractId: 'asterion-contract-a', offeredPriceCentsPerMWQuarter: 53_000_000,
      offeredWorkloadMW: 8, termQuarters: 4,
    }] });
    expect(renewal.ok).toBe(true);
    if (!renewal.ok) return;
    expect(renewal.report.contractsInRenewalWindow).toContain('asterion-contract-a');
    expect(renewal.report.contractRenewals?.[0]).toEqual(expect.objectContaining({ status: 'accepted', termQuarters: 4 }));
    const contract = renewal.state.operatingCompanies[0]!.contracts.find((item) => item.id === 'asterion-contract-a')!;
    expect(contract.priceCentsPerMWQuarter).toBe(53_000_000);
    expect(contract.termEndQuarter).toBe(6);
    expect(contract.minimumWorkloadMW).toBe(8);
  });

  it("counters an excessive renewal price and rejects a volume below the customer's private minimum", () => {
    const first = advanceQuarter(initializeGame());
    if (!first.ok) return;
    const counter = advanceQuarter(first.state, { contractRenewals: [{
      contractId: 'asterion-contract-a', offeredPriceCentsPerMWQuarter: 56_000_000,
      offeredWorkloadMW: 8, termQuarters: 4,
    }] });
    expect(counter.ok).toBe(true);
    if (!counter.ok) return;
    const currentCustomerThreshold = first.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!.hiddenMetrics['renewalMaxPrice:asterion-contract-a']!;
    expect(counter.report.contractRenewals?.[0]).toEqual(expect.objectContaining({
      status: 'countered', counterPriceCents: Math.round(currentCustomerThreshold),
    }));
    const lowVolume = advanceQuarter(first.state, { contractRenewals: [{
      contractId: 'asterion-contract-a', offeredPriceCentsPerMWQuarter: 51_000_000,
      offeredWorkloadMW: 7, termQuarters: 4,
    }] });
    expect(lowVolume.ok).toBe(true);
    if (!lowVolume.ok) return;
    expect(lowVolume.report.contractRenewals?.[0]?.status).toBe('rejected');
  });

  it('connects a rival renewal win to contract expiry, lost guaranteed revenue and customer reallocation', () => {
    let state = initializeGame(2035);
    const first = advanceQuarter(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;

    const renewA = advanceQuarter(state, { contractRenewals: [{
      contractId: 'asterion-contract-a', offeredPriceCentsPerMWQuarter: 53_000_000,
      offeredWorkloadMW: 8, termQuarters: 4,
    }] });
    expect(renewA.ok).toBe(true);
    if (!renewA.ok) return;
    expect(renewA.report.contractRenewals?.[0]?.status).toBe('accepted');
    state = renewA.state;

    const loseB = advanceQuarter(state, { contractRenewals: [{
      contractId: 'asterion-contract-b', offeredPriceCentsPerMWQuarter: 48_500_000,
      offeredWorkloadMW: 5, termQuarters: 4,
    }] });
    expect(loseB.ok).toBe(true);
    if (!loseB.ok) return;
    expect(loseB.report.contractRenewals?.[0]).toEqual(expect.objectContaining({
      status: 'rejected', competitorBidAvailable: true, competitorProviderId: 'kestrel-compute',
    }));
    state = loseB.state;

    let finalQuarter: ReturnType<typeof advanceQuarter> | undefined;
    while (state.quarter <= 5) {
      finalQuarter = advanceQuarter(state);
      expect(finalQuarter.ok).toBe(true);
      if (!finalQuarter.ok) return;
      state = finalQuarter.state;
    }

    expect(finalQuarter?.ok && finalQuarter.report.actorActions?.some((action) => action.kind === 'contract-expired')).toBe(true);
    expect(finalQuarter?.ok && finalQuarter.report.actorActions?.some((action) => action.kind === 'customer-allocation')).toBe(true);
    const asterion = state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    expect(asterion.hiddenMetrics.nodeworksContractMW).toBe(8);
    expect(asterion.hiddenMetrics.kestrelContractMW).toBe(15);
    expect(state.operatingCompanies[0]!.contracts.some((contract) => contract.id === 'asterion-contract-a')).toBe(true);
    expect(state.operatingCompanies[0]!.contracts.some((contract) => contract.id === 'asterion-contract-b')).toBe(false);

    const nextQuarter = buildQuarterReport(state);
    const nextFulfilled = nextQuarter.companies[0]!.operations.fulfilledContracts;
    expect(nextFulfilled.some((line) => line.contractId === 'asterion-contract-a')).toBe(true);
    expect(nextFulfilled.some((line) => line.contractId === 'asterion-contract-b')).toBe(false);
    expect(state.playerIntelligence.some((item) => item.metric === 'contractRenewalRisk:asterion-contract-b')).toBe(false);
  });

  it('lets Kestrel submit a confidential renewal bid when it has enough spare capacity', () => {
    let state = initializeGame(2035);
    const first = advanceQuarter(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = advanceQuarter(first.state);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    state = second.state;
    expect(state.quarter).toBe(3);
    const renewal = advanceQuarter(state, { contractRenewals: [{
      contractId: 'asterion-contract-b', offeredPriceCentsPerMWQuarter: 48_000_000,
      offeredWorkloadMW: 5, termQuarters: 4,
    }] });
    expect(renewal.ok).toBe(true);
    if (!renewal.ok) return;
    expect(renewal.report.contractRenewals?.[0]).toEqual(expect.objectContaining({
      status: 'rejected', competitorBidAvailable: true, competitorProviderId: 'kestrel-compute',
    }));
    expect(renewal.report.contractRenewals?.[0]?.message).not.toMatch(/\\d/);
    expect(renewal.state.operatingCompanies[0]!.contracts.find((item) => item.id === 'asterion-contract-b')!.termEndQuarter).toBe(5);
  });

  it('does not let a rival bid for a fixed contract beyond its spare capacity', () => {
    const first = advanceQuarter(initializeGame(2035));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const result = advanceQuarter(first.state, { contractRenewals: [{
      contractId: 'asterion-contract-a', offeredPriceCentsPerMWQuarter: 53_000_000,
      offeredWorkloadMW: 8, termQuarters: 4,
    }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.contractRenewals?.[0]?.status).toBe('accepted');
    expect(result.report.contractRenewals?.[0]?.competitorBidAvailable).not.toBe(true);
  });

  it('expires an unrenewed fixed contract and reallocates its guaranteed volume', () => {
    let state = initializeGame();
    let lastReport: ReturnType<typeof advanceQuarter> | undefined;
    for (let quarter = 0; quarter < 4; quarter += 1) {
      lastReport = advanceQuarter(state);
      expect(lastReport.ok).toBe(true);
      if (!lastReport.ok) return;
      state = lastReport.state;
    }
    expect(state.quarter).toBe(5);
    expect(state.operatingCompanies[0]!.contracts.some((item) => item.id === 'asterion-contract-a')).toBe(false);
    const asterion = state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    expect(asterion.hiddenMetrics.nodeworksContractMW).toBe(5);
    expect(lastReport?.ok && lastReport.report.actorActions?.some((action) => action.kind === 'contract-expired')).toBe(true);
  });

  it('accepts a competitive flexible-contract price offer effective next quarter', () => {
    const state = initializeGame();
    const originalPrice = state.operatingCompanies[0]!.contracts.find((item) => item.id === 'flexible-workload')!.priceCentsPerMWQuarter;
    const result = advanceQuarter(state, {
      contractOffers: [{ contractId: 'flexible-workload', offeredPriceCentsPerMWQuarter: 43_000_000 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.companies[0]!.operations.revenueCents).toBe(816_500_000);
    expect(result.report.contractNegotiations).toEqual([expect.objectContaining({
      contractId: 'flexible-workload', status: 'accepted', offeredPriceCents: 43_000_000,
    })]);
    expect(originalPrice).toBe(41_500_000);
    expect(result.state.operatingCompanies[0]!.contracts.find((item) => item.id === 'flexible-workload')!.priceCentsPerMWQuarter).toBe(43_000_000);
  });

  it('returns a customer counteroffer without silently changing contract terms', () => {
    const state = initializeGame();
    const result = advanceQuarter(state, {
      contractOffers: [{ contractId: 'flexible-workload', offeredPriceCentsPerMWQuarter: 47_000_000 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.contractNegotiations?.[0]).toEqual(expect.objectContaining({
      status: 'countered', counterPriceCents: 44_000_000,
    }));
    expect(result.state.operatingCompanies[0]!.contracts.find((item) => item.id === 'flexible-workload')!.priceCentsPerMWQuarter).toBe(41_500_000);
  });

  it('rejects an uncompetitive contract offer and validates duplicate or fixed-contract offers atomically', () => {
    const state = initializeGame();
    const before = JSON.stringify(state);
    const result = advanceQuarter(state, {
      contractOffers: [
        { contractId: 'flexible-workload', offeredPriceCentsPerMWQuarter: 60_000_000 },
        { contractId: 'asterion-contract-a', offeredPriceCentsPerMWQuarter: 40_000_000 },
        { contractId: 'flexible-workload', offeredPriceCentsPerMWQuarter: 42_000_000 },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((item) => item.code === 'command.contract_not_flexible')).toBe(true);
    expect(result.issues.some((item) => item.code === 'command.contract_offer_duplicate')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
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


describe('strategic initiatives and project lifecycle', () => {
  it('launches initiatives using leadership capacity and holding-company cash', () => {
    const state = initializeGame();
    const result = advanceQuarter(state, {
      launchInitiatives: ['capacity-expansion-phase-i', 'secure-equipment-allocation'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.leadershipCapacity).toBe(4);
    expect(result.report.leadershipCommitted).toBe(3);
    expect(result.report.projectsLaunched).toEqual([
      'capacity-expansion-phase-i',
      'secure-equipment-allocation',
    ]);
    expect(result.state.projects).toHaveLength(2);
    expect(result.state.equipmentOrders).toEqual([{
      id: 'nodeworks-equipment-q1', buyerId: 'nodeworks', quantityMWEquivalent: 6,
      placedQuarter: 1, deliveryQuarter: 3, status: 'reserved',
    }]);
    expect(result.state.projects[0]!.remainingQuarters).toBe(3);
    expect(result.state.organizations.find((item) => item.id === 'meridian-group')!.cashCents)
      .toBe(1_074_000_000);
    expect(state.projects).toHaveLength(0);
  });

  it('rejects an equipment reservation when the supplier delivery window is already committed', () => {
    const state = initializeGame();
    state.equipmentOrders = [{
      id: 'kestrel-equipment-q1', buyerId: 'kestrel-compute', quantityMWEquivalent: 8,
      placedQuarter: 1, deliveryQuarter: 3, status: 'reserved',
    }];
    const before = JSON.stringify(state);
    const result = advanceQuarter(state, { launchInitiatives: ['secure-equipment-allocation'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((item) => item.code === 'command.equipment_allocation_unavailable')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects a portfolio that exceeds executive leadership capacity', () => {
    const state = initializeGame();
    const before = JSON.stringify(state);
    const result = advanceQuarter(state, {
      launchInitiatives: [
        'capacity-expansion-phase-i',
        'negotiate-firm-power',
        'resilience-security-program',
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((item) => item.code === 'command.leadership_exceeded')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('progresses projects automatically and applies effects only on completion', () => {
    let state = initializeGame();
    const launch = advanceQuarter(state, { launchInitiatives: ['resilience-security-program'] });
    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    state = launch.state;
    expect(state.operatingCompanies[0]!.capacity.reliability).toBe(0.985);
    expect(state.projects[0]!.remainingQuarters).toBe(2);

    const second = advanceQuarter(state);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    state = second.state;
    expect(state.projects[0]!.remainingQuarters).toBe(1);
    expect(state.operatingCompanies[0]!.capacity.reliability).toBe(0.985);

    const third = advanceQuarter(state);
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.report.projectsCompleted).toEqual(['resilience-security-program']);
    expect(third.state.projects[0]!.remainingQuarters).toBe(0);
    expect(third.state.operatingCompanies[0]!.capacity.reliability).toBeCloseTo(0.99, 8);
  });

  it('rejects unknown and already-active initiatives', () => {
    const first = advanceQuarter(initializeGame(), {
      launchInitiatives: ['commission-market-study'],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = advanceQuarter(first.state, {
      launchInitiatives: ['commission-market-study', 'not-a-real-project'],
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.issues.some((item) => item.code === 'command.initiative_already_active')).toBe(true);
    expect(second.issues.some((item) => item.code === 'command.initiative_unknown')).toBe(true);
  });
});


describe('autonomous world simulation', () => {
  it('lets Asterion grow demand and Solara reprice a constrained energy market', () => {
    const result = advanceQuarter(initializeGame(2035));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const asterion = result.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    expect(asterion.hiddenMetrics.demandMW).toBeGreaterThan(28);
    expect(asterion.hiddenMetrics.flexibleDemandMW).toBeGreaterThan(5);
    expect(result.state.regionalMarkets[0]!.referenceEnergyPriceCentsPerMWh).toBeGreaterThan(7_200);
    expect(result.report.actorActions?.some((action) => action.actorId === 'asterion-ai')).toBe(true);
    expect(result.report.actorActions?.some((action) => action.actorId === 'solara-grid')).toBe(true);
  });


  it('makes Kestrel compete for the same scarce firm-power headroom as NodeWorks', () => {
    const state = initializeGame();
    state.actors = state.actors.map((actor) => actor.organizationId === 'kestrel-compute'
      ? { ...actor, hiddenMetrics: { ...actor.hiddenMetrics, expansionPipelineQuarters: 1, expansionOrderPlacedQuarter: 1 } }
      : actor);

    state.equipmentOrders.push({ id: 'kestrel-equipment-q1', buyerId: 'kestrel-compute', quantityMWEquivalent: 2, placedQuarter: 1, deliveryQuarter: 1, status: 'delivered' });
    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kestrel = result.state.actors.find((actor) => actor.organizationId === 'kestrel-compute')!;
    expect(kestrel.hiddenMetrics.effectiveCapacityMinMW).toBe(24);
    expect(kestrel.hiddenMetrics.expansionPipelineQuarters).toBe(0);
    expect(result.state.regionalMarkets[0]!.immediateFirmPowerHeadroomMW).toBe(0);
    expect(result.state.regionalMarkets[0]!.committedPowerMW).toBe(60);
    expect(result.report.actorActions?.some((action) =>
      action.actorId === 'kestrel-compute' && action.kind === 'capacity-expansion-completed')).toBe(true);
  });

  it('delays a completed rival build when the player has committed the remaining firm power', () => {
    const state = initializeGame();
    state.actors = state.actors.map((actor) => actor.organizationId === 'kestrel-compute'
      ? { ...actor, hiddenMetrics: { ...actor.hiddenMetrics, expansionPipelineQuarters: 1, expansionOrderPlacedQuarter: 1 } }
      : actor);
    state.equipmentOrders.push({ id: 'kestrel-equipment-q1', buyerId: 'kestrel-compute', quantityMWEquivalent: 2, placedQuarter: 1, deliveryQuarter: 1, status: 'delivered' });
    state.regionalMarkets = state.regionalMarkets.map((market) => ({
      ...market,
      immediateFirmPowerHeadroomMW: 0,
    }));

    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kestrel = result.state.actors.find((actor) => actor.organizationId === 'kestrel-compute')!;
    expect(kestrel.hiddenMetrics.effectiveCapacityMinMW).toBe(22);
    expect(kestrel.hiddenMetrics.expansionPipelineQuarters).toBe(1);
    expect(result.state.regionalMarkets[0]!.committedPowerMW).toBe(58);
    expect(result.report.actorActions?.some((action) =>
      action.actorId === 'kestrel-compute' && action.kind === 'capacity-expansion-delayed')).toBe(true);
  });

  it('reallocates only flexible Asterion demand using price, reliability, capacity and concentration', () => {
    const result = advanceQuarter(initializeGame(2035));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const asterion = result.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    const allocationTotal = (asterion.hiddenMetrics.nodeworksFlexibleMW ?? 0) + (asterion.hiddenMetrics.kestrelFlexibleMW ?? 0) + (asterion.hiddenMetrics.otherFlexibleMW ?? 0);
    const flexibleDemand = asterion.hiddenMetrics.flexibleDemandMW ?? 0;
    expect(allocationTotal).toBeCloseTo(flexibleDemand, 8);
    expect(asterion.hiddenMetrics.nodeworksFlexibleMW).toBeGreaterThan(0);
    expect(asterion.hiddenMetrics.kestrelFlexibleMW).toBeGreaterThan(0);
    expect(asterion.hiddenMetrics.otherFlexibleMW).toBeGreaterThan(0);
    expect(asterion.hiddenMetrics.nodeworksFlexibleMW).toBeLessThanOrEqual(6.7);
    expect(result.state.operatingCompanies[0]!.contracts.find((contract) => contract.flexibility === 'contracted')!.workloadMW).toBe(8);
    expect(result.state.operatingCompanies[0]!.contracts.find((contract) => contract.id === 'flexible-workload')!.workloadMW).toBeCloseTo(asterion.hiddenMetrics.nodeworksFlexibleMW!, 8);
    expect(result.state.operatingCompanies[0]!.deliveredWorkloadMW).toBeCloseTo(Math.min(17, 13 + asterion.hiddenMetrics.nodeworksFlexibleMW!), 8);
    expect(result.report.actorActions?.some((action) => action.kind === 'customer-allocation')).toBe(true);

    // The rebalanced contract is recognised in the following quarter's
    // operating report, not retroactively in the quarter just resolved.
    const nextQuarterReport = buildQuarterReport(result.state);
    expect(nextQuarterReport.quarter).toBe(2);
    expect(nextQuarterReport.companies[0]!.operations.deliveredWorkloadMW)
      .toBeCloseTo(result.state.operatingCompanies[0]!.deliveredWorkloadMW, 8);
    expect(nextQuarterReport.companies[0]!.operations.revenueCents).toBeLessThan(816_500_000);
  });


  it('lets Kestrel reprice against NodeWorks and makes the new offer affect Asterion allocation', () => {
    const state = initializeGame(2035);
    const kestrelBefore = state.actors.find((actor) => actor.organizationId === 'kestrel-compute')!;
    const originalPrice = kestrelBefore.hiddenMetrics.priceCentsPerMWQuarter!;
    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kestrelAfter = result.state.actors.find((actor) => actor.organizationId === 'kestrel-compute')!;
    const asterion = result.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    expect(kestrelAfter.hiddenMetrics.priceCentsPerMWQuarter).not.toBe(originalPrice);
    expect(result.report.actorActions?.some((action) =>
      action.actorId === 'kestrel-compute' && action.kind === 'competitor-commercial-terms')).toBe(true);
    expect(asterion.hiddenMetrics.kestrelFlexibleMW).toBeGreaterThan(0);
    expect(asterion.hiddenMetrics.nodeworksFlexibleMW).toBeGreaterThan(0);
    const publicAction = result.report.actorActions?.find((action) => action.kind === 'competitor-commercial-terms');
    expect(publicAction?.summary).not.toMatch(/[0-9]/);
  });

  it('makes a capacity-constrained Kestrel protect price rather than chase volume', () => {
    const state = initializeGame(2035);
    state.actors = state.actors.map((actor) => actor.organizationId === 'kestrel-compute'
      ? { ...actor, hiddenMetrics: { ...actor.hiddenMetrics, effectiveCapacityMW: 20, currentWorkloadMW: 19.5, priceCentsPerMWQuarter: 40_500_000 } }
      : actor);
    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kestrel = result.state.actors.find((actor) => actor.organizationId === 'kestrel-compute')!;
    expect(kestrel.hiddenMetrics.priceCentsPerMWQuarter).toBeGreaterThan(40_500_000);
  });

  it('keeps customer allocation deterministic and does not expose rival allocation metrics in public action text', () => {
    const first = advanceQuarter(initializeGame(77));
    const second = advanceQuarter(initializeGame(77));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const firstCustomer = first.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    const secondCustomer = second.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    expect(firstCustomer.hiddenMetrics).toEqual(secondCustomer.hiddenMetrics);
    const action = first.report.actorActions?.find((item) => item.kind === 'customer-allocation');
    expect(action?.summary).not.toMatch(/[0-9]/);
  });
  it('produces the same autonomous world outcome from the same seed and quarter', () => {
    const first = advanceQuarter(initializeGame(12345));
    const second = advanceQuarter(initializeGame(12345));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state.actors).toEqual(second.state.actors);
    expect(first.state.regionalMarkets).toEqual(second.state.regionalMarkets);
    expect(first.report.actorActions).toEqual(second.report.actorActions);
  });
});


  it('keeps the autonomous world coherent through twelve consecutive quarters', () => {
    let state = initializeGame(2035);
    const startingDemand = state.actors.find((actor) => actor.organizationId === 'asterion-ai')!.hiddenMetrics.demandMW;
    const observedActions = new Set<string>();
    let relationshipAfterLastFixedContract: number | undefined;

    for (let index = 0; index < 12; index += 1) {
      const result = advanceQuarter(state);
      expect(result.ok, `quarter ${state.quarter} should resolve`).toBe(true);
      if (!result.ok) return;
      expect(result.report.quarter).toBe(state.quarter);
      for (const action of result.report.actorActions ?? []) observedActions.add(action.kind);
      state = result.state;
      if (state.quarter === 6) relationshipAfterLastFixedContract = state.actors.find((actor) => actor.organizationId === 'asterion-ai')!.hiddenMetrics.relationshipScore;
      expect(validateGameState(state)).toEqual([]);
      expect(state.quarter).toBe(index + 2);
      for (const organization of state.organizations) {
        expect(Number.isSafeInteger(organization.cashCents)).toBe(true);
        expect(Number.isSafeInteger(organization.debtCents)).toBe(true);
      }
      for (const actor of state.actors) {
        for (const metric of Object.values(actor.hiddenMetrics)) {
          expect(Number.isFinite(metric)).toBe(true);
        }
      }
    }

    const finalDemand = state.actors.find((actor) => actor.organizationId === 'asterion-ai')!.hiddenMetrics.demandMW;
    expect(finalDemand).toBeGreaterThan(startingDemand);
    expect(observedActions.has('demand-growth')).toBe(true);
    expect(observedActions.has('customer-allocation')).toBe(true);
    expect(state.playerIntelligence.some((item) => item.metric.startsWith('contractRenewalRisk:'))).toBe(false);
    expect(state.operatingCompanies[0]!.contracts.some((contract) => contract.id === 'asterion-contract-a')).toBe(false);
    expect(state.operatingCompanies[0]!.contracts.some((contract) => contract.id === 'asterion-contract-b')).toBe(false);
    expect(state.actors.find((actor) => actor.organizationId === 'asterion-ai')!.hiddenMetrics.relationshipScore)
      .toBe(relationshipAfterLastFixedContract);
  });

describe('customer relationship and renewal intelligence', () => {
  it('tracks service history and shifts Asterion private renewal terms', () => {
    const state = initializeGame();
    const asterionBefore = state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    const initialMax = asterionBefore.hiddenMetrics['renewalMaxPrice:asterion-contract-a']!;
    const breachedState = {
      ...state,
      operatingCompanies: state.operatingCompanies.map((company) => ({
        ...company,
        capacity: { ...company.capacity, reliability: 0.97 },
      })),
    };
    const result = advanceQuarter(breachedState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const asterionAfter = result.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    const nodeworksAfter = result.state.organizations.find((item) => item.id === 'nodeworks')!;
    expect(asterionAfter.hiddenMetrics.relationshipScore).toBeLessThan(65);
    expect(asterionAfter.hiddenMetrics.slaBreachStreak).toBe(1);
    expect(asterionAfter.hiddenMetrics['renewalMaxPrice:asterion-contract-a']).toBeLessThan(initialMax);
    expect(nodeworksAfter.reputation).toBeLessThan(74);
  });

  it('improves customer relationship after reliable service and publishes only an estimated renewal risk', () => {
    const result = advanceQuarter(initializeGame(2035));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const asterion = result.state.actors.find((actor) => actor.organizationId === 'asterion-ai')!;
    expect(asterion.hiddenMetrics.relationshipScore).toBeGreaterThan(65);
    const risk = result.state.playerIntelligence.find((item) =>
      item.metric === 'contractRenewalRisk:asterion-contract-a');
    expect(risk).toBeDefined();
    expect(risk!.knowledge).toBe('estimated');
    expect(risk!.min).toBeGreaterThanOrEqual(0);
    expect(risk!.max).toBeLessThanOrEqual(100);
    expect(risk!.confidence).toBeLessThan(1);
    expect(risk!.metric).not.toContain('renewalMaxPrice');
    expect(result.state.playerIntelligence.some((item) => item.metric === 'renewalMaxPrice:asterion-contract-a')).toBe(false);
  });

  it('keeps relationship outcomes and intelligence deterministic for the same seed', () => {
    const first = advanceQuarter(initializeGame(991));
    const second = advanceQuarter(initializeGame(991));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state.actors.find((actor) => actor.organizationId === 'asterion-ai')?.hiddenMetrics)
      .toEqual(second.state.actors.find((actor) => actor.organizationId === 'asterion-ai')?.hiddenMetrics);
    expect(first.state.playerIntelligence).toEqual(second.state.playerIntelligence);
  });
});
