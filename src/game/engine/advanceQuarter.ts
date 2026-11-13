import { validateGameState } from '../domain/invariants';
import { moneyFromCents } from '../domain/money';
import type { GameState, StrategicProjectState, ValidationIssue } from '../domain/types';
import { getInitiativeDefinition } from '../scenario/initiatives';
import { advanceAutonomousActors, getRivalRenewalBid } from '../systems/actors';
import { buildQuarterReport, type ContractNegotiationResult, type ContractRenewalResult, type QuarterReport } from '../systems/quarterReport';

export interface WorkloadDecision {
  companyId: string;
  desiredWorkloadMW: number;
}

export interface ContractOfferCommand {
  contractId: string;
  offeredPriceCentsPerMWQuarter: number;
}

export interface DebtRepaymentCommand {
  debtId: string;
  principalCents: number;
}

export interface DebtDrawdownCommand {
  debtId: string;
  principalCents: number;
}

export interface LoanAcceptanceCommand {
  offerId: string;
}

interface ResolvedDebtRepayment extends DebtRepaymentCommand {
  repaymentType: 'scheduled' | 'maturity' | 'voluntary';
}

function getScheduledDebtRepayments(state: GameState): ResolvedDebtRepayment[] {
  return state.debts.reduce<ResolvedDebtRepayment[]>((repayments, debt) => {
    if (debt.principalCents <= 0) return repayments;
    if (debt.maturityQuarter !== undefined && debt.maturityQuarter <= state.quarter) {
      repayments.push({ debtId: debt.id, principalCents: debt.principalCents, repaymentType: 'maturity' });
      return repayments;
    }
    const scheduled = debt.scheduledPrincipalCentsPerQuarter ?? 0;
    if (scheduled > 0) repayments.push({
      debtId: debt.id,
      principalCents: moneyFromCents(Math.min(debt.principalCents, scheduled)),
      repaymentType: 'scheduled',
    });
    return repayments;
  }, []);
}

export interface ContractRenewalCommand {
  contractId: string;
  offeredPriceCentsPerMWQuarter: number;
  offeredWorkloadMW: number;
  termQuarters: number;
}

export interface QuarterCommands {
  workloadDecisions?: WorkloadDecision[];
  /** Initiatives to sponsor this quarter. Costs and effects come from scenario data. */
  launchInitiatives?: string[];
  /** Price proposal for an existing flexible customer contract; accepted terms begin next quarter. */
  contractOffers?: ContractOfferCommand[];
  /** Renewal proposals for fixed contracts currently inside their notice window. */
  contractRenewals?: ContractRenewalCommand[];
  /** Explicit principal repayments funded only by the legal borrower's opening cash. */
  debtRepayments?: DebtRepaymentCommand[];
  /** Draws against an existing committed credit facility; proceeds belong to its borrower. */
  debtDrawdowns?: DebtDrawdownCommand[];
  /** Accept lender-originated terms; proceeds and debt belong to the named borrower. */
  acceptLoanOffers?: LoanAcceptanceCommand[];
}

export interface AdvanceQuarterSuccess {
  ok: true;
  state: GameState;
  report: QuarterReport;
}
export interface AdvanceQuarterFailure { ok: false; issues: ValidationIssue[]; }
export type AdvanceQuarterResult = AdvanceQuarterSuccess | AdvanceQuarterFailure;

const issue = (code: string, message: string, entityId?: string): ValidationIssue => ({
  code, message, ...(entityId ? { entityId } : {}),
});

function applyProjectEffect(state: GameState, project: StrategicProjectState): GameState {
  const definition = getInitiativeDefinition(project.initiativeId);
  if (!definition) return state;
  const effect = definition.effect;
  const operatingCompanies = state.operatingCompanies.map((company, index) => {
    if (index !== 0) return company;
    const capacity = { ...company.capacity };
    if (effect.type === 'capacity-expansion') {
      capacity.installedITMW += effect.installedITMW;
      capacity.operationalLimitMW += effect.operationalLimitMW;
    } else if (effect.type === 'equipment-reservation') {
      capacity.commissionedEquipmentMW += effect.commissionedEquipmentMW;
    } else if (effect.type === 'firm-power') {
      const market = state.regionalMarkets[0];
      const available = market?.immediateFirmPowerHeadroomMW ?? 0;
      capacity.gridAllocationMW += Math.min(effect.gridAllocationMW, available);
    } else if (effect.type === 'resilience') {
      capacity.reliability = Math.min(1, capacity.reliability + effect.reliabilityGain);
    }
    return { ...company, capacity };
  });

  let regionalMarkets = state.regionalMarkets;
  if (effect.type === 'firm-power' && regionalMarkets[0]) {
    const granted = Math.min(effect.gridAllocationMW, regionalMarkets[0].immediateFirmPowerHeadroomMW);
    regionalMarkets = regionalMarkets.map((market, index) => index === 0 ? {
      ...market,
      immediateFirmPowerHeadroomMW: market.immediateFirmPowerHeadroomMW - granted,
      committedPowerMW: market.committedPowerMW + granted,
    } : market);
  }

  let playerIntelligence = state.playerIntelligence;
  if (effect.type === 'market-study') {
    playerIntelligence = playerIntelligence.map((estimate) => ({
      ...estimate,
      confidence: Math.min(1, estimate.confidence + effect.confidenceGain),
      observedQuarter: state.quarter,
      source: 'commissioned market study',
    }));
  }

  return { ...state, operatingCompanies, regionalMarkets, playerIntelligence };
}

