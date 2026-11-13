import { validateGameState } from '../domain/invariants';
import { moneyFromCents } from '../domain/money';
import type { GameState, ValidationIssue } from '../domain/types';
import { buildQuarterReport, type QuarterReport } from '../systems/quarterReport';

export interface WorkloadDecision {
  companyId: string;
  /** Desired workload for the quarter. Physical capacity is enforced by the economy system. */
  desiredWorkloadMW: number;
}

export interface QuarterCommands {
  workloadDecisions?: WorkloadDecision[];
}

export interface AdvanceQuarterSuccess {
  ok: true;
  state: GameState;
  report: QuarterReport;
}

export interface AdvanceQuarterFailure {
  ok: false;
  issues: ValidationIssue[];
}

export type AdvanceQuarterResult = AdvanceQuarterSuccess | AdvanceQuarterFailure;

const issue = (code: string, message: string, entityId?: string): ValidationIssue => ({
  code, message, ...(entityId ? { entityId } : {}),
});

/**
 * Resolves one economic quarter as a pure transaction.
 *
 * The input state is never mutated. All calculations are completed and the
 * candidate state is validated before it is returned. Actor strategy and
 * stochastic market events are intentionally not simulated in this first
 * transaction boundary; they will be inserted before the final validation.
 */
export function advanceQuarter(state: GameState, commands: QuarterCommands = {}): AdvanceQuarterResult {
  const initialIssues = validateGameState(state);
  if (initialIssues.length > 0) return { ok: false, issues: initialIssues };

  const decisions = commands.workloadDecisions ?? [];
  const seen = new Set<string>();
  const decisionIssues: ValidationIssue[] = [];

  for (const decision of decisions) {
    if (seen.has(decision.companyId)) {
      decisionIssues.push(issue('command.workload_duplicate', 'Only one workload decision is allowed per company.', decision.companyId));
      continue;
    }
    seen.add(decision.companyId);
    const company = state.operatingCompanies.find((item) => item.organizationId === decision.companyId);
    if (!company) {
      decisionIssues.push(issue('command.company_unknown', 'Workload decision references an unknown operating company.', decision.companyId));
      continue;
    }
    const maximumContractedWorkload = company.contracts.reduce((sum, contract) => sum + contract.workloadMW, 0);
    if (!Number.isFinite(decision.desiredWorkloadMW) || decision.desiredWorkloadMW < 0 ||
        decision.desiredWorkloadMW > maximumContractedWorkload) {
      decisionIssues.push(issue(
        'command.workload_out_of_range',
        `Desired workload must be between 0 and the contracted demand of ${maximumContractedWorkload} MW.`,
        decision.companyId,
      ));
    }
  }

  if (decisionIssues.length > 0) return { ok: false, issues: decisionIssues };

  try {
    const decisionByCompany = new Map(decisions.map((decision) => [decision.companyId, decision.desiredWorkloadMW]));
    const operatingCompanies = state.operatingCompanies.map((company) => ({
      ...company,
      capacity: { ...company.capacity },
      cashCosts: { ...company.cashCosts },
      contracts: company.contracts.map((contract) => ({ ...contract })),
      deliveredWorkloadMW: decisionByCompany.get(company.organizationId) ?? company.deliveredWorkloadMW,
    }));
    const operatingState: GameState = {
      ...state,
      organizations: state.organizations.map((organization) => ({ ...organization })),
      ownership: state.ownership.map((stake) => ({ ...stake })),
      debts: state.debts.map((debt) => ({ ...debt })),
      holding: { ...state.holding },
      operatingCompanies,
      regionalMarkets: state.regionalMarkets.map((market) => ({ ...market })),
      actors: state.actors.map((actor) => ({ ...actor, goals: [...actor.goals], hiddenMetrics: { ...actor.hiddenMetrics } })),
      playerIntelligence: state.playerIntelligence.map((estimate) => ({ ...estimate })),
    };

    const report = buildQuarterReport(operatingState);
    const closingCash = new Map(report.entityCashBridges.map((bridge) => [
      bridge.organizationId,
      bridge.closingCashCents,
    ]));

    const nextState: GameState = {
      ...operatingState,
      quarter: state.quarter + 1,
      organizations: operatingState.organizations.map((organization) => {
        const cashCents = closingCash.get(organization.id);
        return cashCents === undefined ? organization : { ...organization, cashCents: moneyFromCents(cashCents) };
      }),
    };

    const finalIssues = validateGameState(nextState);
    if (finalIssues.length > 0) return { ok: false, issues: finalIssues };

    return { ok: true, state: nextState, report };
  } catch (error) {
    return {
      ok: false,
      issues: [issue(
        'quarter.calculation_failed',
        error instanceof Error ? error.message : 'Quarter calculation failed unexpectedly.',
      )],
    };
  }
}
