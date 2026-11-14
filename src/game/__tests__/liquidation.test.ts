import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { moneyFromCents } from '../domain/money';
import { calculateLiquidationWaterfall } from '../systems/liquidation';

describe('liquidation waterfall', () => {
  it('pays secured claims only from pledged assets, then follows operating-creditor priority', () => {
    const opening = initializeGame(2035);
    const debt = opening.debts.find((item) => item.id === 'nodeworks-infrastructure-debt')!;
    const state = {
      ...opening,
      assets: [
        { id: 'secured-compute', ownerId: 'nodeworks', assetClass: 'compute-equipment' as const,
          bookValueCents: moneyFromCents(1_200), realizableValueCents: moneyFromCents(1_000),
          securedDebtId: debt.id },
        { id: 'unpledged-facility', ownerId: 'nodeworks', assetClass: 'facility' as const,
          bookValueCents: moneyFromCents(700), realizableValueCents: moneyFromCents(500) },
        { id: 'disposed-network', ownerId: 'nodeworks', assetClass: 'network-infrastructure' as const,
          bookValueCents: moneyFromCents(500), realizableValueCents: moneyFromCents(500), disposedQuarter: 1 },
        { id: 'holding-cash-asset', ownerId: 'meridian-group', assetClass: 'facility' as const,
          bookValueCents: moneyFromCents(5_000), realizableValueCents: moneyFromCents(5_000) },
      ],
      debts: opening.debts.map((item) => item.id === debt.id
        ? { ...item, principalCents: moneyFromCents(1_200), arrearsInterestCents: moneyFromCents(100) }
        : item),
      operatingPayables: [
        { id: 'payroll-claim', entityId: 'nodeworks', creditorClass: 'payroll' as const,
          originalAmountCents: moneyFromCents(200), outstandingAmountCents: moneyFromCents(200),
          incurredQuarter: 1, dueQuarter: 1, priority: 1 },
        { id: 'energy-claim', entityId: 'nodeworks', creditorClass: 'energy' as const,
          originalAmountCents: moneyFromCents(500), outstandingAmountCents: moneyFromCents(500),
          incurredQuarter: 1, dueQuarter: 1, priority: 2 },
        { id: 'holding-claim', entityId: 'meridian-group', creditorClass: 'payroll' as const,
          originalAmountCents: moneyFromCents(9_000), outstandingAmountCents: moneyFromCents(9_000),
          incurredQuarter: 1, dueQuarter: 1, priority: 1 },
      ],
    };
    const result = calculateLiquidationWaterfall(state, 'nodeworks', 1_000);

    expect(result.grossAssetProceedsCents).toBe(1_500);
    expect(result.administrationCostsCents).toBe(150);
    expect(result.securedDebtRecoveryCents).toBe(900);
    expect(result.unsecuredEstateCents).toBe(450);
    expect(result.distributions.find((item) => item.claimId === debt.id && item.claimClass === 'secured-debt'))
      .toMatchObject({ claimAmountCents: 900, recoveryCents: 900, shortfallCents: 0 });
    expect(result.distributions.find((item) => item.claimId === 'payroll-claim')?.recoveryCents).toBe(200);
    expect(result.distributions.find((item) => item.claimId === 'energy-claim')?.recoveryCents).toBe(250);
    expect(result.distributions.find((item) => item.claimId === debt.id && item.claimClass === 'unsecured-debt')?.claimAmountCents).toBe(400);
    expect(result.distributions.some((item) => item.claimId === 'holding-claim')).toBe(false);
    expect(result.shareholderResidualCents).toBe(0);
  });

  it('allocates an underfunded creditor tier pro rata without losing cents', () => {
    const opening = initializeGame(2035);
    const state = {
      ...opening,
      assets: [{ id: 'estate', ownerId: 'nodeworks', assetClass: 'facility' as const,
        bookValueCents: moneyFromCents(1_000), realizableValueCents: moneyFromCents(1_000) }],
      debts: opening.debts.filter((debt) => debt.borrowerId !== 'nodeworks'),
      operatingPayables: [
        { id: 'vendor-a', entityId: 'nodeworks', creditorClass: 'network-vendor' as const,
          originalAmountCents: moneyFromCents(600), outstandingAmountCents: moneyFromCents(600),
          incurredQuarter: 1, dueQuarter: 1, priority: 1 },
        { id: 'vendor-b', entityId: 'nodeworks', creditorClass: 'network-vendor' as const,
          originalAmountCents: moneyFromCents(600), outstandingAmountCents: moneyFromCents(600),
          incurredQuarter: 1, dueQuarter: 1, priority: 1 },
      ],
    };
    const result = calculateLiquidationWaterfall(state, 'nodeworks', 0);
    expect(result.unsecuredEstateCents).toBe(1_000);
    expect(result.distributions.find((item) => item.claimId === 'vendor-a')?.recoveryCents).toBe(500);
    expect(result.distributions.find((item) => item.claimId === 'vendor-b')?.recoveryCents).toBe(500);
    expect(result.distributions.reduce((sum, item) => sum + item.recoveryCents, 0)).toBe(1_000);
  });

  it('rejects unknown entities and invalid administration costs', () => {
    const state = initializeGame(2035);
    expect(() => calculateLiquidationWaterfall(state, 'unknown')).toThrow(/Unknown liquidation entity/);
    expect(() => calculateLiquidationWaterfall(state, 'nodeworks', 10_001)).toThrow(/basis points/);
  });
});