function validateCommands(state: GameState, commands: QuarterCommands): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenCompanies = new Set<string>();
  for (const decision of commands.workloadDecisions ?? []) {
    if (seenCompanies.has(decision.companyId)) {
      issues.push(issue('command.workload_duplicate', 'Only one workload decision is allowed per company.', decision.companyId));
      continue;
    }
    seenCompanies.add(decision.companyId);
    const company = state.operatingCompanies.find((item) => item.organizationId === decision.companyId);
    if (!company) {
      issues.push(issue('command.company_unknown', 'Workload decision references an unknown operating company.', decision.companyId));
      continue;
    }
    const maximumDemand = company.contracts.reduce((sum, contract) => sum + contract.workloadMW, 0);
    if (!Number.isFinite(decision.desiredWorkloadMW) || decision.desiredWorkloadMW < 0 ||
        decision.desiredWorkloadMW > maximumDemand) {
      issues.push(issue('command.workload_out_of_range', `Desired workload must be between 0 and contracted demand of ${maximumDemand} MW.`, decision.companyId));
    }
  }

  const scheduledRepayments = getScheduledDebtRepayments(state);
  const scheduledByDebt = new Map(scheduledRepayments.map((item) => [item.debtId, item.principalCents]));
  const seenDebtRepayments = new Set<string>();
  const repaymentByBorrower = new Map<string, number>();
  for (const repayment of scheduledRepayments) {
    const debt = state.debts.find((item) => item.id === repayment.debtId)!;
    repaymentByBorrower.set(debt.borrowerId, (repaymentByBorrower.get(debt.borrowerId) ?? 0) + repayment.principalCents);
  }
  for (const repayment of commands.debtRepayments ?? []) {
    if (seenDebtRepayments.has(repayment.debtId)) {
      issues.push(issue('command.debt_repayment_duplicate', 'Only one principal repayment per debt instrument is allowed in a quarter.', repayment.debtId));
      continue;
    }
    seenDebtRepayments.add(repayment.debtId);
    const debt = state.debts.find((item) => item.id === repayment.debtId);
    if (!debt) {
      issues.push(issue('command.debt_unknown', 'Debt repayment references an unknown debt instrument.', repayment.debtId));
      continue;
    }
    if (!Number.isSafeInteger(repayment.principalCents) || repayment.principalCents <= 0) {
      issues.push(issue('command.debt_repayment_invalid', 'Principal repayment must be a positive integer number of cents.', repayment.debtId));
      continue;
    }
    if (repayment.principalCents + (scheduledByDebt.get(repayment.debtId) ?? 0) > debt.principalCents) {
      issues.push(issue('command.debt_repayment_exceeds_principal', 'Voluntary and scheduled repayments cannot exceed the outstanding debt balance.', repayment.debtId));
      continue;
    }
    repaymentByBorrower.set(debt.borrowerId, (repaymentByBorrower.get(debt.borrowerId) ?? 0) + repayment.principalCents);
  }

  const seenDebtDrawdowns = new Set<string>();
  const drawdownByFacility = new Map<string, number>();
  for (const drawdown of commands.debtDrawdowns ?? []) {
    if (seenDebtDrawdowns.has(drawdown.debtId)) {
      issues.push(issue('command.debt_drawdown_duplicate', 'Only one drawdown per credit facility is allowed in a quarter.', drawdown.debtId));
      continue;
    }
    seenDebtDrawdowns.add(drawdown.debtId);
    const facility = state.debts.find((item) => item.id === drawdown.debtId);
    if (!facility) {
      issues.push(issue('command.debt_unknown', 'Credit drawdown references an unknown debt instrument.', drawdown.debtId));
      continue;
    }
    if (facility.facilityLimitCents === undefined) {
      issues.push(issue('command.debt_not_revolving_facility', 'Only a debt instrument with a committed facility limit can be drawn.', drawdown.debtId));
      continue;
    }
    if (!Number.isSafeInteger(drawdown.principalCents) || drawdown.principalCents <= 0) {
      issues.push(issue('command.debt_drawdown_invalid', 'Credit drawdown must be a positive integer number of cents.', drawdown.debtId));
      continue;
    }
    const totalDrawdown = (drawdownByFacility.get(drawdown.debtId) ?? 0) + drawdown.principalCents;
    if (facility.principalCents + totalDrawdown > facility.facilityLimitCents) {
      issues.push(issue('command.debt_facility_limit_exceeded', 'Drawdown would exceed the committed credit facility limit.', drawdown.debtId));
      continue;
    }
    drawdownByFacility.set(drawdown.debtId, totalDrawdown);
  }

  const seenLoanOffers = new Set<string>();
  const lenderCapacityUsed = new Map<string, number>();
  for (const acceptance of commands.acceptLoanOffers ?? []) {
    if (seenLoanOffers.has(acceptance.offerId)) {
      issues.push(issue('command.loan_offer_duplicate', 'A loan offer can only be accepted once per quarter.', acceptance.offerId));
      continue;
    }
    seenLoanOffers.add(acceptance.offerId);
    const offer = state.loanOffers.find((item) => item.id === acceptance.offerId);
    if (!offer) {
      issues.push(issue('command.loan_offer_unknown', 'Loan acceptance references an unknown offer.', acceptance.offerId));
      continue;
    }
    if (offer.status !== 'available') {
      issues.push(issue('command.loan_offer_unavailable', 'This loan offer is no longer available.', acceptance.offerId));
      continue;
    }
    if (state.quarter > offer.expiresAfterQuarter) {
      issues.push(issue('command.loan_offer_expired', 'This loan offer has expired.', acceptance.offerId));
      continue;
    }
    const lender = state.lenders.find((item) => item.organizationId === offer.lenderId);
    const lenderOrg = state.organizations.find((item) => item.id === offer.lenderId);
    const borrower = state.organizations.find((item) => item.id === offer.borrowerId);
    if (!lender || !lenderOrg || !borrower) {
      issues.push(issue('command.loan_offer_party_missing', 'The lender or borrower for this offer is missing.', acceptance.offerId));
      continue;
    }
    const used = (lenderCapacityUsed.get(offer.lenderId) ?? 0) + offer.principalCents;
    if (used > lender.availableCapacityCents || used > lenderOrg.cashCents) {
      issues.push(issue('command.lender_capacity_insufficient', 'The lender no longer has enough available lending capacity or liquidity.', offer.lenderId));
      continue;
    }
    lenderCapacityUsed.set(offer.lenderId, used);
  }

  const seenContractOffers = new Set<string>();
  for (const offer of commands.contractOffers ?? []) {
    if (seenContractOffers.has(offer.contractId)) {
      issues.push(issue('command.contract_offer_duplicate', 'Only one offer per contract is allowed in a quarter.', offer.contractId));
      continue;
    }
    seenContractOffers.add(offer.contractId);
    const company = state.operatingCompanies.find((item) =>
      item.contracts.some((contract) => contract.id === offer.contractId));
    const contract = company?.contracts.find((item) => item.id === offer.contractId);
    if (!company || !contract) {
      issues.push(issue('command.contract_unknown', 'Contract offer references an unknown contract.', offer.contractId));
      continue;
    }
    if (contract.flexibility !== 'flexible') {
      issues.push(issue('command.contract_not_flexible', 'Only flexible contracts can be renegotiated in this scenario.', offer.contractId));
    }
    if (!Number.isSafeInteger(offer.offeredPriceCentsPerMWQuarter) || offer.offeredPriceCentsPerMWQuarter <= 0) {
      issues.push(issue('command.contract_price_invalid', 'Offered contract price must be a positive integer number of cents.', offer.contractId));
    }
    if (!state.actors.some((actor) => actor.organizationId === contract.customerId)) {
      issues.push(issue('command.contract_customer_missing', 'Contract customer is not present in the autonomous world.', contract.customerId));
    }
  }

  const seenRenewals = new Set<string>();
  for (const renewal of commands.contractRenewals ?? []) {
    if (seenRenewals.has(renewal.contractId)) {
      issues.push(issue('command.contract_renewal_duplicate', 'Only one renewal proposal per contract is allowed in a quarter.', renewal.contractId));
      continue;
    }
    seenRenewals.add(renewal.contractId);
    const company = state.operatingCompanies.find((item) => item.contracts.some((contract) => contract.id === renewal.contractId));
    const contract = company?.contracts.find((item) => item.id === renewal.contractId);
    if (!contract) {
      issues.push(issue('command.contract_unknown', 'Renewal proposal references an unknown contract.', renewal.contractId));
      continue;
    }
    if (contract.flexibility !== 'contracted' || contract.termEndQuarter === undefined) {
      issues.push(issue('command.contract_not_term_contract', 'Only fixed-term contracted services can be renewed.', renewal.contractId));
      continue;
    }
    if (contract.termEndQuarter - state.quarter > (contract.renewalNoticeQuarters ?? 0)) {
      issues.push(issue('command.contract_renewal_too_early', 'The contract is not yet inside its renewal notice window.', renewal.contractId));
    }
    if (!Number.isSafeInteger(renewal.offeredPriceCentsPerMWQuarter) || renewal.offeredPriceCentsPerMWQuarter <= 0 ||
        !Number.isFinite(renewal.offeredWorkloadMW) || renewal.offeredWorkloadMW <= 0 ||
        renewal.offeredWorkloadMW > contract.workloadMW ||
        !Number.isInteger(renewal.termQuarters) || renewal.termQuarters < 2 || renewal.termQuarters > 8) {
      issues.push(issue('command.contract_renewal_terms_invalid', 'Renewal price, volume, or term is outside the permitted range.', renewal.contractId));
    }
  }

  const launches = commands.launchInitiatives ?? [];
  if (launches.includes('secure-equipment-allocation')) {
    const market = state.regionalMarkets[0];
    if (!market) {
      issues.push(issue('command.equipment_market_missing', 'No regional equipment market is available.'));
    } else {
      const deliveryQuarter = state.quarter + 2;
      const alreadyReserved = state.equipmentOrders
        .filter((order) => order.status === 'reserved' && order.deliveryQuarter === deliveryQuarter)
        .reduce((sum, order) => sum + order.quantityMWEquivalent, 0);
      const available = market.equipmentDeliveryPoolMWEquivalentPerQuarter - 2 - alreadyReserved;
      if (available < 6) {
        issues.push(issue('command.equipment_allocation_unavailable', `Only ${Math.max(0, available)} MW-equivalent of the delivery pool remains for quarter ${deliveryQuarter}; 6 is required.`));
      }
    }
  }
  const seenInitiatives = new Set<string>();
  let leadershipCommitted = 0;
  let cashCommitted = 0;
  for (const initiativeId of launches) {
    if (seenInitiatives.has(initiativeId)) {
      issues.push(issue('command.initiative_duplicate', 'An initiative can only be launched once per quarter.', initiativeId));
      continue;
    }
    seenInitiatives.add(initiativeId);
    const definition = getInitiativeDefinition(initiativeId);
    if (!definition) {
      issues.push(issue('command.initiative_unknown', 'Unknown strategic initiative.', initiativeId));
      continue;
    }
    if (state.projects.some((project) => project.initiativeId === initiativeId && project.remainingQuarters > 0)) {
      issues.push(issue('command.initiative_already_active', 'This initiative is already in progress.', initiativeId));
    }
    leadershipCommitted += definition.leadershipCost;
    cashCommitted += definition.upfrontCostCents;
  }

  if (leadershipCommitted > state.holding.leadershipCapacityPerQuarter) {
    issues.push(issue('command.leadership_exceeded', `Initiatives require ${leadershipCommitted} leadership units; only ${state.holding.leadershipCapacityPerQuarter} are available.`));
  }
  const holding = state.organizations.find((organization) => organization.id === state.holding.organizationId);
  if (!holding || cashCommitted + (repaymentByBorrower.get(state.holding.organizationId) ?? 0) > (holding?.cashCents ?? 0)) {
    issues.push(issue('command.insufficient_holding_cash', 'The holding company does not have enough opening cash for project commitments and debt repayments.', state.holding.organizationId));
  }
  for (const [borrowerId, repaymentCents] of repaymentByBorrower) {
    const borrower = state.organizations.find((organization) => organization.id === borrowerId);
    if (!borrower) {
      issues.push(issue('command.debt_borrower_missing', 'Debt instrument references a missing borrower.', borrowerId));
    } else if (repaymentCents > borrower.cashCents) {
      issues.push(issue('command.debt_repayment_insufficient_cash', 'The borrower does not have enough opening cash for the requested principal repayments.', borrowerId));
    }
  }
  return issues;
}

