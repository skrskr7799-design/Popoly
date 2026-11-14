import type {
  AdministrationCase, GameState, MoneyCents,
} from '../domain/types';
import { moneyFromCents } from '../domain/money';
import { calculateLiquidationWaterfall, type LiquidationWaterfall } from './liquidation';

export type AdministrationTrigger = AdministrationCase['trigger'];
export type AdministrationOutcome = 'reorganized' | 'liquidated';

export interface AdministrationTransition {
  ok: true;
  state: GameState;
  administrationCase: AdministrationCase;
  liquidation?: LiquidationWaterfall;
}
export interface AdministrationTransitionFailure {
  ok: false;
  code: string;
  message: string;
}
export type AdministrationTransitionResult = AdministrationTransition | AdministrationTransitionFailure;

/**
 * Opens a formal, persistent administration case for one legal entity.
 * This transition does not create cash, forgive claims, or touch group entities.
 */
export function openAdministration(
  state: GameState,
  entityId: string,
  trigger: AdministrationTrigger = 'voluntary',
): AdministrationTransitionResult {
  const company = state.operatingCompanies.find((item) => item.organizationId === entityId);
  if (!company) return { ok: false, code: 'administration.company_unknown', message: 'Administration requires a known operating company.' };
  if (company.status === 'liquidated') {
    return { ok: false, code: 'administration.company_liquidated', message: 'A liquidated company cannot enter administration again.' };
  }
  if (company.status === 'administration' ||
      (state.administrationCases ?? []).some((item) => item.entityId === entityId)) {
    return { ok: false, code: 'administration.case_exists', message: 'This company already has an administration case.' };
  }
  if (!['voluntary', 'debt-default', 'trade-creditor-arrears'].includes(trigger)) {
    return { ok: false, code: 'administration.trigger_invalid', message: 'Administration trigger is not supported.' };
  }

  const administrationCase: AdministrationCase = {
    id: `administration:${entityId}:q${state.quarter}`,
    entityId,
    openedQuarter: state.quarter,
    trigger,
    status: 'active',
  };
  return {
    ok: true,
    state: {
      ...state,
      operatingCompanies: state.operatingCompanies.map((item) =>
        item.organizationId === entityId ? { ...item, status: 'administration' } : item),
      administrationCases: [...(state.administrationCases ?? []), administrationCase],
    },
    administrationCase,
  };
}

/** Records a successful creditor-approved reorganization without forgiving claims. */
export function reorganizeAdministration(
  state: GameState,
  caseId: string,
): AdministrationTransitionResult {
  const administrationCase = (state.administrationCases ?? []).find((item) => item.id === caseId);
  if (!administrationCase || administrationCase.status !== 'active') {
    return { ok: false, code: 'administration.case_not_active', message: 'Only an active administration case can be reorganized.' };
  }
  const company = state.operatingCompanies.find((item) => item.organizationId === administrationCase.entityId);
  if (!company || company.status !== 'administration') {
    return { ok: false, code: 'administration.company_status_invalid', message: 'The company is not in administration.' };
  }

  const resolvedCase: AdministrationCase = {
    ...administrationCase,
    status: 'reorganized',
    resolvedQuarter: state.quarter,
  };
  return {
    ok: true,
    state: {
      ...state,
      operatingCompanies: state.operatingCompanies.map((item) =>
        item.organizationId === administrationCase.entityId ? { ...item, status: 'operating' } : item),
      administrationCases: (state.administrationCases ?? []).map((item) =>
        item.id === caseId ? resolvedCase : item),
    },
    administrationCase: resolvedCase,
  };
}

/**
 * Executes the liquidation atomically. Asset proceeds and the company's own
 * cash fund the estate; lender recoveries, trade-creditor recoveries and any
 * shareholder residual are paid only after the waterfall is calculated.
 */
