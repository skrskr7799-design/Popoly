import { describe, expect, it } from 'vitest';
import { applyOperatingCreditorPressure, settleOperatingPayables } from '../systems/operatingPayables';
import { initializeGame } from '../engine/initialize';
import { moneyFromCents } from '../domain/money';
import type { OperatingPayable } from '../domain/types';

const payable = (overrides: Partial<OperatingPayable> = {}): OperatingPayable => ({
  id: 'old-energy',
  entityId: 'nodeworks',
  creditorClass: 'energy',
  originalAmountCents: moneyFromCents(800),
  outstandingAmountCents: moneyFromCents(800),
  incurredQuarter: 1,
  dueQuarter: 1,
  priority: 1,
  ...overrides,
});

describe('operating payable settlement', () => {
  it('pays higher-priority claims before lower-priority obligations', () => {
    const result = settleOperatingPayables([], 'nodeworks', [
      { id: 'vendor-q2', entityId: 'nodeworks', creditorClass: 'network-vendor', amountCents: 500, dueQuarter: 2, priority: 3 },
      { id: 'payroll-q2', entityId: 'nodeworks', creditorClass: 'payroll', amountCents: 400, dueQuarter: 2, priority: 1 },
      { id: 'energy-q2', entityId: 'nodeworks', creditorClass: 'energy', amountCents: 300, dueQuarter: 2, priority: 2 },
    ], 550, 2);

    expect(result.payments).toEqual([
      { payableId: 'payroll-q2', entityId: 'nodeworks', amountCents: 400 },
      { payableId: 'energy-q2', entityId: 'nodeworks', amountCents: 150 },
    ]);
    expect(result.payables.find((item) => item.id === 'payroll-q2')?.outstandingAmountCents).toBe(0);
    expect(result.payables.find((item) => item.id === 'energy-q2')?.outstandingAmountCents).toBe(150);
    expect(result.payables.find((item) => item.id === 'vendor-q2')?.outstandingAmountCents).toBe(500);
    expect(result.cashRemainingCents).toBe(0);
    expect(result.outstandingCents).toBe(650);
  });

  it('carries unpaid balances forward and pays the oldest claim first next quarter', () => {
    const first = settleOperatingPayables([], 'nodeworks', [
      { id: 'energy-q1', entityId: 'nodeworks', creditorClass: 'energy', amountCents: 1_000, dueQuarter: 1, priority: 1 },
    ], 250, 1);
    expect(first.payables[0]?.outstandingAmountCents).toBe(750);

    const second = settleOperatingPayables(first.payables, 'nodeworks', [
      { id: 'energy-q2', entityId: 'nodeworks', creditorClass: 'energy', amountCents: 500, dueQuarter: 2, priority: 1 },
    ], 800, 2);
    expect(second.payments).toEqual([
      { payableId: 'energy-q1', entityId: 'nodeworks', amountCents: 750 },
      { payableId: 'energy-q2', entityId: 'nodeworks', amountCents: 50 },
    ]);
    expect(second.payables.map((item) => item.outstandingAmountCents)).toEqual([0, 450]);
    expect(second.outstandingCents).toBe(450);
  });

  it('keeps completed claims in the ledger and rejects duplicate or invalid accruals', () => {
    const settled = payable({ outstandingAmountCents: moneyFromCents(0) });
    const result = settleOperatingPayables([settled], 'nodeworks', [], 0, 2);
    expect(result.payables).toEqual([settled]);
    expect(() => settleOperatingPayables([settled], 'nodeworks', [
      { id: settled.id, entityId: 'nodeworks', creditorClass: 'energy', amountCents: 1, dueQuarter: 2, priority: 1 },
    ], 0, 2)).toThrow(/Invalid or duplicate/);
    expect(() => settleOperatingPayables([], 'nodeworks', [
      { id: 'bad', entityId: 'nodeworks', creditorClass: 'energy', amountCents: -1, dueQuarter: 2, priority: 1 },
    ], 0, 2)).toThrow(/Invalid or duplicate/);
  });

  it('never spends one legal entity cash on another entity payable', () => {
    const parent = payable({ id: 'parent-energy', entityId: 'meridian-group' });
    const result = settleOperatingPayables([parent], 'nodeworks', [
      { id: 'nodeworks-energy', entityId: 'nodeworks', creditorClass: 'energy', amountCents: 300, dueQuarter: 2, priority: 1 },
    ], 300, 2);
    expect(result.payments).toEqual([
      { payableId: 'nodeworks-energy', entityId: 'nodeworks', amountCents: 300 },
    ]);
    expect(result.payables.find((item) => item.id === 'parent-energy')?.outstandingAmountCents).toBe(800);
    expect(result.outstandingCents).toBe(0);
  });

  it('applies reversible energy and workforce restrictions only to overdue claims', () => {
    const company = initializeGame(2035).operatingCompanies[0]!;
    const baseCapacity = { ...company.capacity };
    const energy = {
      id: 'energy-q1', entityId: company.organizationId, creditorClass: 'energy' as const,
      originalAmountCents: moneyFromCents(100_000_000), outstandingAmountCents: moneyFromCents(100_000_000),
      incurredQuarter: 1, dueQuarter: 1, priority: 2,
    };
    const payroll = {
      id: 'payroll-q1', entityId: company.organizationId, creditorClass: 'payroll' as const,
      originalAmountCents: moneyFromCents(100_000_000), outstandingAmountCents: moneyFromCents(100_000_000),
      incurredQuarter: 1, dueQuarter: 2, priority: 1,
    };
    const pressured = applyOperatingCreditorPressure(company, [energy, payroll], 3);
    expect(pressured.pressure.gridAllocationReductionMW).toBe(1);
    expect(pressured.pressure.reliabilityPenalty).toBe(0.004);
    expect(pressured.company.capacity.gridAllocationMW).toBe(company.capacity.gridAllocationMW - 1);
    expect(pressured.company.capacity.reliability).toBeCloseTo(company.capacity.reliability - 0.004, 8);
    expect(company.capacity).toEqual(baseCapacity);

    const cured = applyOperatingCreditorPressure(company, [], 3);
    expect(cured.pressure).toEqual({
      reliabilityPenalty: 0,
      gridAllocationReductionMW: 0,
      affectedClasses: [],
    });
    expect(cured.company).toBe(company);
  });

});