/**
 * Customer evaluates a price proposal against its private reservation price.
 * Accepted terms are applied after this quarter's report, so they affect the
 * next operating quarter rather than rewriting already-delivered service.
 */
function resolveContractOffers(
  state: GameState,
  offers: ContractOfferCommand[],
): { state: GameState; results: ContractNegotiationResult[] } {
  let operatingCompanies = state.operatingCompanies;
  const results: ContractNegotiationResult[] = [];

  for (const offer of offers) {
    let resolved = false;
    operatingCompanies = operatingCompanies.map((company) => {
      const contract = company.contracts.find((item) => item.id === offer.contractId);
      if (!contract) return company;
      resolved = true;
      const customer = state.actors.find((actor) => actor.organizationId === contract.customerId);
      const reservationPrice = customer?.hiddenMetrics.maxFlexiblePriceCentsPerMWQuarter ?? 44_000_000;
      const offeredPrice = offer.offeredPriceCentsPerMWQuarter;

      if (offeredPrice <= reservationPrice) {
        results.push({
          contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          offeredPriceCents: moneyFromCents(offeredPrice), status: 'accepted',
          message: 'Asterion accepted the revised flexible-service price. The new rate takes effect next quarter.',
        });
        return {
          ...company,
          contracts: company.contracts.map((item) => item.id === contract.id
            ? { ...item, priceCentsPerMWQuarter: moneyFromCents(offeredPrice) }
            : item),
        };
      }

      if (offeredPrice <= Math.round(reservationPrice * 1.1)) {
        results.push({
          contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          offeredPriceCents: moneyFromCents(offeredPrice), status: 'countered',
          counterPriceCents: moneyFromCents(reservationPrice),
          message: 'Asterion declined the proposed rate but returned a lower counteroffer.',
        });
      } else {
        results.push({
          contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          offeredPriceCents: moneyFromCents(offeredPrice), status: 'rejected',
          message: 'Asterion rejected the proposed rate as commercially uncompetitive.',
        });
      }
      return company;
    });
    if (!resolved) {
      throw new Error(`Validated contract offer could not be resolved: ${offer.contractId}`);
    }
  }

  return { state: { ...state, operatingCompanies }, results };
}

