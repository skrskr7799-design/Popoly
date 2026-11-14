import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { validateGameState } from '../domain/invariants';
import { buildQuarterReport } from '../systems/quarterReport';
import { advanceQuarter } from '../engine/advanceQuarter';
import { advanceCreditorWorkouts, proposeCreditorWorkout } from '../systems/creditorWorkout';

const plan = {
  entityId: 'nodeworks', standstillQuarters: 1, maturityExtensionQuarters: 1,
  interestReductionBps: 0, principalWriteDownBps: 0, tradePayableWriteDownBps: 0,
  covenantWaiver: false, deadlineQuarters: 2,
  minimumOperatingCashContributionCents: -1_000_000_000_000,
  maximumOperatingPayablesCents: 1_000_000_000_000,
  maximumDebtArrearsCents: 1_000_000_000_000,
};

describe('coordinated creditor workouts', () => {
  it('records independent votes and applies only an approved package', () => {
    const opening = initializeGame(2035);
    const result = proposeCreditorWorkout(opening, plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workout.status).toBe('active');
    expect(result.workout.votes.length).toBeGreaterThan(0);
    expect(result.workout.acceptedClaimsCents).toBeGreaterThan(0);
    expect(result.state.debts.some((item) => item.paymentStandstillThroughQuarter === opening.quarter)).toBe(true);
    expect(validateGameState(result.state)).toEqual([]);
  });

  it('records rejection without applying unapproved debt or payable relief', () => {
    const opening = initializeGame(2035);
    const debtBefore = opening.debts.map((item) => [item.id, item.principalCents, item.quarterlyInterestRate]);
    const result = proposeCreditorWorkout(opening, { ...plan, principalWriteDownBps: 2_500, tradePayableWriteDownBps: 1_500 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.workout.status === 'rejected') {
      expect(result.state.debts.map((item) => [item.id, item.principalCents, item.quarterlyInterestRate])).toEqual(debtBefore);
      expect(result.state.operatingPayables).toEqual(opening.operatingPayables);
    }
  });

  it('honours an approved standstill without creating a new payment default', () => {
    const opening = initializeGame(2035);
    const proposed = proposeCreditorWorkout(opening, plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok || proposed.workout.status !== 'active') return;
    const stoodStillDebtIds = proposed.state.debts
      .filter((item) => item.paymentStandstillThroughQuarter === opening.quarter)
      .map((item) => item.id);
    expect(stoodStillDebtIds.length).toBeGreaterThan(0);
    const next = advanceQuarter(proposed.state);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    for (const debtId of stoodStillDebtIds) {
      const debt = next.state.debts.find((item) => item.id === debtId)!;
      expect(debt.paymentStatus).not.toBe('overdue');
      expect(debt.paymentStatus).not.toBe('defaulted');
      expect(next.report.debtRepayments?.some((item) => item.debtId === debtId)).not.toBe(true);
    }
    expect(validateGameState(next.state)).toEqual([]);
  });

  it('tracks milestones to completion', () => {
    const opening = initializeGame(2035);
    const proposed = proposeCreditorWorkout(opening, plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok || proposed.workout.status !== 'active') return;
    const report = { ...buildQuarterReport(proposed.state), quarter: 2 };
    const next = advanceCreditorWorkouts({ ...proposed.state, quarter: 2 }, report);
    const workout = next.creditorWorkouts?.find((item) => item.id === proposed.workout.id);
    expect(workout?.status).toBe('completed');
    expect(workout?.milestones.every((item) => item.status === 'met')).toBe(true);
    expect(validateGameState(next)).toEqual([]);
  });

  it('keeps creditor claims scoped to the borrower entity', () => {
    const opening = initializeGame(2035);
    const result = proposeCreditorWorkout(opening, plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workout.totalClaimsCents).toBeGreaterThan(0);
    expect(result.workout.votes.every((vote) => vote.claimCents >= 0)).toBe(true);
    expect(validateGameState(result.state)).toEqual([]);
  });
});
