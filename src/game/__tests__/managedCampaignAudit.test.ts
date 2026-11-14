import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { advanceQuarter } from '../engine/advanceQuarter';
import { validateGameState } from '../domain/invariants';
import { buildQuarterReport } from '../systems/quarterReport';

const MANAGED_SEEDS = [1, 42, 2035, 9001];
const TURNAROUND_ACTIONS = [
  'workforce-reset',
  'maintenance-deferral',
  'vendor-renegotiation',
  'facility-consolidation',
] as const;

describe('managed multi-seed campaign audit', () => {
  it('keeps four independently seeded 48-quarter campaigns valid under active management', () => {
    for (const seed of MANAGED_SEEDS) {
      let state = initializeGame(seed);

      for (let turn = 0; turn < 48; turn += 1) {
        const renewalWindow = new Set(buildQuarterReport(state).contractsInRenewalWindow ?? []);
        const contractRenewals = state.operatingCompanies[0]!.contracts
          .filter((contract) => renewalWindow.has(contract.id))
          .map((contract) => ({
            contractId: contract.id,
            offeredPriceCentsPerMWQuarter: contract.id === 'asterion-contract-a' ? 53_000_000 : 50_000_000,
            offeredWorkloadMW: contract.id === 'asterion-contract-a' ? 8 : 5,
            termQuarters: 4,
          }));

        const result = advanceQuarter(state, {
          ...(turn === 0
            ? { turnaroundActions: TURNAROUND_ACTIONS.map((actionId) => ({ companyId: 'nodeworks', actionId })) }
            : {}),
          contractRenewals,
        });

        expect(
          result.ok,
          result.ok
            ? undefined
            : `seed ${seed}, turn ${turn + 1}, quarter ${state.quarter}: ${JSON.stringify(result.issues)}`,
        ).toBe(true);
        if (!result.ok) break;

        state = result.state;
        expect(state.quarter, `seed ${seed}, turn ${turn + 1}`).toBe(turn + 2);
        expect(validateGameState(state), `seed ${seed}, quarter ${state.quarter}`).toEqual([]);
        expect(
          state.organizations.every((item) =>
            Number.isSafeInteger(item.cashCents) &&
            Number.isSafeInteger(item.debtCents) &&
            item.cashCents >= 0 &&
            item.debtCents >= 0,
          ),
          `seed ${seed}, quarter ${state.quarter}: legal-entity balances must remain valid`,
        ).toBe(true);
        expect(
          state.debts.every((item) =>
            Number.isSafeInteger(item.principalCents) &&
            item.principalCents >= 0 &&
            Number.isSafeInteger(item.arrearsInterestCents ?? 0) &&
            Number.isSafeInteger(item.arrearsPrincipalCents ?? 0),
          ),
          `seed ${seed}, quarter ${state.quarter}: debt balances must remain valid`,
        ).toBe(true);
        expect(
          result.report.companies.every((item) =>
            Number.isFinite(item.operations.revenueCents) &&
            Number.isFinite(item.operations.totalOperatingCostCents) &&
            Number.isFinite(item.operations.operatingCashContributionCents),
          ),
          `seed ${seed}, quarter ${state.quarter}: operating reports must remain finite`,
        ).toBe(true);
      }

      expect(state.quarter, `seed ${seed} must complete all 48 quarters`).toBe(49);
      expect(
        state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.turnaroundActions,
        `seed ${seed} must retain the four applied turnaround measures`,
      ).toHaveLength(4);
    }
  });
});
