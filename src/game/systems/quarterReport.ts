import type { GameState, MoneyCents } from '../domain/types';
import { calculateOperatingQuarter, type OperatingQuarterResult } from './economy';
import { calculateScenarioDebtService, calculateEntityCashBridge, type EntityCashBridge } from './finance';
import { moneyFromCents } from '../domain/money';

export interface CompanyQuarterReport {
  companyId: string;
  operations: OperatingQuarterResult;
  cashBridge: EntityCashBridge;
}

export interface QuarterReport {
  quarter: number;
  companies: CompanyQuarterReport[];
  entityCashBridges: EntityCashBridge[];
  totalInterestExpenseCents: MoneyCents;
  leadershipCapacity?: number;
  leadershipCommitted?: number;
  projectsLaunched?: string[];
  projectsCompleted?: string[];
  projectCashCommitmentCents?: MoneyCents;
  actorActions?: Array<{ actorId: string; kind: string; summary: string }>; 
}

/**
 * Produces a read-only opening-quarter report. It does not mutate the world
 * or advance time; the authoritative quarter transition will consume commands
 * and actor decisions before committing a new state.
 */
export function buildQuarterReport(state: GameState): QuarterReport {
  const debtService = calculateScenarioDebtService(state);
  const companies = state.operatingCompanies.map((company) => {
    const market = state.regionalMarkets[0];
    if (!market) throw new Error('Scenario has no regional market for operating company.');
    const operations = calculateOperatingQuarter(company, market);
    const organization = state.organizations.find((item) => item.id === company.organizationId);
    if (!organization) throw new Error(`Missing organization: ${company.organizationId}`);
    return {
      companyId: company.organizationId,
      operations,
      cashBridge: calculateEntityCashBridge(organization, debtService, operations.operatingCashContributionCents),
    };
  });

  const entityCashBridges = state.organizations.map((organization) =>
    calculateEntityCashBridge(organization, debtService),
  );
  const companyBridges = new Map(companies.map((item) => [item.companyId, item.cashBridge]));
  for (let index = 0; index < entityCashBridges.length; index += 1) {
    const bridge = entityCashBridges[index];
    if (!bridge) continue;
    const companyBridge = companyBridges.get(bridge.organizationId);
    if (companyBridge) entityCashBridges[index] = companyBridge;
  }

  const totalInterestExpenseCents = moneyFromCents(
    debtService.reduce((sum, line) => sum + line.interestExpenseCents, 0),
  );

  return { quarter: state.quarter, companies, entityCashBridges, totalInterestExpenseCents };
}
