import { moneyFromCents, multiplyMoney } from '../domain/money';
import type { DebtInstrument, GameState, MoneyCents, Organization } from '../domain/types';

export interface DebtServiceLine {
  debtId: string;
  borrowerId: string;
  openingPrincipalCents: MoneyCents;
  interestRate: number;
  interestExpenseCents: MoneyCents;
}

export interface CreditAssessment {
  borrowerId: string;
  score: number;
  rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  debtToAnnualCashFlow: number;
  debtServiceCoverage: number;
  cashToDebtRatio: number;
  quarterlyOperatingCashFlowCents: MoneyCents;
}

export function calculateDebtServiceObligation(debt: DebtInstrument, quarter: number): number {
  if (debt.paymentStatus === 'settled' || (debt.covenantStartQuarter ?? 1) > quarter) return 0;
  const principal = Math.max(0, debt.principalCents);
  const interestDue = Math.round(principal * debt.quarterlyInterestRate) + (debt.arrearsInterestCents ?? 0);
  const principalDue = principal <= 0 ? 0
    : (debt.acceleratedAtQuarter !== undefined && debt.acceleratedAtQuarter <= quarter) ||
      (debt.maturityQuarter !== undefined && debt.maturityQuarter <= quarter)
      ? principal
      : Math.min(principal, (debt.arrearsPrincipalCents ?? 0) + (debt.scheduledPrincipalCentsPerQuarter ?? 0));
  return interestDue + principalDue;
}

export function calculateCreditAssessment(
  state: GameState,
  borrowerId: string,
  quarterlyOperatingCashFlowCents: MoneyCents,
): CreditAssessment | undefined {
  const borrower = state.organizations.find((item) => item.id === borrowerId);
  if (!borrower) return undefined;
  const borrowerDebts = state.debts.filter((debt) => debt.borrowerId === borrowerId);
  const debtService = borrowerDebts.reduce((sum, debt) =>
    sum + calculateDebtServiceObligation(debt, state.quarter), 0);
  const debtServiceCoverage = debtService > 0
    ? quarterlyOperatingCashFlowCents / debtService
    : quarterlyOperatingCashFlowCents > 0 ? 10 : 0;
  const cashToDebtRatio = borrower.debtCents > 0 ? borrower.cashCents / borrower.debtCents : 5;
  const annualCashFlow = Math.max(quarterlyOperatingCashFlowCents * 4, borrower.cashCents, 1);
  const debtToAnnualCashFlow = borrower.debtCents / annualCashFlow;
  const coveragePoints = Math.min(150, debtServiceCoverage * 18);
  const liquidityPoints = Math.min(100, cashToDebtRatio * 25);
  const leveragePenalty = Math.min(120, Math.max(0, debtToAnnualCashFlow - 2) * 25);
  const score = Math.max(300, Math.min(850, Math.round(
    500 + coveragePoints + liquidityPoints + (borrower.reputation - 50) * 1.5 - leveragePenalty -
    (quarterlyOperatingCashFlowCents <= 0 ? 90 : 0),
  )));
  const rating: CreditAssessment['rating'] = score >= 800 ? 'AAA'
    : score >= 750 ? 'AA' : score >= 700 ? 'A' : score >= 650 ? 'BBB'
    : score >= 600 ? 'BB' : score >= 500 ? 'B' : 'CCC';
  return {
    borrowerId, score, rating,
    debtToAnnualCashFlow: Number.isFinite(debtToAnnualCashFlow) ? debtToAnnualCashFlow : 0,
    debtServiceCoverage: Number.isFinite(debtServiceCoverage) ? debtServiceCoverage : 0,
    cashToDebtRatio: Number.isFinite(cashToDebtRatio) ? cashToDebtRatio : 0,
    quarterlyOperatingCashFlowCents,
  };
}

export interface EntityCashBridge {
  organizationId: string;
  openingCashCents: MoneyCents;
  operatingCashContributionCents: MoneyCents;
  interestExpenseCents: MoneyCents;
  interestPaidCents: MoneyCents;
  interestIncomeCents: MoneyCents;
  principalReceivedCents: MoneyCents;
  investmentCashFlowCents: MoneyCents;
  financingCashFlowCents: MoneyCents;
  netCashChangeCents: MoneyCents;
  closingCashCents: MoneyCents;
  /** Cash remitted against trade and operating obligations this quarter. */
  operatingPayablesPaidCents?: MoneyCents;
  /** New operating obligations recognized this quarter, whether paid or unpaid. */
  operatingPayablesAccruedCents?: MoneyCents;
  /** Closing unpaid operating obligations for this legal entity. */
  operatingPayablesOutstandingCents?: MoneyCents;
}

/** Calculates interest on opening principal; principal repayment is a separate financing decision. */
export function calculateDebtService(debts: DebtInstrument[]): DebtServiceLine[] {
  return debts.map((debt) => ({
    debtId: debt.id,
    borrowerId: debt.borrowerId,
    openingPrincipalCents: debt.principalCents,
    interestRate: debt.quarterlyInterestRate,
    interestExpenseCents: multiplyMoney(debt.principalCents, debt.quarterlyInterestRate),
  }));
}

/**
 * Builds a legal-entity cash bridge. Subsidiary cash is not silently merged
 * into holding cash: transfers must later be represented as explicit flows.
 */
export function calculateEntityCashBridge(
  organization: Organization,
  debtService: DebtServiceLine[],
  operatingCashContributionCents: MoneyCents = moneyFromCents(0),
  investmentCashFlowCents: MoneyCents = moneyFromCents(0),
  financingCashFlowCents: MoneyCents = moneyFromCents(0),
  interestPaidCents: MoneyCents = moneyFromCents(0),
  interestIncomeCents: MoneyCents = moneyFromCents(0),
  principalReceivedCents: MoneyCents = moneyFromCents(0),
): EntityCashBridge {
  const interestExpenseCents = moneyFromCents(
    debtService
      .filter((line) => line.borrowerId === organization.id)
      .reduce((sum, line) => sum + line.interestExpenseCents, 0),
  );
  // Accrued interest is a P&L expense; only cash actually remitted changes liquidity.
  const netCashChangeCents = moneyFromCents(
    operatingCashContributionCents - interestPaidCents + interestIncomeCents + principalReceivedCents +
    investmentCashFlowCents + financingCashFlowCents,
  );

  return {
    organizationId: organization.id,
    openingCashCents: organization.cashCents,
    operatingCashContributionCents,
    interestExpenseCents,
    interestPaidCents,
    interestIncomeCents,
    principalReceivedCents,
    investmentCashFlowCents,
    financingCashFlowCents: moneyFromCents(financingCashFlowCents + principalReceivedCents),
    netCashChangeCents,
    closingCashCents: moneyFromCents(organization.cashCents + netCashChangeCents),
  };
}

export function calculateScenarioDebtService(state: GameState): DebtServiceLine[] {
  return calculateDebtService(state.debts);
}
