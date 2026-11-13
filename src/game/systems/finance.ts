import { moneyFromCents, multiplyMoney } from '../domain/money';
import type { DebtInstrument, GameState, MoneyCents, Organization } from '../domain/types';

export interface DebtServiceLine {
  debtId: string;
  borrowerId: string;
  openingPrincipalCents: MoneyCents;
  interestRate: number;
  interestExpenseCents: MoneyCents;
}

export interface EntityCashBridge {
  organizationId: string;
  openingCashCents: MoneyCents;
  operatingCashContributionCents: MoneyCents;
  interestExpenseCents: MoneyCents;
  investmentCashFlowCents: MoneyCents;
  financingCashFlowCents: MoneyCents;
  netCashChangeCents: MoneyCents;
  closingCashCents: MoneyCents;
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
): EntityCashBridge {
  const interestExpenseCents = moneyFromCents(
    debtService
      .filter((line) => line.borrowerId === organization.id)
      .reduce((sum, line) => sum + line.interestExpenseCents, 0),
  );
  const netCashChangeCents = moneyFromCents(
    operatingCashContributionCents - interestExpenseCents +
    investmentCashFlowCents + financingCashFlowCents,
  );

  return {
    organizationId: organization.id,
    openingCashCents: organization.cashCents,
    operatingCashContributionCents,
    interestExpenseCents,
    investmentCashFlowCents,
    financingCashFlowCents,
    netCashChangeCents,
    closingCashCents: moneyFromCents(organization.cashCents + netCashChangeCents),
  };
}

export function calculateScenarioDebtService(state: GameState): DebtServiceLine[] {
  return calculateDebtService(state.debts);
}