/**
 * Renewal proposals are evaluated against private customer reservation terms.
 * Accepted price, volume and duration begin after the current quarter closes.
 */
function resolveContractRenewals(
  state: GameState,
  renewals: ContractRenewalCommand[],
): { state: GameState; results: ContractRenewalResult[] } {
  let operatingCompanies = state.operatingCompanies;
  const results: ContractRenewalResult[] = [];
  for (const renewal of renewals) {
    let found = false;
    operatingCompanies = operatingCompanies.map((company) => {
      const contract = company.contracts.find((item) => item.id === renewal.contractId);
      if (!contract) return company;
      found = true;
      const customer = state.actors.find((actor) => actor.organizationId === contract.customerId);
      const maxPrice = customer?.hiddenMetrics[`renewalMaxPrice:${contract.id}`] ?? contract.priceCentsPerMWQuarter;
      const minVolume = customer?.hiddenMetrics[`renewalMinVolume:${contract.id}`] ?? contract.minimumWorkloadMW ?? 0;
      const rivalBid = getRivalRenewalBid(state, contract);
      const rivalWins = !!rivalBid && renewal.offeredPriceCentsPerMWQuarter > rivalBid.offeredPriceCentsPerMWQuarter;
      if (renewal.offeredWorkloadMW < minVolume) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'rejected', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, message: 'Asterion declined the proposed guaranteed volume because it does not secure enough strategic capacity.' });
        return company;
      }
      if (rivalWins) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'rejected', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, competitorBidAvailable: true,
          competitorProviderId: rivalBid!.providerId,
          message: 'Asterion selected a credible competing proposal with sufficient available capacity. The rival price remains confidential.' });
        return company;
      }
      if (renewal.offeredPriceCentsPerMWQuarter <= maxPrice) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'accepted', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, termQuarters: renewal.termQuarters,
          message: 'Asterion renewed the service agreement. Revised price, guaranteed volume and term begin next quarter.' });
        return { ...company, contracts: company.contracts.map((item) => item.id === contract.id ? {
          ...item, priceCentsPerMWQuarter: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          workloadMW: renewal.offeredWorkloadMW, minimumWorkloadMW: renewal.offeredWorkloadMW,
          termEndQuarter: state.quarter + renewal.termQuarters,
        } : item) };
      }
      if (renewal.offeredPriceCentsPerMWQuarter <= Math.round(maxPrice * 1.1)) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'countered', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, counterPriceCents: moneyFromCents(maxPrice),
          message: 'Asterion returned a lower counterprice for the proposed renewal.' });
      } else {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'rejected', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, message: 'Asterion rejected the renewal as commercially uncompetitive.' });
      }
      return company;
    });
    if (!found) throw new Error(`Validated renewal could not be resolved: ${renewal.contractId}`);
  }
  return { state: { ...state, operatingCompanies }, results };
}