export function liquidateAdministration(
  state: GameState,
  caseId: string,
): AdministrationTransitionResult {
  const administrationCase = (state.administrationCases ?? []).find((item) => item.id === caseId);
  if (!administrationCase || administrationCase.status !== 'active') {
    return { ok: false, code: 'administration.case_not_active', message: 'Only an active administration case can be liquidated.' };
  }
  const entityId = administrationCase.entityId;
  const company = state.operatingCompanies.find((item) => item.organizationId === entityId);
  const organization = state.organizations.find((item) => item.id === entityId);
  if (!company || company.status !== 'administration' || !organization) {
    return { ok: false, code: 'administration.company_status_invalid', message: 'The company is not available for liquidation.' };
  }

  const liquidation = calculateLiquidationWaterfall(state, entityId);
  const recoveryByDebt = new Map<string, number>();
  const recoveryByPayable = new Map<string, number>();
  for (const distribution of liquidation.distributions) {
    if (distribution.claimClass === 'operating-payable') {
      recoveryByPayable.set(distribution.claimId, distribution.recoveryCents);
    } else {
      recoveryByDebt.set(distribution.claimId,
        (recoveryByDebt.get(distribution.claimId) ?? 0) + distribution.recoveryCents);
    }
  }

  const debts = state.debts.map((debt) => {
    if (debt.borrowerId !== entityId) return debt;
    const recovery = recoveryByDebt.get(debt.id) ?? 0;
    const interestRecovery = Math.min(debt.arrearsInterestCents ?? 0, recovery);
    const remainingRecovery = recovery - interestRecovery;
    const principalCents = moneyFromCents(Math.max(0, debt.principalCents - remainingRecovery));
    const arrearsInterestCents = moneyFromCents(Math.max(0, (debt.arrearsInterestCents ?? 0) - interestRecovery));
    return {
      ...debt,
      principalCents,
      arrearsInterestCents,
      arrearsPrincipalCents: moneyFromCents(Math.min(debt.arrearsPrincipalCents ?? 0, principalCents)),
      paymentStatus: principalCents === 0 && arrearsInterestCents === 0 ? 'settled' as const : 'defaulted' as const,
    };
  });

  const operatingPayables = (state.operatingPayables ?? []).map((payable) => {
    if (payable.entityId !== entityId) return payable;
    const recovery = recoveryByPayable.get(payable.id) ?? 0;
    return {
      ...payable,
      outstandingAmountCents: moneyFromCents(Math.max(0, payable.outstandingAmountCents - recovery)),
    };
  });

  const lenderRecoveries = new Map<string, number>();
  for (const distribution of liquidation.distributions) {
    if (distribution.claimClass === 'operating-payable') continue;
    const debt = state.debts.find((item) => item.id === distribution.claimId);
    if (debt?.lenderId) lenderRecoveries.set(debt.lenderId,
      (lenderRecoveries.get(debt.lenderId) ?? 0) + distribution.recoveryCents);
  }

  const shareholderResidual = Number(liquidation.shareholderResidualCents);
  const owners = state.ownership.filter((stake) => stake.companyId === entityId && stake.shares > 0)
    .sort((a, b) => a.ownerId.localeCompare(b.ownerId));
  const totalShares = owners.reduce((sum, stake) => sum + stake.shares, 0);
  const shareholderPayments = new Map<string, number>();
  if (shareholderResidual > 0 && totalShares > 0) {
    let assigned = 0;
    for (const owner of owners) {
      const amount = Math.floor(shareholderResidual * owner.shares / totalShares);
      shareholderPayments.set(owner.ownerId, (shareholderPayments.get(owner.ownerId) ?? 0) + amount);
      assigned += amount;
    }
    let remainder = shareholderResidual - assigned;
    for (const owner of owners) {
      if (remainder <= 0) break;
      shareholderPayments.set(owner.ownerId, (shareholderPayments.get(owner.ownerId) ?? 0) + 1);
      remainder -= 1;
    }
  }

  const organizations = state.organizations.map((item) => {
    if (item.id === entityId) return {
      ...item,
      cashCents: moneyFromCents(0),
      debtCents: moneyFromCents(debts.filter((debt) => debt.borrowerId === entityId)
        .reduce((sum, debt) => sum + debt.principalCents, 0)),
    };
    const lenderRecovery = lenderRecoveries.get(item.id) ?? 0;
    const shareholderPayment = shareholderPayments.get(item.id) ?? 0;
    if (lenderRecovery === 0 && shareholderPayment === 0) return item;
    return {
      ...item,
      cashCents: moneyFromCents(item.cashCents + lenderRecovery + shareholderPayment),
    };
  });

  const resolution = {
    resolvedQuarter: state.quarter,
    grossAssetProceedsCents: liquidation.grossAssetProceedsCents,
    cashRealizedCents: liquidation.cashRealizedCents,
    administrationCostsCents: liquidation.administrationCostsCents,
    totalCreditorClaimsCents: liquidation.totalCreditorClaimsCents,
    totalCreditorRecoveryCents: liquidation.totalCreditorRecoveryCents,
    shareholderResidualCents: liquidation.shareholderResidualCents,
    distributions: liquidation.distributions.map((item) => ({ ...item })),
  };
  const resolvedCase: AdministrationCase = {
    ...administrationCase, status: 'liquidated', resolvedQuarter: state.quarter, resolution,
  };
  const nextState: GameState = {
    ...state,
    organizations,
    debts,
    operatingPayables,
    assets: (state.assets ?? []).map((asset) => asset.ownerId === entityId && asset.disposedQuarter === undefined
      ? { ...asset, disposedQuarter: state.quarter } : asset),
    operatingCompanies: state.operatingCompanies.map((item) => item.organizationId === entityId
      ? {
        ...item, status: 'liquidated', deliveredWorkloadMW: 0,
        cashCosts: {
          operationsAndStaffingCents: moneyFromCents(0),
          maintenanceCents: moneyFromCents(0),
          networkAndConnectivityCents: moneyFromCents(0),
          overheadComplianceInsuranceCents: moneyFromCents(0),
        },
        capacity: { installedITMW: 0, gridAllocationMW: 0, commissionedEquipmentMW: 0, operationalLimitMW: 0, reliability: 0 },
        contracts: [],
      } : item),
    equipmentOrders: state.equipmentOrders.map((order) =>
      order.buyerId === entityId && order.status === 'reserved' ? { ...order, status: 'cancelled' } : order),
    loanOffers: state.loanOffers.map((offer) =>
      offer.borrowerId === entityId && offer.status === 'available' ? { ...offer, status: 'withdrawn' } : offer),
    administrationCases: (state.administrationCases ?? []).map((item) =>
      item.id === caseId ? resolvedCase : item),
  };
  return { ok: true, state: nextState, administrationCase: resolvedCase, liquidation };
}
