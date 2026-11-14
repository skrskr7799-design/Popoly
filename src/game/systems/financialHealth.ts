import type { GameState } from '../domain/types';
import type { QuarterReport } from './quarterReport';

export type FinancialHealthStatus = 'stable' | 'watch' | 'distressed';

export interface FinancialHealthAssessment {
  entityId: string;
  status: FinancialHealthStatus;
  operatingCashContributionCents: number;
  closingCashCents: number;
  cashRunwayQuarters: number | null;
  debtArrearsCents: number;
  overdueDebtCount: number;
  defaultedDebtCount: number;
  covenantBreachCount: number;
  operatingPayablesCents: number;
  overdueOperatingPayablesCents: number;
  reasons: string[];
}

/**
 * A transparent, derived health assessment for one legal entity.
 * It never mutates the authoritative state and does not replace contractual
 * arrears/default fields or the cash-bridge calculation.
 */
export function assessFinancialHealth(
  state: GameState,
  report: QuarterReport,
  entityId: string,
): FinancialHealthAssessment | undefined {
  const organization = state.organizations.find((item) => item.id === entityId);
  if (!organization) return undefined;

  const companyReport = report.companies.find((item) => item.companyId === entityId);
  const bridge = report.entityCashBridges.find((item) => item.organizationId === entityId);
  const operatingCashContributionCents = companyReport?.operations.operatingCashContributionCents ?? 0;
  const closingCashCents = bridge?.closingCashCents ?? organization.cashCents;
  const operatingPayables = (state.operatingPayables ?? []).filter((payable) =>
    payable.entityId === entityId && payable.outstandingAmountCents > 0);
  const operatingPayablesCents = operatingPayables.reduce((sum, payable) => sum + payable.outstandingAmountCents, 0);
  const overdueOperatingPayablesCents = operatingPayables
    .filter((payable) => payable.dueQuarter < state.quarter)
    .reduce((sum, payable) => sum + payable.outstandingAmountCents, 0);
  const cashAvailableAfterPayables = Math.max(0, organization.cashCents - operatingPayablesCents);
  const cashRunwayQuarters = operatingCashContributionCents < 0
    ? cashAvailableAfterPayables / Math.abs(operatingCashContributionCents)
    : null;
  const debts = state.debts.filter((debt) => debt.borrowerId === entityId && debt.principalCents > 0);
  const debtArrearsCents = debts.reduce((sum, debt) =>
    sum + (debt.arrearsPrincipalCents ?? 0) + (debt.arrearsInterestCents ?? 0), 0);
  const overdueDebtCount = debts.filter((debt) => debt.paymentStatus === 'overdue').length;
  const defaultedDebtCount = debts.filter((debt) => debt.paymentStatus === 'defaulted').length;
  const covenantBreachCount = debts.filter((debt) => debt.covenantStatus === 'breached').length;
  const covenantGraceCount = debts.filter((debt) => debt.covenantStatus === 'grace').length;
  const reasons: string[] = [];

  if (operatingCashContributionCents < 0) reasons.push('Core operations are consuming cash this quarter.');
  if (closingCashCents < 0) reasons.push('Projected closing liquidity is below zero before a recovery action.');
  if (cashRunwayQuarters !== null && cashRunwayQuarters < 2) reasons.push('Available cash covers fewer than two quarters at the current operating deficit.');
  if (debtArrearsCents > 0) reasons.push('Contractual debt service is already in arrears.');
  if (operatingPayablesCents > 0) reasons.push('Some operating obligations remain unpaid.');
  if (overdueOperatingPayablesCents > 0) reasons.push('Trade creditors are overdue and may restrict or interrupt essential services.');
  if (defaultedDebtCount > 0) reasons.push('At least one debt instrument is in default.');
  if (covenantBreachCount > 0) reasons.push('At least one lender covenant is breached.');
  else if (covenantGraceCount > 0) reasons.push('At least one lender covenant is in its grace period.');

  const distressed = closingCashCents < 0 || defaultedDebtCount > 0 || covenantBreachCount > 0 ||
    debtArrearsCents > 0 || overdueOperatingPayablesCents > 0 || (operatingCashContributionCents < 0 && cashRunwayQuarters !== null && cashRunwayQuarters < 2);
  const watch = !distressed && (operatingPayablesCents > 0 || operatingCashContributionCents < 0 || covenantGraceCount > 0 ||
    (cashRunwayQuarters !== null && cashRunwayQuarters < 4));

  return {
    entityId,
    status: distressed ? 'distressed' : watch ? 'watch' : 'stable',
    operatingCashContributionCents,
    closingCashCents,
    cashRunwayQuarters: cashRunwayQuarters === null ? null : Number(cashRunwayQuarters.toFixed(2)),
    debtArrearsCents,
    overdueDebtCount,
    defaultedDebtCount,
    covenantBreachCount,
    operatingPayablesCents,
    overdueOperatingPayablesCents,
    reasons,
  };
}