/**
 * Pure, atomic quarter transaction. All decisions are validated before a
 * candidate state is built; the original state is never mutated.
 */
export function advanceQuarter(state: GameState, commands: QuarterCommands = {}): AdvanceQuarterResult {
  const initialIssues = validateGameState(state);
  if (initialIssues.length > 0) return { ok: false, issues: initialIssues };
  const commandIssues = validateCommands(state, commands);
  if (commandIssues.length > 0) return { ok: false, issues: commandIssues };

  try {
    const decisions = commands.workloadDecisions ?? [];
    const launches = commands.launchInitiatives ?? [];
    const definitions = launches.map((id) => getInitiativeDefinition(id)!);
    const leadershipCommitted = definitions.reduce((sum, item) => sum + item.leadershipCost, 0);
    const cashCommitted = definitions.reduce((sum, item) => sum + item.upfrontCostCents, 0);

    const decisionByCompany = new Map(decisions.map((decision) => [decision.companyId, decision.desiredWorkloadMW]));
    let candidate: GameState = {
      ...state,
      organizations: state.organizations.map((organization) => ({ ...organization })),
      ownership: state.ownership.map((stake) => ({ ...stake })),
      debts: state.debts.map((debt) => ({ ...debt })),
      holding: { ...state.holding },
      operatingCompanies: state.operatingCompanies.map((company) => ({
        ...company,
        capacity: { ...company.capacity },
        cashCosts: { ...company.cashCosts },
        contracts: company.contracts.map((contract) => ({ ...contract })),
        deliveredWorkloadMW: decisionByCompany.get(company.organizationId) ?? company.deliveredWorkloadMW,
      })),
      regionalMarkets: state.regionalMarkets.map((market) => ({ ...market })),
      actors: state.actors.map((actor) => ({ ...actor, goals: [...actor.goals], hiddenMetrics: { ...actor.hiddenMetrics } })),
      playerIntelligence: state.playerIntelligence.map((estimate) => ({ ...estimate })),
      projects: state.projects.map((project) => ({ ...project })),
      equipmentOrders: state.equipmentOrders.map((order) => ({ ...order })),
      lenders: state.lenders.map((lender) => ({ ...lender })),
      loanOffers: state.loanOffers.map((offer) => ({ ...offer })),
    };

    // Supplier reservations mature at the start of their delivery quarter.
    candidate = {
      ...candidate,
      equipmentOrders: candidate.equipmentOrders.map((order) =>
        order.status === 'reserved' && order.deliveryQuarter <= state.quarter
          ? { ...order, status: 'delivered' }
          : order),
    };

    const newlyLaunched = definitions.map((definition): StrategicProjectState => ({
      id: `${definition.id}-q${state.quarter}`,
      initiativeId: definition.id,
      startedQuarter: state.quarter,
      remainingQuarters: definition.durationQuarters,
      leadershipCost: definition.leadershipCost,
      initialCostCents: moneyFromCents(definition.upfrontCostCents),
    }));
    const newIds = new Set(newlyLaunched.map((project) => project.id));
    if (launches.includes('secure-equipment-allocation')) {
      candidate = {
        ...candidate,
        equipmentOrders: [...candidate.equipmentOrders, {
          id: `nodeworks-equipment-q${state.quarter}`,
          buyerId: 'nodeworks',
          quantityMWEquivalent: 6,
          placedQuarter: state.quarter,
          deliveryQuarter: state.quarter + 2,
          status: 'reserved',
        }],
      };
    }
    const completed: StrategicProjectState[] = [];
    candidate = {
      ...candidate,
      projects: [
        ...candidate.projects.map((project) => {
          if (project.remainingQuarters <= 0 || newIds.has(project.id)) return project;
          const updated = { ...project, remainingQuarters: project.remainingQuarters - 1 };
          if (updated.remainingQuarters === 0) completed.push(updated);
          return updated;
        }),
        ...newlyLaunched,
      ],
    };

    for (const project of completed) candidate = applyProjectEffect(candidate, project);

    const report = buildQuarterReport(candidate);
    const debtRepayments: ResolvedDebtRepayment[] = [
      ...getScheduledDebtRepayments(candidate),
      ...(commands.debtRepayments ?? []).map((item) => ({ ...item, repaymentType: 'voluntary' as const })),
    ];
    if (debtRepayments.length > 0) {
      const repaymentByBorrower = new Map<string, number>();
      for (const repayment of debtRepayments) {
        const debt = candidate.debts.find((item) => item.id === repayment.debtId)!;
        repaymentByBorrower.set(debt.borrowerId, (repaymentByBorrower.get(debt.borrowerId) ?? 0) + repayment.principalCents);
      }
      candidate = {
        ...candidate,
        debts: candidate.debts.map((debt) => {
          const repayment = debtRepayments.filter((item) => item.debtId === debt.id).reduce((sum, item) => sum + item.principalCents, 0);
          return repayment > 0 ? { ...debt, principalCents: moneyFromCents(debt.principalCents - repayment) } : debt;
        }),
        organizations: candidate.organizations.map((organization) => {
          const repayment = repaymentByBorrower.get(organization.id) ?? 0;
          return repayment > 0 ? { ...organization, debtCents: moneyFromCents(organization.debtCents - repayment) } : organization;
        }),
      };
      const adjustBridge = (bridge: typeof report.entityCashBridges[number]) => {
        const repayment = repaymentByBorrower.get(bridge.organizationId) ?? 0;
        if (repayment === 0) return bridge;
        return {
          ...bridge,
          financingCashFlowCents: moneyFromCents(bridge.financingCashFlowCents - repayment),
          netCashChangeCents: moneyFromCents(bridge.netCashChangeCents - repayment),
          closingCashCents: moneyFromCents(bridge.closingCashCents - repayment),
        };
      };
      report.entityCashBridges = report.entityCashBridges.map(adjustBridge);
      report.companies = report.companies.map((company) => ({
        ...company,
        cashBridge: adjustBridge(company.cashBridge),
      }));
      report.debtRepayments = debtRepayments.map((repayment) => ({
        debtId: repayment.debtId,
        borrowerId: candidate.debts.find((debt) => debt.id === repayment.debtId)!.borrowerId,
        principalCents: moneyFromCents(repayment.principalCents),
        repaymentType: repayment.repaymentType,
      }));
    }
    const debtDrawdowns = commands.debtDrawdowns ?? [];
    if (debtDrawdowns.length > 0) {
      const drawdownByBorrower = new Map<string, number>();
      for (const drawdown of debtDrawdowns) {
        const facility = candidate.debts.find((item) => item.id === drawdown.debtId)!;
        drawdownByBorrower.set(facility.borrowerId, (drawdownByBorrower.get(facility.borrowerId) ?? 0) + drawdown.principalCents);
      }
      candidate = {
        ...candidate,
        debts: candidate.debts.map((debt) => {
          const drawdown = debtDrawdowns.find((item) => item.debtId === debt.id);
          return drawdown ? { ...debt, principalCents: moneyFromCents(debt.principalCents + drawdown.principalCents) } : debt;
        }),
        organizations: candidate.organizations.map((organization) => {
          const drawdown = drawdownByBorrower.get(organization.id) ?? 0;
          return drawdown > 0 ? { ...organization, debtCents: moneyFromCents(organization.debtCents + drawdown) } : organization;
        }),
      };
      const adjustBridge = (bridge: typeof report.entityCashBridges[number]) => {
        const drawdown = drawdownByBorrower.get(bridge.organizationId) ?? 0;
        if (drawdown === 0) return bridge;
        return {
          ...bridge,
          financingCashFlowCents: moneyFromCents(bridge.financingCashFlowCents + drawdown),
          netCashChangeCents: moneyFromCents(bridge.netCashChangeCents + drawdown),
          closingCashCents: moneyFromCents(bridge.closingCashCents + drawdown),
        };
      };
      report.entityCashBridges = report.entityCashBridges.map(adjustBridge);
      report.companies = report.companies.map((company) => ({
        ...company,
        cashBridge: adjustBridge(company.cashBridge),
      }));
      report.debtDrawdowns = debtDrawdowns.map((drawdown) => ({
        debtId: drawdown.debtId,
        borrowerId: candidate.debts.find((debt) => debt.id === drawdown.debtId)!.borrowerId,
        principalCents: moneyFromCents(drawdown.principalCents),
      }));
    }
    const acceptedOffers = commands.acceptLoanOffers ?? [];
    if (acceptedOffers.length > 0) {
      const accepted = acceptedOffers.map((command) => candidate.loanOffers.find((offer) => offer.id === command.offerId)!);
      const fundingByBorrower = new Map<string, number>();
      const fundingByLender = new Map<string, number>();
      for (const offer of accepted) {
        fundingByBorrower.set(offer.borrowerId, (fundingByBorrower.get(offer.borrowerId) ?? 0) + offer.principalCents);
        fundingByLender.set(offer.lenderId, (fundingByLender.get(offer.lenderId) ?? 0) + offer.principalCents);
      }
      candidate = {
        ...candidate,
        loanOffers: candidate.loanOffers.map((offer) => accepted.some((item) => item.id === offer.id)
          ? { ...offer, status: 'accepted' as const } : offer),
        lenders: candidate.lenders.map((lender) => {
          const used = fundingByLender.get(lender.organizationId) ?? 0;
          return used > 0 ? { ...lender, availableCapacityCents: moneyFromCents(lender.availableCapacityCents - used) } : lender;
        }),
        organizations: candidate.organizations.map((organization) => {
          const lent = fundingByLender.get(organization.id) ?? 0;
          const received = fundingByBorrower.get(organization.id) ?? 0;
          if (lent === 0 && received === 0) return organization;
          return { ...organization,
            cashCents: moneyFromCents(organization.cashCents - lent + received),
            debtCents: received > 0 ? moneyFromCents(organization.debtCents + received) : organization.debtCents,
          };
        }),
        debts: [...candidate.debts, ...accepted.map((offer) => ({
          id: `loan-${offer.id}`, borrowerId: offer.borrowerId,
          principalCents: offer.principalCents, quarterlyInterestRate: offer.quarterlyInterestRate,
          maturityQuarter: offer.maturityQuarter,
        }))],
      };
      const adjustBridge = (bridge: typeof report.entityCashBridges[number]) => {
        const received = fundingByBorrower.get(bridge.organizationId) ?? 0;
        const lent = fundingByLender.get(bridge.organizationId) ?? 0;
        const flow = received - lent;
        if (flow === 0) return bridge;
        return { ...bridge, financingCashFlowCents: moneyFromCents(bridge.financingCashFlowCents + flow),
          netCashChangeCents: moneyFromCents(bridge.netCashChangeCents + flow),
          closingCashCents: moneyFromCents(bridge.closingCashCents + flow) };
      };
      report.entityCashBridges = report.entityCashBridges.map(adjustBridge);
      report.companies = report.companies.map((company) => ({ ...company, cashBridge: adjustBridge(company.cashBridge) }));
      report.loanAcceptances = accepted.map((offer) => ({
        offerId: offer.id, lenderId: offer.lenderId, borrowerId: offer.borrowerId,
        principalCents: offer.principalCents, quarterlyInterestRate: offer.quarterlyInterestRate,
        maturityQuarter: offer.maturityQuarter,
      }));
    }
    candidate = { ...candidate, loanOffers: candidate.loanOffers.map((offer) =>
      offer.status === 'available' && offer.expiresAfterQuarter < state.quarter + 1
        ? { ...offer, status: 'expired' as const } : offer) };

    const nodeworksOperations = report.companies.find((item) => item.companyId === 'nodeworks')?.operations;
    if (nodeworksOperations) {
      const fixedContracts = candidate.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.contracts.filter((item) => item.flexibility === 'contracted') ?? [];
      const fixedResults = nodeworksOperations.fulfilledContracts.filter((line) => fixedContracts.some((contract) => contract.id === line.contractId));
      const hasSlaBreach = fixedResults.some((line) => line.serviceCreditCents > 0);
      const hasMaterialShortfall = fixedResults.some((line) => {
        const contract = fixedContracts.find((item) => item.id === line.contractId)!;
        return contract.workloadMW - line.deliveredMW > 0.25;
      });
      if (hasSlaBreach || hasMaterialShortfall) {
        candidate = { ...candidate, organizations: candidate.organizations.map((organization) => organization.id === 'nodeworks'
          ? { ...organization, reputation: Math.max(0, organization.reputation - (hasSlaBreach ? 1.5 : 1)) }
          : organization) };
      }
    }
    const nodeworksServiceSnapshot = candidate.operatingCompanies.find((company) => company.organizationId === 'nodeworks');
    const serviceSnapshot = nodeworksServiceSnapshot ? {
      companyId: nodeworksServiceSnapshot.organizationId,
      contracts: nodeworksServiceSnapshot.contracts.map((contract) => ({ ...contract })),
      fulfilledContracts: nodeworksOperations?.fulfilledContracts ?? [],
    } : undefined;
    const negotiations = resolveContractOffers(candidate, commands.contractOffers ?? []);
    candidate = negotiations.state;
    report.contractNegotiations = negotiations.results;
    const renewals = resolveContractRenewals(candidate, commands.contractRenewals ?? []);
    candidate = renewals.state;
    report.contractRenewals = renewals.results;
    const autonomousTurn = advanceAutonomousActors(candidate, serviceSnapshot);
    candidate = autonomousTurn.state;
    const closingCash = new Map(report.entityCashBridges.map((bridge) => [
      bridge.organizationId, bridge.closingCashCents,
    ]));
    const nextState: GameState = {
      ...candidate,
      quarter: state.quarter + 1,
      organizations: candidate.organizations.map((organization) => {
        const cashCents = closingCash.get(organization.id);
        if (cashCents === undefined) return organization;
        const projectCommitment = organization.id === state.holding.organizationId ? cashCommitted : 0;
        return { ...organization, cashCents: moneyFromCents(cashCents - projectCommitment) };
      }),
    };

    const finalIssues = validateGameState(nextState);
    if (finalIssues.length > 0) return { ok: false, issues: finalIssues };
    report.actorActions = autonomousTurn.actions;
    report.leadershipCapacity = state.holding.leadershipCapacityPerQuarter;
    report.leadershipCommitted = leadershipCommitted;
    report.projectsLaunched = newlyLaunched.map((project) => project.initiativeId);
    report.projectsCompleted = completed.map((project) => project.initiativeId);
    report.projectCashCommitmentCents = moneyFromCents(cashCommitted);
    return { ok: true, state: nextState, report };
  } catch (error) {
    return { ok: false, issues: [issue(
      'quarter.calculation_failed',
      error instanceof Error ? error.message : 'Quarter calculation failed unexpectedly.',
    )] };
  }
}
