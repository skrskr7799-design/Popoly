import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { validateGameState } from '../domain/invariants';
import { moneyFromCents } from '../domain/money';
import { liquidateAdministration, openAdministration, reorganizeAdministration } from '../systems/administration';
import { advanceQuarter } from '../engine/advanceQuarter';
import { calculateLiquidationWaterfall } from '../systems/liquidation';

describe('formal administration transitions', () => {
  it('opens a legal-entity-scoped case without moving cash or changing creditor claims', () => {
    const opening = initializeGame(2035);
    const beforeCash = opening.organizations.map((item) => [item.id, item.cashCents]);
    const beforeDebt = opening.debts.map((item) => [item.id, item.principalCents]);
    const result = openAdministration(opening, 'nodeworks', 'trade-creditor-arrears');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.administrationCase).toMatchObject({
      entityId: 'nodeworks', openedQuarter: opening.quarter,
      trigger: 'trade-creditor-arrears', status: 'active',
    });
    expect(result.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.status)
      .toBe('administration');
    expect(result.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.contracts)
      .toEqual(opening.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.contracts);
    expect(result.state.organizations.map((item) => [item.id, item.cashCents])).toEqual(beforeCash);
    expect(result.state.debts.map((item) => [item.id, item.principalCents])).toEqual(beforeDebt);
    expect(validateGameState(result.state)).toEqual([]);
  });

  it('prevents duplicate administration cases and rejects unknown companies', () => {
    const opening = initializeGame(2035);
    const first = openAdministration(opening, 'nodeworks');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(openAdministration(first.state, 'nodeworks')).toMatchObject({
      ok: false, code: 'administration.case_exists',
    });
    expect(openAdministration(opening, 'unknown')).toMatchObject({
      ok: false, code: 'administration.company_unknown',
    });
  });

  it('suspends workload changes and new borrowing while administration is active', () => {
    const filed = openAdministration(initializeGame(2035), 'nodeworks');
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    const workload = advanceQuarter(filed.state, {
      workloadDecisions: [{ companyId: 'nodeworks', desiredWorkloadMW: 8 }],
    });
    expect(workload.ok).toBe(false);
    if (!workload.ok) expect(workload.issues.some((item) => item.code === 'administration.workload_restricted')).toBe(true);
    const credit = advanceQuarter(filed.state, {
      requestCredit: [{ borrowerId: 'nodeworks', requestedPrincipalCents: 100_000, termQuarters: 4 }],
    });
    const investment = advanceQuarter(filed.state, { launchInitiatives: ['capacity-expansion-phase-i'] });
    expect(investment.ok).toBe(false);
    if (!investment.ok) expect(investment.issues.some((item) => item.code === 'administration.investment_restricted')).toBe(true);

    expect(credit.ok).toBe(false);
    if (!credit.ok) expect(credit.issues.some((item) => item.code === 'administration.new_borrowing_restricted')).toBe(true);
  });

  it('executes liquidation once, realizes only subsidiary assets, and reconciles creditor recoveries', () => {
    const opening = initializeGame(2035);
    const filed = openAdministration(opening, 'nodeworks', 'debt-default');
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;

    const preview = calculateLiquidationWaterfall(filed.state, 'nodeworks');
    expect(preview.cashRealizedCents).toBe(opening.organizations.find((item) => item.id === 'nodeworks')?.cashCents);
    const parentCashBefore = opening.organizations.find((item) => item.id === 'meridian-group')?.cashCents;
    const parentDebtBefore = opening.debts.filter((item) => item.borrowerId === 'meridian-group')
      .map((item) => [item.id, item.principalCents]);
    const entityDebtBefore = filed.state.debts.filter((item) => item.borrowerId === 'nodeworks');
    const payableBefore = filed.state.operatingPayables ?? [];

    const result = liquidateAdministration(filed.state, filed.administrationCase.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.administrationCase.status).toBe('liquidated');
    expect(result.administrationCase.resolution?.cashRealizedCents).toBe(preview.cashRealizedCents);
    expect(result.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.status).toBe('liquidated');
    expect(result.state.organizations.find((item) => item.id === 'nodeworks')?.cashCents).toBe(0);
    expect(result.state.assets?.filter((item) => item.ownerId === 'nodeworks' && item.disposedQuarter === undefined)).toHaveLength(0);
    expect(result.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.contracts).toHaveLength(0);
    const shareholderBase = Math.floor(preview.shareholderResidualCents * 7_200_000 / 10_000_000);
    const founderBase = Math.floor(preview.shareholderResidualCents * 1_800_000 / 10_000_000);
    const fundBase = Math.floor(preview.shareholderResidualCents * 1_000_000 / 10_000_000);
    const shareholderRemainder = preview.shareholderResidualCents - shareholderBase - founderBase - fundBase;
    const meridianResidual = shareholderBase + (shareholderRemainder >= 2 ? 1 : 0);
    expect(result.state.organizations.find((item) => item.id === 'meridian-group')?.cashCents)
      .toBe((parentCashBefore ?? 0) + meridianResidual);
    expect(result.state.debts.filter((item) => item.borrowerId === 'meridian-group')
      .map((item) => [item.id, item.principalCents])).toEqual(parentDebtBefore);

    for (const debt of entityDebtBefore) {
      const remaining = result.state.debts.find((item) => item.id === debt.id)!;
      const recovery = preview.distributions.filter((item) => item.claimId === debt.id)
        .reduce((sum, item) => sum + item.recoveryCents, 0);
      expect(remaining.principalCents + (remaining.arrearsInterestCents ?? 0))
        .toBe(debt.principalCents + (debt.arrearsInterestCents ?? 0) - recovery);
    }
    for (const payable of payableBefore) {
      const remaining = result.state.operatingPayables?.find((item) => item.id === payable.id);
      const recovery = preview.distributions.find((item) => item.claimId === payable.id)?.recoveryCents ?? 0;
      expect(remaining?.outstandingAmountCents).toBe(payable.outstandingAmountCents - recovery);
    }
    expect(result.administrationCase.resolution?.distributions.every((item) =>
      item.recoveryCents + item.shortfallCents === item.claimAmountCents)).toBe(true);
    expect(validateGameState(result.state)).toEqual([]);
    expect(liquidateAdministration(result.state, filed.administrationCase.id)).toMatchObject({
      ok: false, code: 'administration.case_not_active',
    });
    const nextTurn = advanceQuarter(result.state);
    expect(nextTurn.ok).toBe(false);
    if (!nextTurn.ok) expect(nextTurn.issues.some((item) => item.code === 'campaign.company_liquidated')).toBe(true);
  });

  it('records reorganization without forgiving debt or operating payables', () => {
    const opening = initializeGame(2035);
    const withPayables = {
      ...opening,
      operatingPayables: [{
        id: 'nodeworks-energy-q1', entityId: 'nodeworks', creditorClass: 'energy' as const,
        originalAmountCents: moneyFromCents(125_000), outstandingAmountCents: moneyFromCents(125_000),
        incurredQuarter: 1, dueQuarter: 1, priority: 2,
      }],
    };
    const filed = openAdministration(withPayables, 'nodeworks');
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    const debtBefore = filed.state.debts.map((item) => [item.id, item.principalCents, item.arrearsInterestCents]);
    const reorganized = reorganizeAdministration(filed.state, filed.administrationCase.id);
    expect(reorganized.ok).toBe(true);
    if (!reorganized.ok) return;
    expect(reorganized.administrationCase.status).toBe('reorganized');
    expect(reorganized.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.status)
      .toBe('operating');
    expect(reorganized.state.debts.map((item) => [item.id, item.principalCents, item.arrearsInterestCents]))
      .toEqual(debtBefore);
    expect(reorganized.state.operatingPayables).toEqual(withPayables.operatingPayables);
    expect(validateGameState(reorganized.state)).toEqual([]);
    expect(reorganizeAdministration(reorganized.state, filed.administrationCase.id)).toMatchObject({
      ok: false, code: 'administration.case_not_active',
    });
  });
});
