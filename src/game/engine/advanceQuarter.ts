import { validateGameState } from '../domain/invariants';
import { moneyFromCents } from '../domain/money';
import type { GameState, StrategicProjectState, ValidationIssue } from '../domain/types';
import { getInitiativeDefinition } from '../scenario/initiatives';
import { buildQuarterReport, type QuarterReport } from '../systems/quarterReport';

export interface WorkloadDecision {
  companyId: string;
  desiredWorkloadMW: number;
}

export interface QuarterCommands {
  workloadDecisions?: WorkloadDecision[];
  /** Initiatives to sponsor this quarter. Costs and effects come from scenario data. */
  launchInitiatives?: string[];
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

  const launches = commands.launchInitiatives ?? [];
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
