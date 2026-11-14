import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { advanceQuarter } from '../engine/advanceQuarter';
import { buildQuarterReport } from '../systems/quarterReport';
import { assessFinancialHealth } from '../systems/financialHealth';
import { moneyFromCents } from '../domain/money';

describe('operating payables in the quarter engine', () => {
  it('completes a quarter with unpaid operating costs instead of creating negative cash', () => {
    const opening = initializeGame(2035);
    const parentPayable = {
      id: 'meridian-existing-vendor',
      entityId: 'meridian-group',
      creditorClass: 'network-vendor' as const,
      originalAmountCents: moneyFromCents(50_000),
      outstandingAmountCents: moneyFromCents(50_000),
      incurredQuarter: 1,
      dueQuarter: 1,
      priority: 4,
    };
    const distressedOpening = {
      ...opening,
      operatingPayables: [parentPayable],
      operatingCompanies: opening.operatingCompanies.map((item) => item.organizationId === 'nodeworks'
        ? { ...item, cashCosts: { ...item.cashCosts, operationsAndStaffingCents: moneyFromCents(1_500_000_000) } }
        : item),
    };

    const result = advanceQuarter(distressedOpening);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const nodeworks = result.state.organizations.find((item) => item.id === 'nodeworks')!;
    const payroll = result.state.operatingPayables?.find((item) =>
      item.id === 'nodeworks-payroll-q1');
    const parent = result.state.operatingPayables?.find((item) => item.id === parentPayable.id);
    const bridge = result.report.entityCashBridges.find((item) => item.organizationId === 'nodeworks')!;

    expect(nodeworks.cashCents).toBe(0);
    expect(payroll?.outstandingAmountCents).toBeGreaterThan(0);
    expect(bridge.operatingPayablesAccruedCents).toBe(
      result.report.companies.find((item) => item.companyId === 'nodeworks')!.operations.totalOperatingCostCents,
    );
    expect(bridge.operatingPayablesPaidCents).toBeGreaterThan(0);
    expect(bridge.operatingPayablesOutstandingCents).toBeGreaterThan(0);
    expect(parent?.outstandingAmountCents).toBe(50_000);
    expect(result.state.organizations.every((item) => item.cashCents >= 0)).toBe(true);
    expect(result.state.debts.find((debt) => debt.borrowerId === 'nodeworks')?.arrearsInterestCents).toBeGreaterThan(0);
  });

  it('classifies overdue trade creditors as distress without treating them as bank debt', () => {
    const state = initializeGame(2035);
    const withOverduePayable = {
      ...state,
      operatingPayables: [{
        id: 'nodeworks-energy-q1',
        entityId: 'nodeworks',
        creditorClass: 'energy' as const,
        originalAmountCents: moneyFromCents(900_000),
        outstandingAmountCents: moneyFromCents(900_000),
        incurredQuarter: 1,
        dueQuarter: 1,
        priority: 2,
      }],
      quarter: 2,
    };
    const report = buildQuarterReport(withOverduePayable);
    const health = assessFinancialHealth(withOverduePayable, report, 'nodeworks')!;

    expect(health.operatingPayablesCents).toBe(900_000);
    expect(health.overdueOperatingPayablesCents).toBe(900_000);
    expect(health.status).toBe('distressed');
    expect(health.debtArrearsCents).toBe(0);
  });
  it('reserves cash for opening trade creditors before paying bank interest', () => {
    const opening = initializeGame(2035);
    const oldCreditor = {
      id: 'nodeworks-overdue-energy',
      entityId: 'nodeworks',
      creditorClass: 'energy' as const,
      originalAmountCents: moneyFromCents(700_000_000),
      outstandingAmountCents: moneyFromCents(700_000_000),
      incurredQuarter: 1,
      dueQuarter: 1,
      priority: 1,
    };
    const state = { ...opening, operatingPayables: [oldCreditor] };
    const result = advanceQuarter(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const interest = result.report.debtInterestService?.find((line) =>
      line.borrowerId === 'nodeworks' && line.debtId === 'nodeworks-infrastructure-debt');
    const paidOldClaim = result.state.operatingPayables?.find((item) => item.id === oldCreditor.id);
    expect(interest?.interestPaidCents).toBe(0);
    expect(interest?.closingInterestArrearsCents).toBeGreaterThan(0);
    expect(paidOldClaim?.outstandingAmountCents).toBe(0);
  });

});
