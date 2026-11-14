import type { GameState, ValidationIssue } from './types';

const isFiniteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

export function validateGameState(state: GameState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const organizationIds = new Set(state.organizations.map((item) => item.id));
  const companyIds = new Set(state.operatingCompanies.map((item) => item.organizationId));
  const actorIds = new Set(state.actors.map((item) => item.organizationId));
  const marketIds = new Set(state.regionalMarkets.map((item) => item.id));

  if (state.schemaVersion !== 1 || typeof state.scenarioId !== 'string' || state.scenarioId.trim().length === 0 ||
      typeof state.scenarioVersion !== 'string' || state.scenarioVersion.trim().length === 0 ||
      !Number.isSafeInteger(state.seed) || state.seed < 0) {
    issues.push({ code: 'state.metadata_invalid', message: 'Schema version, scenario identity, version, and non-negative integer seed must be valid.' });
  }
  if (organizationIds.size !== state.organizations.length) {
    issues.push({ code: 'organization.id_duplicate', message: 'Organization IDs must be unique.' });
  }
  if (companyIds.size !== state.operatingCompanies.length) {
    issues.push({ code: 'company.id_duplicate', message: 'Operating company organization IDs must be unique.' });
  }
  if (actorIds.size !== state.actors.length) {
    issues.push({ code: 'actor.id_duplicate', message: 'Actor organization IDs must be unique.' });
  }
  if (marketIds.size !== state.regionalMarkets.length) {
    issues.push({ code: 'market.id_duplicate', message: 'Regional market IDs must be unique.' });
  }

  if (!Number.isInteger(state.quarter) || state.quarter < 1) {
    issues.push({ code: 'quarter.invalid', message: 'Quarter must be a positive integer.' });
  }
  if (!organizationIds.has(state.holding.organizationId) ||
      !Number.isSafeInteger(state.holding.leadershipCapacityPerQuarter) || state.holding.leadershipCapacityPerQuarter < 0 ||
      !Number.isFinite(state.holding.institutionalAccess) || state.holding.institutionalAccess < 0 || state.holding.institutionalAccess > 100 ||
      !Number.isSafeInteger(state.holding.revolverLimitCents) || state.holding.revolverLimitCents < 0 ||
      !['balanced', 'growth', 'conservative'].includes(state.holding.strategicRiskPolicy)) {
    issues.push({ code: 'holding.state_invalid', message: 'Holding organization, leadership capacity, institutional access, revolver limit, or risk policy is invalid.', entityId: state.holding.organizationId });
  }

  for (const organization of state.organizations) {
    if (!Number.isSafeInteger(organization.cashCents) || !Number.isSafeInteger(organization.debtCents)) {
      issues.push({ code: 'finance.money_not_integer', message: 'Cash and debt must use integer cents.', entityId: organization.id });
    }
    if (Number.isSafeInteger(organization.debtCents) && organization.debtCents < 0) {
      issues.push({ code: 'finance.debt_negative', message: 'Reported debt cannot be negative.', entityId: organization.id });
    }
    if (typeof organization.id !== 'string' || organization.id.trim().length === 0 ||
        typeof organization.name !== 'string' || organization.name.trim().length === 0 ||
        !['holding', 'operating_company', 'supplier', 'customer', 'competitor', 'institution', 'lender'].includes(organization.kind)) {
      issues.push({ code: 'organization.identity_invalid', message: 'Organization identity, name, or kind is invalid.', entityId: organization.id });
    }
    if (Number.isSafeInteger(organization.cashCents) && organization.cashCents < 0) {
      issues.push({ code: 'finance.cash_negative', message: 'Cash cannot be negative until an explicit overdraft or insolvency mechanism is modeled.', entityId: organization.id });
    }
    if (!Number.isFinite(organization.reputation) || organization.reputation < 0 || organization.reputation > 100) {
      issues.push({ code: 'organization.reputation_out_of_range', message: 'Reputation must be between 0 and 100.', entityId: organization.id });
    }
  }

  const debtIds = new Set<string>();
  const debtByBorrower = new Map<string, number>();
  for (const debt of state.debts) {
    if (debtIds.has(debt.id)) {
      issues.push({ code: 'finance.debt_id_duplicate', message: 'Debt instrument IDs must be unique.', entityId: debt.id });
    }
    debtIds.add(debt.id);
    if (!organizationIds.has(debt.borrowerId) || !Number.isSafeInteger(debt.principalCents) ||
        debt.principalCents < 0 || (debt.collateralDescription !== undefined && (typeof debt.collateralDescription !== 'string' || debt.collateralDescription.length > 160)) || !Number.isFinite(debt.quarterlyInterestRate) ||
        debt.quarterlyInterestRate < 0 ||
        (debt.scheduledPrincipalCentsPerQuarter !== undefined &&
          (!Number.isSafeInteger(debt.scheduledPrincipalCentsPerQuarter) || debt.scheduledPrincipalCentsPerQuarter < 0)) ||
        (debt.maturityQuarter !== undefined && (!Number.isInteger(debt.maturityQuarter) || debt.maturityQuarter < 1)) ||
        (debt.arrearsPrincipalCents !== undefined && (!Number.isSafeInteger(debt.arrearsPrincipalCents) || debt.arrearsPrincipalCents < 0 || debt.arrearsPrincipalCents > debt.principalCents)) ||
        (debt.arrearsInterestCents !== undefined && (!Number.isSafeInteger(debt.arrearsInterestCents) || debt.arrearsInterestCents < 0)) ||
        (debt.overdueQuarters !== undefined && (!Number.isInteger(debt.overdueQuarters) || debt.overdueQuarters < 0)) ||
        (debt.paymentStatus !== undefined && !['current', 'overdue', 'defaulted', 'settled'].includes(debt.paymentStatus)) ||
        (debt.crossDefaultClause !== undefined && typeof debt.crossDefaultClause !== 'boolean') ||
        (debt.accelerationNoticeQuarter !== undefined && (!Number.isInteger(debt.accelerationNoticeQuarter) || debt.accelerationNoticeQuarter < 1)) ||
        (debt.acceleratedAtQuarter !== undefined && (!Number.isInteger(debt.acceleratedAtQuarter) || debt.acceleratedAtQuarter < 1 || debt.accelerationNoticeQuarter === undefined || debt.acceleratedAtQuarter <= debt.accelerationNoticeQuarter)) ||
        (debt.facilityLimitCents !== undefined &&
          (!Number.isSafeInteger(debt.facilityLimitCents) || debt.facilityLimitCents < debt.principalCents))) {
      issues.push({ code: 'finance.debt_invalid', message: 'Debt instrument has an invalid borrower, principal, interest rate, or facility limit.', entityId: debt.id });
    }
    if (debt.lenderId !== undefined && (!organizationIds.has(debt.lenderId) || !state.lenders.some((lender) => lender.organizationId === debt.lenderId))) {
      issues.push({ code: 'finance.debt_lender_missing', message: 'Debt instrument references a missing lender policy.', entityId: debt.id });
    }
    debtByBorrower.set(debt.borrowerId, (debtByBorrower.get(debt.borrowerId) ?? 0) + debt.principalCents);
  }
  for (const organization of state.organizations) {
    if ((debtByBorrower.get(organization.id) ?? 0) !== organization.debtCents) {
      issues.push({ code: 'finance.debt_ledger_mismatch', message: 'Organization debt balance does not match the sum of its debt instruments.', entityId: organization.id });
    }
  }

  const validateCovenants = (terms: import('./types').DebtCovenantTerms | undefined, entityId: string) => {
    if (!terms) return;
    if ((terms.minimumDebtServiceCoverage !== undefined && (!Number.isFinite(terms.minimumDebtServiceCoverage) || terms.minimumDebtServiceCoverage < 0)) ||
        (terms.maximumDebtToAnnualCashFlow !== undefined && (!Number.isFinite(terms.maximumDebtToAnnualCashFlow) || terms.maximumDebtToAnnualCashFlow <= 0)) ||
        (terms.restrictAdditionalBorrowing !== undefined && typeof terms.restrictAdditionalBorrowing !== 'boolean') ||
        (terms.graceQuarters !== undefined && (!Number.isInteger(terms.graceQuarters) || terms.graceQuarters < 0 || terms.graceQuarters > 8)) ||
        (terms.breachRatePremium !== undefined && (!Number.isFinite(terms.breachRatePremium) || terms.breachRatePremium < 0 || terms.breachRatePremium > 0.1))) {
      issues.push({ code: 'finance.covenant_terms_invalid', message: 'Debt covenant terms contain an invalid threshold or policy.', entityId });
    }
  };
  for (const debt of state.debts) {
    validateCovenants(debt.covenantTerms, debt.id);
    if (debt.crossDefaultedByDebtId !== undefined && (debt.crossDefaultedByDebtId === debt.id || !debtIds.has(debt.crossDefaultedByDebtId))) {
      issues.push({ code: 'finance.cross_default_source_invalid', message: 'Cross-default source must reference another existing debt instrument.', entityId: debt.id });
    }
    if (debt.crossDefaultedByDebtId !== undefined && !state.debts.some((item) => item.id === debt.crossDefaultedByDebtId && item.borrowerId === debt.borrowerId && item.paymentStatus === 'defaulted')) {
      issues.push({ code: 'finance.cross_default_source_invalid', message: 'Cross-default source must be a currently defaulted instrument of the same legal borrower.', entityId: debt.id });
    }
    if ((debt.covenantStartQuarter !== undefined && (!Number.isInteger(debt.covenantStartQuarter) || debt.covenantStartQuarter < 1)) ||
        (debt.covenantBreachStreak !== undefined && (!Number.isInteger(debt.covenantBreachStreak) || debt.covenantBreachStreak < 0)) ||
        (debt.covenantStatus !== undefined && !['compliant', 'grace', 'breached'].includes(debt.covenantStatus)) ||
        (debt.covenantPenaltyApplied !== undefined && typeof debt.covenantPenaltyApplied !== 'boolean')) {
      issues.push({ code: 'finance.covenant_state_invalid', message: 'Debt covenant monitoring state is invalid.', entityId: debt.id });
    }
  }

  const lenderIds = new Set<string>();
  for (const lender of state.lenders) {
    if (lenderIds.has(lender.organizationId)) issues.push({ code: 'finance.lender_duplicate', message: 'Lender organization IDs must be unique.', entityId: lender.organizationId });
    lenderIds.add(lender.organizationId);
    if (!organizationIds.has(lender.organizationId) ||
        !Number.isSafeInteger(lender.availableCapacityCents) || lender.availableCapacityCents < 0 ||
        !Number.isFinite(lender.baseQuarterlyInterestRate) || lender.baseQuarterlyInterestRate < 0 ||
        !Number.isInteger(lender.minimumCreditScore) || lender.minimumCreditScore < 300 || lender.minimumCreditScore > 850 ||
        !Number.isFinite(lender.maxLoanToAnnualCashFlow) || lender.maxLoanToAnnualCashFlow <= 0 ||
        !['conservative', 'balanced', 'growth'].includes(lender.riskAppetite)) {
      issues.push({ code: 'finance.lender_invalid', message: 'Lender capacity or policy is invalid.', entityId: lender.organizationId });
    }
  }
  const loanOfferIds = new Set<string>();
  for (const offer of state.loanOffers) {
    if (loanOfferIds.has(offer.id)) issues.push({ code: 'finance.loan_offer_duplicate', message: 'Loan offer IDs must be unique.', entityId: offer.id });
    loanOfferIds.add(offer.id);
    validateCovenants(offer.covenantTerms, offer.id);
    if (!lenderIds.has(offer.lenderId) || !organizationIds.has(offer.borrowerId) ||
        !Number.isSafeInteger(offer.principalCents) || offer.principalCents <= 0 ||
        !Number.isFinite(offer.quarterlyInterestRate) || offer.quarterlyInterestRate < 0 ||
        !Number.isInteger(offer.creditScore) || offer.creditScore < 300 || offer.creditScore > 850 ||
        !['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'].includes(offer.creditRating) ||
        !Number.isInteger(offer.maturityQuarter) || offer.maturityQuarter < 1 ||
        !Number.isInteger(offer.expiresAfterQuarter) || offer.expiresAfterQuarter < 1 ||
        (offer.collateralDescription !== undefined && (typeof offer.collateralDescription !== 'string' || offer.collateralDescription.length > 160)) ||
        !['available', 'accepted', 'expired', 'withdrawn'].includes(offer.status)) {
      issues.push({ code: 'finance.loan_offer_invalid', message: 'Loan offer contains an invalid lender, borrower, amount, rate, schedule, or status.', entityId: offer.id });
    }
  }

  const payableIds = new Set<string>();
  for (const payable of state.operatingPayables ?? []) {
    if (payableIds.has(payable.id)) {
      issues.push({ code: 'finance.operating_payable_duplicate', message: 'Operating payable IDs must be unique.', entityId: payable.id });
    }
    payableIds.add(payable.id);
    if (typeof payable.id !== 'string' || payable.id.trim().length === 0 ||
        !organizationIds.has(payable.entityId) ||
        !['energy', 'payroll', 'maintenance', 'network-vendor', 'tax-overhead'].includes(payable.creditorClass) ||
        !Number.isSafeInteger(payable.originalAmountCents) || payable.originalAmountCents <= 0 ||
        !Number.isSafeInteger(payable.outstandingAmountCents) || payable.outstandingAmountCents < 0 ||
        payable.outstandingAmountCents > payable.originalAmountCents ||
        !Number.isInteger(payable.incurredQuarter) || payable.incurredQuarter < 1 || payable.incurredQuarter > state.quarter ||
        !Number.isInteger(payable.dueQuarter) || payable.dueQuarter < payable.incurredQuarter ||
        !Number.isSafeInteger(payable.priority) || payable.priority < 1) {
      issues.push({ code: 'finance.operating_payable_invalid', message: 'Operating payable must reference a legal entity and contain valid amounts, dates, class, and priority.', entityId: payable.id });
    }
  }

  const turnaroundIds = new Set(['workforce-reset', 'maintenance-deferral', 'vendor-renegotiation', 'facility-consolidation']);
  for (const company of state.operatingCompanies) {
    const actions = company.turnaroundActions ?? [];
    if (new Set(actions).size !== actions.length || actions.some((action) => !turnaroundIds.has(action))) {
      issues.push({ code: 'company.turnaround_actions_invalid', message: 'Turnaround actions must be unique and scenario-supported.', entityId: company.organizationId });
    }
  }

  for (const company of state.operatingCompanies) {
    if (!organizationIds.has(company.organizationId)) {
      issues.push({ code: 'company.organization_missing', message: 'Operating company references a missing organization.', entityId: company.organizationId });
    }
    if (!Number.isInteger(company.issuedShares) || company.issuedShares <= 0) {
      issues.push({ code: 'ownership.issued_shares_invalid', message: 'Issued shares must be a positive integer.', entityId: company.organizationId });
    }
    const capacity = company.capacity;
    for (const [name, value] of Object.entries({
      installedITMW: capacity.installedITMW,
      gridAllocationMW: capacity.gridAllocationMW,
      commissionedEquipmentMW: capacity.commissionedEquipmentMW,
      operationalLimitMW: capacity.operationalLimitMW,
    })) {
      if (!isFiniteNonNegative(value)) {
        issues.push({ code: 'capacity.invalid', message: `${name} must be finite and non-negative.`, entityId: company.organizationId });
      }
    }
    if (!Number.isFinite(capacity.reliability) || capacity.reliability < 0 || capacity.reliability > 1) {
      issues.push({ code: 'capacity.reliability_invalid', message: 'Reliability must be between 0 and 1.', entityId: company.organizationId });
    }
    if (!isFiniteNonNegative(company.deliveredWorkloadMW)) {
      issues.push({ code: 'workload.invalid', message: 'Delivered workload must be finite and non-negative.', entityId: company.organizationId });
    }
    const cashCostFields = {
      operationsAndStaffingCents: company.cashCosts?.operationsAndStaffingCents,
      maintenanceCents: company.cashCosts?.maintenanceCents,
      networkAndConnectivityCents: company.cashCosts?.networkAndConnectivityCents,
      overheadComplianceInsuranceCents: company.cashCosts?.overheadComplianceInsuranceCents,
    };
    for (const [name, value] of Object.entries(cashCostFields)) {
      if (!Number.isSafeInteger(value) || value! < 0) {
        issues.push({ code: 'company.cash_cost_invalid', message: `${name} must be a non-negative integer number of cents.`, entityId: company.organizationId });
      }
    }
    if (company.contracts.some((contract) => contract.providerId !== company.organizationId)) {
      issues.push({ code: 'contract.provider_mismatch', message: 'Every service contract must name its containing operating company as provider.', entityId: company.organizationId });
    }
  }

  const ownershipPairs = new Set<string>();
  for (const stake of state.ownership) {
    const pair = `${stake.ownerId}::${stake.companyId}`;
    if (ownershipPairs.has(pair)) {
      issues.push({ code: 'ownership.stake_duplicate', message: 'An owner may have only one ownership ledger entry per company.', entityId: stake.companyId });
    }
    ownershipPairs.add(pair);
    if (!organizationIds.has(stake.ownerId) || !companyIds.has(stake.companyId) ||
        !Number.isInteger(stake.shares) || stake.shares < 0 ||
        !Number.isInteger(stake.votingShares) || stake.votingShares < 0 ||
        stake.votingShares > stake.shares) {
      issues.push({ code: 'ownership.stake_invalid', message: 'Ownership stake must reference an existing owner and company and contain valid share counts.', entityId: stake.companyId });
    }
  }

  for (const companyId of companyIds) {
    const company = state.operatingCompanies.find((item) => item.organizationId === companyId);
    if (!company) continue;
    const stakes = state.ownership.filter((stake) => stake.companyId === companyId);
    const totalShares = stakes.reduce((sum, stake) => sum + stake.shares, 0);
    const totalVotingShares = stakes.reduce((sum, stake) => sum + stake.votingShares, 0);
    if (totalShares !== company.issuedShares) {
      issues.push({
        code: 'ownership.share_ledger_mismatch',
        message: `Ownership ledger has ${totalShares} shares; ${company.issuedShares} are issued.`,
        entityId: companyId,
      });
    }
    if (totalVotingShares !== company.issuedShares) {
      issues.push({
        code: 'ownership.voting_ledger_mismatch',
        message: `Voting ledger has ${totalVotingShares} votes; ${company.issuedShares} are issued.`,
        entityId: companyId,
      });
    }
  }

  const regionalIds = new Set<string>();
  for (const market of state.regionalMarkets) {
    if (regionalIds.has(market.id)) issues.push({ code: 'market.id_duplicate', message: 'Regional market IDs must be unique.', entityId: market.id });
    regionalIds.add(market.id);
    if (typeof market.id !== 'string' || market.id.trim().length === 0 ||
        typeof market.name !== 'string' || market.name.trim().length === 0 ||
        !Number.isFinite(market.quarterHours) || market.quarterHours <= 0 ||
        !isFiniteNonNegative(market.availablePowerMW) || !isFiniteNonNegative(market.committedPowerMW) ||
        !Number.isSafeInteger(market.referenceEnergyPriceCentsPerMWh) || market.referenceEnergyPriceCentsPerMWh < 0 ||
        !isFiniteNonNegative(market.immediateFirmPowerHeadroomMW) ||
        !isFiniteNonNegative(market.equipmentDeliveryPoolMWEquivalentPerQuarter)) {
      issues.push({ code: 'market.state_invalid', message: 'Regional market hours, power, energy price, headroom, or equipment pool contain invalid values.', entityId: market.id });
    }
  }

  for (const actor of state.actors) {
    if (!organizationIds.has(actor.organizationId) || !Array.isArray(actor.goals) ||
        actor.goals.some((goal) => typeof goal !== 'string') ||
        actor.hiddenMetrics === null || typeof actor.hiddenMetrics !== 'object' || Array.isArray(actor.hiddenMetrics)) {
      issues.push({ code: 'actor.state_invalid', message: 'Actor must reference an existing organization and contain valid goals and hidden metrics.', entityId: actor.organizationId });
      continue;
    }
    for (const [metric, value] of Object.entries(actor.hiddenMetrics)) {
      if (typeof metric !== 'string' || metric.trim().length === 0 || !Number.isFinite(value)) {
        issues.push({ code: 'actor.metric_invalid', message: 'Actor hidden metrics must have non-empty keys and finite numeric values.', entityId: actor.organizationId });
      }
    }
  }

  for (const estimate of state.playerIntelligence) {
    if (!organizationIds.has(estimate.subjectId) || typeof estimate.metric !== 'string' || estimate.metric.trim().length === 0 ||
        !Number.isFinite(estimate.min) || !Number.isFinite(estimate.max) || estimate.min > estimate.max ||
        !Number.isFinite(estimate.confidence) || estimate.confidence < 0 || estimate.confidence > 1 ||
        !Number.isInteger(estimate.observedQuarter) || estimate.observedQuarter < 1 || estimate.observedQuarter > state.quarter ||
        typeof estimate.source !== 'string' || estimate.source.trim().length === 0 ||
        !['known', 'reported', 'estimated', 'unknown'].includes(estimate.knowledge)) {
      issues.push({ code: 'intelligence.estimate_invalid', message: 'Intelligence estimate has an invalid subject, range, confidence, observation quarter, knowledge class, or source.', entityId: estimate.subjectId });
    }
  }

  const contractIds = new Set<string>();
  const equipmentOrderIds = new Set<string>();
  for (const order of state.equipmentOrders) {
    if (equipmentOrderIds.has(order.id)) issues.push({ code: 'equipment.order_id_duplicate', message: 'Equipment order IDs must be unique.', entityId: order.id });
    equipmentOrderIds.add(order.id);
    if (typeof order.id !== 'string' || order.id.trim().length === 0 ||
        !organizationIds.has(order.buyerId) || !isFiniteNonNegative(order.quantityMWEquivalent) ||
        order.quantityMWEquivalent <= 0 || !Number.isInteger(order.placedQuarter) ||
        order.placedQuarter < 1 || !Number.isInteger(order.deliveryQuarter) ||
        order.deliveryQuarter < order.placedQuarter ||
        !['reserved', 'delivered', 'cancelled'].includes(order.status)) {
      issues.push({ code: 'equipment.order_invalid', message: 'Equipment order contains an invalid buyer, quantity, schedule, or status.', entityId: order.id });
    }
  }
  const equipmentMarket = state.regionalMarkets[0];
  if (equipmentMarket) {
    const reservedByQuarter = new Map<number, number>();
    for (const order of state.equipmentOrders) {
      if (order.status !== 'reserved') continue;
      reservedByQuarter.set(order.deliveryQuarter, (reservedByQuarter.get(order.deliveryQuarter) ?? 0) + order.quantityMWEquivalent);
    }
    for (const [deliveryQuarter, reserved] of reservedByQuarter) {
      if (reserved + 2 > equipmentMarket.equipmentDeliveryPoolMWEquivalentPerQuarter) {
        issues.push({ code: 'equipment.delivery_pool_overcommitted', message: `Equipment reservations for quarter ${deliveryQuarter} exceed the supplier pool after NodeWorks' standing 2 MW-equivalent allocation.` });
      }
    }
  }

  const projectIds = new Set<string>();
  for (const project of state.projects) {
    if (projectIds.has(project.id)) issues.push({ code: 'project.id_duplicate', message: 'Strategic project IDs must be unique.', entityId: project.id });
    projectIds.add(project.id);
    if (typeof project.id !== 'string' || project.id.trim().length === 0 ||
        typeof project.initiativeId !== 'string' || project.initiativeId.trim().length === 0 ||
        !Number.isInteger(project.startedQuarter) || project.startedQuarter < 1 || project.startedQuarter > state.quarter ||
        !Number.isInteger(project.remainingQuarters) || project.remainingQuarters < 0 ||
        !Number.isFinite(project.leadershipCost) || project.leadershipCost < 0 ||
        !Number.isSafeInteger(project.initialCostCents) || project.initialCostCents < 0) {
      issues.push({ code: 'project.state_invalid', message: 'Strategic project contains invalid timing, leadership, or cost data.', entityId: project.id });
    }
  }

  for (const contract of state.operatingCompanies.flatMap((company) => company.contracts)) {
    if (contractIds.has(contract.id)) issues.push({ code: 'contract.id_duplicate', message: 'Service contract IDs must be unique across the campaign.', entityId: contract.id });
    contractIds.add(contract.id);
    if (!organizationIds.has(contract.customerId) || !organizationIds.has(contract.providerId)) {
      issues.push({ code: 'contract.organization_missing', message: 'Contract references a missing organization.', entityId: contract.id });
    }
    if (typeof contract.id !== 'string' || contract.id.trim().length === 0 ||
        !['contracted', 'flexible'].includes(contract.flexibility) ||
        !isFiniteNonNegative(contract.workloadMW) || !Number.isSafeInteger(contract.priceCentsPerMWQuarter) || contract.priceCentsPerMWQuarter < 0 ||
        (contract.termEndQuarter !== undefined && (!Number.isInteger(contract.termEndQuarter) || contract.termEndQuarter < 1)) ||
        (contract.renewalNoticeQuarters !== undefined && (!Number.isInteger(contract.renewalNoticeQuarters) || contract.renewalNoticeQuarters < 0)) ||
        (contract.minimumWorkloadMW !== undefined && (!isFiniteNonNegative(contract.minimumWorkloadMW) || contract.minimumWorkloadMW > contract.workloadMW)) ||
        (contract.slaTargetReliability !== undefined && (!Number.isFinite(contract.slaTargetReliability) || contract.slaTargetReliability < 0 || contract.slaTargetReliability > 1)) ||
        (contract.slaServiceCreditBps !== undefined && (!Number.isInteger(contract.slaServiceCreditBps) || contract.slaServiceCreditBps < 0 || contract.slaServiceCreditBps > 10_000))) {
      issues.push({ code: 'contract.value_invalid', message: 'Contract workload and price must be valid.', entityId: contract.id });
    }
  }

  return issues;
}
