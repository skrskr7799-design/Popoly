import type { GameState, MoneyCents } from '../domain/types';
import { calculateOperatingQuarter, type OperatingQuarterResult } from './economy';
import { calculateScenarioDebtService, calculateEntityCashBridge, type EntityCashBridge } from './finance';
import { moneyFromCents } from '../domain/money';

export interface CompanyQuarterReport {
  companyId: string;
  operations: OperatingQuarterResult;
  cashBridge: EntityCashBridge;
}

export interface ContractNegotiationResult {
  contractId: string;
  providerId: string;
  customerId: string;
  offeredPriceCents: MoneyCents;
  status: 'accepted' | 'countered' | 'rejected';
  counterPriceCents?: MoneyCents;
  message: string;
}

export interface ContractRenewalResult {
  contractId: string; providerId: string; customerId: string;
  offeredPriceCents: MoneyCents; offeredWorkloadMW: number;
  status: 'accepted' | 'countered' | 'rejected';
  counterPriceCents?: MoneyCents; termQuarters?: number; competitorBidAvailable?: boolean; competitorProviderId?: string; message: string;
}

export interface CreditDecisionReportLine {
  lenderId: string;
  borrowerId: string;
  requestedPrincipalCents: MoneyCents;
  offeredPrincipalCents?: MoneyCents;
  quarterlyInterestRate?: number;
  creditScore: number;
  creditRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  status: 'offered' | 'rejected';
  reason: string;
  offerId?: string;
}

export interface DebtRefinancingReportLine {
  oldDebtId: string; newDebtId: string; borrowerId: string; newLenderId: string;
  refinancedPrincipalCents: MoneyCents; feeCents: MoneyCents; netCashReleasedCents: MoneyCents;
}
export interface DebtRestructuringReportLine {
  debtId: string; borrowerId: string; lenderId: string; status: 'accepted' | 'rejected';
  previousQuarterlyInterestRate: number; newQuarterlyInterestRate?: number;
  previousMaturityQuarter?: number; newMaturityQuarter?: number;
  previousScheduledPrincipalCentsPerQuarter?: MoneyCents; newScheduledPrincipalCentsPerQuarter?: MoneyCents;
  covenantWaived?: boolean; borrowerRationale?: string; reason: string;
}
export interface CovenantReportLine {
  debtId: string;
  borrowerId: string;
  status: 'compliant' | 'grace' | 'breached';
  breachStreak: number;
  debtServiceCoverage: number;
  debtToAnnualCashFlow: number;
  reasons: string[];
  ratePenaltyApplied?: number;
}

export interface LoanAcceptanceReportLine {
  offerId: string;
  lenderId: string;
  borrowerId: string;
  principalCents: MoneyCents;
  quarterlyInterestRate: number;
  maturityQuarter: number;
}

export interface DebtDrawdownReportLine {
  debtId: string;
  borrowerId: string;
  principalCents: MoneyCents;
}

export interface DebtRepaymentReportLine {
  debtId: string;
  borrowerId: string;
  lenderId?: string;
  principalCents: MoneyCents;
  repaymentType: 'scheduled' | 'maturity' | 'voluntary';
}

export interface DebtInterestReportLine {
  debtId: string;
  borrowerId: string;
  lenderId?: string;
  accruedInterestCents: MoneyCents;
  openingInterestArrearsCents: MoneyCents;
  interestPaidCents: MoneyCents;
  closingInterestArrearsCents: MoneyCents;
  missedContractualService: boolean;
}

export interface CrossDefaultReportLine {
  affectedDebtId: string;
  triggerDebtId: string;
  borrowerId: string;
  lenderId?: string;
  action: 'activated' | 'released';
}

export interface DebtArrearsReportLine {
  debtId: string;
  borrowerId: string;
  unpaidInterestCents: MoneyCents;
  unpaidDueCents: MoneyCents;
  totalArrearsCents: MoneyCents;
  overdueQuarters: number;
  status: 'overdue' | 'defaulted';
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
  contractNegotiations?: ContractNegotiationResult[];
  contractRenewals?: ContractRenewalResult[];
  debtRepayments?: DebtRepaymentReportLine[];
  debtArrears?: DebtArrearsReportLine[];
  crossDefaults?: CrossDefaultReportLine[];
  debtInterestService?: DebtInterestReportLine[];
  debtDrawdowns?: DebtDrawdownReportLine[];
  loanAcceptances?: LoanAcceptanceReportLine[];
  creditDecisions?: CreditDecisionReportLine[];
  covenantUpdates?: CovenantReportLine[];
  debtRefinancings?: DebtRefinancingReportLine[];
  debtRestructurings?: DebtRestructuringReportLine[];
  contractsInRenewalWindow?: string[];
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

  const contractsInRenewalWindow = state.operatingCompanies.flatMap((company) => company.contracts
    .filter((contract) => contract.flexibility === 'contracted' && contract.termEndQuarter !== undefined &&
      contract.termEndQuarter - state.quarter <= (contract.renewalNoticeQuarters ?? 0))
    .map((contract) => contract.id));
  return { quarter: state.quarter, companies, entityCashBridges, totalInterestExpenseCents, contractsInRenewalWindow };
}
