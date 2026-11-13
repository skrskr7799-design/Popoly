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
  if (!holding || cashCommitted > holding.cashCents) {
    issues.push(issue('command.insufficient_holding_cash', 'The holding company does not have enough available cash for these commitments.', state.holding.organizationId));
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

    const report = buildQuarterReport(candidate);\n    const nodeworksOperations = report.companies.find((item) => item.companyId === 'nodeworks')?.operations;\n    if (nodeworksOperations) {\n      const fixedContracts = candidate.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.contracts.filter((item) => item.flexibility === 'contracted') ?? [];\n      const fixedResults = nodeworksOperations.fulfilledContracts.filter((line) => fixedContracts.some((contract) => contract.id === line.contractId));\n      const hasSlaBreach = fixedResults.some((line) => line.serviceCreditCents > 0);\n      const hasMaterialShortfall = fixedResults.some((line) => {\n        const contract = fixedContracts.find((item) => item.id === line.contractId)!;\n        return contract.workloadMW - line.deliveredMW > 0.25;\n      });\n      if (hasSlaBreach || hasMaterialShortfall) {\n        candidate = { ...candidate, organizations: candidate.organizations.map((organization) => organization.id === 'nodeworks'\n          ? { ...organization, reputation: Math.max(0, organization.reputation - (hasSlaBreach ? 1.5 : 1)) }\n          : organization) };\n      }\n    }
    const negotiations = resolveContractOffers(candidate, commands.contractOffers ?? []);
    candidate = negotiations.state;
    report.contractNegotiations = negotiations.results;
    const renewals = resolveContractRenewals(candidate, commands.contractRenewals ?? []);
    candidate = renewals.state;
    report.contractRenewals = renewals.results;
    const autonomousTurn = advanceAutonomousActors(candidate);
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
