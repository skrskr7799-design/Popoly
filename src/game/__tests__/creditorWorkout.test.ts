import { describe, expect, it } from 'vitest';
import { initializeGame } from '../engine/initialize';
import { CampaignSession } from '../campaign/session';
import { validateGameState } from '../domain/invariants';
import { moneyFromCents, moneyFromDollars } from '../domain/money';
import { buildQuarterReport } from '../systems/quarterReport';
import { advanceQuarter } from '../engine/advanceQuarter';
import { advanceCreditorWorkouts, proposeCreditorWorkout } from '../systems/creditorWorkout';
import { createCampaignSave, serializeCampaignSave } from '../persistence/save';
import { loadCampaignSave } from '../persistence/load';

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

  it('applies approved lender terms and trade-class compromises to their own claims', () => {
    const opening = initializeGame(2035);
    const withTradeClaim = {
      ...opening,
      operatingPayables: [{
        id: 'nodeworks-energy-q1', entityId: 'nodeworks', creditorClass: 'energy' as const,
        originalAmountCents: moneyFromCents(1_000_000), outstandingAmountCents: moneyFromCents(1_000_000),
        incurredQuarter: 1, dueQuarter: 1, priority: 2,
      }],
    };
    const openingDebt = withTradeClaim.debts.find((item) => item.borrowerId === 'nodeworks')!;
    const result = proposeCreditorWorkout(withTradeClaim, {
      ...plan, interestReductionBps: 100, tradePayableWriteDownBps: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workout.status).toBe('active');
    expect(result.workout.votes.every((vote) => vote.vote === 'accepted')).toBe(true);
    const amendedDebt = result.state.debts.find((item) => item.id === openingDebt.id)!;
    expect(amendedDebt.quarterlyInterestRate).toBeCloseTo(openingDebt.quarterlyInterestRate - 0.01);
    expect(amendedDebt.paymentStandstillThroughQuarter).toBe(opening.quarter);
    expect(amendedDebt.maturityQuarter).toBe(openingDebt.maturityQuarter);
    expect(result.state.operatingPayables?.[0]?.outstandingAmountCents).toBe(950_000);
    expect(result.state.organizations.find((item) => item.id === 'nodeworks')?.debtCents)
      .toBe(result.state.debts.filter((item) => item.borrowerId === 'nodeworks').reduce((sum, item) => sum + item.principalCents, 0));
    expect(validateGameState(result.state)).toEqual([]);
  });

  it('returns creditor counter-terms when the requested relief exceeds a lender policy', () => {
    const opening = initializeGame(2035);
    const result = proposeCreditorWorkout(opening, {
      ...plan, standstillQuarters: 4, maturityExtensionQuarters: 9,
      interestReductionBps: 400, principalWriteDownBps: 1_500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workout.status).toBe('rejected');
    expect(result.workout.votes.some((vote) => vote.vote === 'countered' && vote.counterTerms !== undefined)).toBe(true);
  });

  it('converts approved debt into fairly priced new voting shares', () => {
    const opening = initializeGame(2035);
    const debt = opening.debts.find((item) => item.borrowerId === 'nodeworks')!;
    const result = proposeCreditorWorkout(opening, {
      ...plan, standstillQuarters: 0, maturityExtensionQuarters: 0,
      debtToEquityConversionBps: 1_000,
      equityPreMoneyValuationCents: moneyFromDollars(100_000_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workout.status).toBe('active');
    expect(result.workout.debtConvertedCents).toBe(moneyFromDollars(1_400_000));
    expect(result.workout.newSharesIssued).toBe(140_000);
    const amendedDebt = result.state.debts.find((item) => item.id === debt.id)!;
    expect(amendedDebt.principalCents).toBe(moneyFromDollars(12_600_000));
    const lenderStake = result.state.ownership.find((item) =>
      item.ownerId === 'frontier-development-bank' && item.companyId === 'nodeworks');
    expect(lenderStake).toMatchObject({ shares: 140_000, votingShares: 140_000 });
    expect(result.state.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.issuedShares)
      .toBe(10_140_000);
    expect(result.state.assets?.filter((item) => item.securedDebtId === debt.id)).toHaveLength(2);
    expect(validateGameState(result.state)).toEqual([]);
  });

  it('requires an explicit valuation before any debt-to-equity conversion', () => {
    const opening = initializeGame(2035);
    expect(proposeCreditorWorkout(opening, {
      ...plan, debtToEquityConversionBps: 1_000,
    })).toMatchObject({ ok: false, code: 'workout.terms_invalid' });
  });

  it('records rejection without applying unapproved debt or payable relief', () => {
    const opening = initializeGame(2035);
    const debtBefore = opening.debts.map((item) => [item.id, item.principalCents, item.quarterlyInterestRate]);
    const result = proposeCreditorWorkout(opening, { ...plan, standstillQuarters: 4, maturityExtensionQuarters: 12, interestReductionBps: 500 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workout.status).toBe('rejected');
    expect(result.state.debts.map((item) => [item.id, item.principalCents, item.quarterlyInterestRate])).toEqual(debtBefore);
    expect(result.state.operatingPayables).toEqual(opening.operatingPayables);
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

  it('advances the workout lifecycle through the authoritative campaign session', () => {
    const session = CampaignSession.start({ seed: 2035 });
    const proposed = session.proposeCreditorWorkout(plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const turn = session.advance();
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(session.state.creditorWorkouts?.find((item) => item.id === proposed.workout.id)?.status).toBe('completed');
    expect(validateGameState(session.state)).toEqual([]);
  });

  it('allows explicit administration escalation after a missed recovery milestone', () => {
    const session = CampaignSession.start({ seed: 2035 });
    const proposed = session.proposeCreditorWorkout({
      ...plan, standstillQuarters: 0, maturityExtensionQuarters: 0,
      minimumOperatingCashContributionCents: moneyFromDollars(1_000_000_000),
      maximumOperatingPayablesCents: 0, maximumDebtArrearsCents: 0,
      deadlineQuarters: 1,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(session.advance().ok).toBe(true);
    expect(session.advance().ok).toBe(true);
    expect(session.state.creditorWorkouts?.find((item) => item.id === proposed.workout.id)?.status).toBe('breached');
    const filed = session.openAdministration('nodeworks', 'creditor-workout-breach');
    expect(filed.ok).toBe(true);
    if (filed.ok) expect(filed.administrationCase.trigger).toBe('creditor-workout-breach');
  });

  it('keeps an administration review window open while a workout is unresolved', () => {
    const session = CampaignSession.start({ seed: 2035 });
    const filed = session.openAdministration('nodeworks', 'voluntary');
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    const proposed = session.proposeCreditorWorkout({
      ...plan, standstillQuarters: 0, maturityExtensionQuarters: 0,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(session.reorganizeAdministration(filed.administrationCase.id)).toMatchObject({
      ok: false, code: 'administration.workout_unresolved',
    });
  });

  it('supersedes a breached workout when creditors approve a replacement', () => {
    const opening = initializeGame(2035);
    const first = proposeCreditorWorkout(opening, {
      ...plan, minimumOperatingCashContributionCents: moneyFromDollars(1_000_000_000),
      maximumOperatingPayablesCents: 0, maximumDebtArrearsCents: 0,
    });
    expect(first.ok).toBe(true);
    if (!first.ok || first.workout.status !== 'active') return;
    const failed = advanceCreditorWorkouts(
      { ...first.state, quarter: 3 },
      { ...buildQuarterReport(first.state), quarter: 3 },
    );
    expect(failed.creditorWorkouts?.find((item) => item.id === first.workout.id)?.status).toBe('breached');
    const replacement = proposeCreditorWorkout(failed, plan);
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;
    expect(replacement.state.creditorWorkouts?.find((item) => item.id === first.workout.id)?.status).toBe('withdrawn');
    expect(replacement.workout.status).toBe('active');
    expect(validateGameState(replacement.state)).toEqual([]);
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

  it('round-trips an active creditor workout through the campaign save format', async () => {
    const opening = initializeGame(2035);
    const proposed = proposeCreditorWorkout(opening, plan);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok || proposed.workout.status !== 'active') return;
    const metadata = {
      campaignId: 'creditor-workout-save',
      createdAt: '2035-01-01T00:00:00.000Z',
      updatedAt: '2035-01-01T00:00:00.000Z',
      simulationVersion: '0.1.0',
    };
    const digest = async () => 'stable-workout-test-digest';
    const created = await createCampaignSave(proposed.state, metadata, digest);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const loaded = await loadCampaignSave(serializeCampaignSave(created.value), {
      isSimulationCompatible: (version) => version === '0.1.0',
      isScenarioCompatible: (id, version) => id === opening.scenarioId && version === opening.scenarioVersion,
    }, digest);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state.creditorWorkouts).toEqual(proposed.state.creditorWorkouts);
    expect(loaded.value.state.debts).toEqual(proposed.state.debts);
    expect(validateGameState(loaded.value.state)).toEqual([]);
  });

  it('rejects workouts when an outstanding debt has no identified lender', () => {
    const opening = initializeGame(2035);
    const state = {
      ...opening,
      debts: opening.debts.map((debt) => debt.borrowerId === 'nodeworks'
        ? { ...debt, lenderId: undefined } : debt),
    };
    expect(proposeCreditorWorkout(state, plan)).toMatchObject({
      ok: false, code: 'workout.creditor_unrepresented',
    });
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
