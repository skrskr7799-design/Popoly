import type { CreditorWorkout, CreditorWorkoutMilestone, GameState, MoneyCents, OperatingPayableClass } from '../domain/types';
import { moneyFromCents } from '../domain/money';
import type { QuarterReport } from './quarterReport';

export interface CreditorWorkoutProposal {
  entityId: string; standstillQuarters: number; maturityExtensionQuarters: number;
  interestReductionBps: number; principalWriteDownBps: number; tradePayableWriteDownBps: number;
  covenantWaiver: boolean; deadlineQuarters: number;
  minimumOperatingCashContributionCents: number; maximumOperatingPayablesCents: number;
  maximumDebtArrearsCents: number;
}
export interface CreditorWorkoutTransition { ok: true; state: GameState; workout: CreditorWorkout; }
export interface CreditorWorkoutFailure { ok: false; code: string; message: string; }
export type CreditorWorkoutResult = CreditorWorkoutTransition | CreditorWorkoutFailure;
const fail = (code: string, message: string): CreditorWorkoutFailure => ({ ok: false, code, message });
const payableClasses: OperatingPayableClass[] = ['payroll', 'tax-overhead', 'energy', 'maintenance', 'network-vendor'];
const validBps = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 10_000;

function creditorClaims(state: GameState, entityId: string) {
  const claims = new Map<string, { creditorId: string; creditorKind: 'lender' | 'trade-creditor-class'; claimCents: number; securedClaimCents: number }>();
  for (const debt of state.debts) {
    if (debt.borrowerId !== entityId || debt.principalCents <= 0 || !debt.lenderId) continue;
    const current = claims.get(debt.lenderId) ?? { creditorId: debt.lenderId, creditorKind: 'lender' as const, claimCents: 0, securedClaimCents: 0 };
    current.claimCents += debt.principalCents + (debt.arrearsInterestCents ?? 0) + (debt.arrearsPrincipalCents ?? 0);
    if ((state.assets ?? []).some((asset) => asset.ownerId === entityId && asset.securedDebtId === debt.id && asset.disposedQuarter === undefined)) {
      current.securedClaimCents += debt.principalCents;
    }
    claims.set(debt.lenderId, current);
  }
  for (const creditorClass of payableClasses) {
    const amount = (state.operatingPayables ?? []).filter((item) => item.entityId === entityId && item.creditorClass === creditorClass)
      .reduce((sum, item) => sum + item.outstandingAmountCents, 0);
    if (amount > 0) claims.set(`trade:${creditorClass}`, {
      creditorId: `trade:${creditorClass}`, creditorKind: 'trade-creditor-class', claimCents: amount, securedClaimCents: 0,
    });
  }
  return [...claims.values()].filter((item) => item.claimCents > 0).sort((a, b) => a.creditorId.localeCompare(b.creditorId));
}

function voteForCreditor(state: GameState, creditor: ReturnType<typeof creditorClaims>[number], terms: CreditorWorkout['terms']): CreditorWorkout['votes'][number] {
  if (creditor.creditorKind === 'trade-creditor-class') {
    const haircut = terms.tradePayableWriteDownBps;
    const base = { ...creditor, claimCents: moneyFromCents(creditor.claimCents), securedClaimCents: moneyFromCents(0) };
    if (haircut <= 500) return { ...base, vote: 'accepted', reason: haircut === 0 ? 'The full trade claim is preserved.' : 'The trade-creditor class accepts a limited compromise.' };
    if (haircut <= 1_500) return { ...base, vote: 'countered', reason: 'The trade-creditor class requests a smaller write-down.', counterTerms: { ...terms, tradePayableWriteDownBps: 500 } };
    return { ...base, vote: 'rejected', reason: 'The proposed trade-payable write-down exceeds the class tolerance.' };
  }
  const lender = state.lenders.find((item) => item.organizationId === creditor.creditorId);
  const base = { ...creditor, claimCents: moneyFromCents(creditor.claimCents), securedClaimCents: moneyFromCents(creditor.securedClaimCents) };
  if (!lender) return { ...base, vote: 'rejected', reason: 'No active lender profile represents this claim.' };
  const haircutLimit = lender.riskAppetite === 'conservative' ? 300 : lender.riskAppetite === 'balanced' ? 700 : 1_200;
  const rateLimit = lender.riskAppetite === 'conservative' ? 100 : lender.riskAppetite === 'balanced' ? 200 : 350;
  const extensionLimit = lender.riskAppetite === 'conservative' ? 3 : lender.riskAppetite === 'balanced' ? 5 : 8;
  const standstillLimit = lender.riskAppetite === 'conservative' ? 1 : lender.riskAppetite === 'balanced' ? 2 : 3;
  const exceeds = terms.principalWriteDownBps > haircutLimit || terms.interestReductionBps > rateLimit ||
    terms.maturityExtensionQuarters > extensionLimit || terms.standstillQuarters > standstillLimit;
  const farBeyond = terms.principalWriteDownBps > haircutLimit + 800 || terms.interestReductionBps > rateLimit + 200 ||
    terms.maturityExtensionQuarters > extensionLimit + 3 || terms.standstillQuarters > standstillLimit + 1;
  const counterTerms = {
    ...terms, principalWriteDownBps: Math.min(terms.principalWriteDownBps, haircutLimit),
    interestReductionBps: Math.min(terms.interestReductionBps, rateLimit),
    maturityExtensionQuarters: Math.min(terms.maturityExtensionQuarters, extensionLimit),
    standstillQuarters: Math.min(terms.standstillQuarters, standstillLimit),
  };
  return {
    ...base, vote: farBeyond ? 'rejected' : exceeds ? 'countered' : 'accepted',
    reason: farBeyond ? 'The proposal exceeds this lender’s restructuring tolerance.'
      : exceeds ? 'The lender requests less relief and/or a shorter standstill.'
      : 'The lender accepts the proposed terms.',
    ...(exceeds && !farBeyond ? { counterTerms } : {}),
  };
}

/** Claim-weighted company workout. A proposal never changes balances unless the voting threshold is met. */
export function proposeCreditorWorkout(state: GameState, input: CreditorWorkoutProposal): CreditorWorkoutResult {
  const company = state.operatingCompanies.find((item) => item.organizationId === input.entityId);
  if (!company || company.status === 'liquidated') return fail('workout.company_unavailable', 'A workout requires a known, non-liquidated operating company.');
  if ((state.creditorWorkouts ?? []).some((item) => item.entityId === input.entityId && item.status === 'active')) {
    return fail('workout.already_active', 'This company already has an active creditor workout.');
  }
  const values = [input.standstillQuarters, input.maturityExtensionQuarters, input.interestReductionBps,
    input.principalWriteDownBps, input.tradePayableWriteDownBps, input.deadlineQuarters,
    input.minimumOperatingCashContributionCents, input.maximumOperatingPayablesCents, input.maximumDebtArrearsCents];
  if (!values.every(Number.isSafeInteger) || input.standstillQuarters < 0 || input.standstillQuarters > 4 ||
      input.maturityExtensionQuarters < 0 || input.maturityExtensionQuarters > 12 ||
      !validBps(input.interestReductionBps) || input.interestReductionBps > 500 ||
      !validBps(input.principalWriteDownBps) || input.principalWriteDownBps > 2_500 ||
      !validBps(input.tradePayableWriteDownBps) || input.tradePayableWriteDownBps > 1_500 ||
      input.deadlineQuarters < 1 || input.deadlineQuarters > 12 ||
      input.maximumOperatingPayablesCents < 0 || input.maximumDebtArrearsCents < 0) {
    return fail('workout.terms_invalid', 'Workout terms or recovery milestones are outside supported limits.');
  }
  const creditors = creditorClaims(state, input.entityId);
  const totalClaims = creditors.reduce((sum, item) => sum + item.claimCents, 0);
  if (totalClaims <= 0) return fail('workout.no_creditors', 'There are no outstanding represented creditor claims to negotiate.');
  const terms: CreditorWorkout['terms'] = {
    standstillQuarters: input.standstillQuarters, maturityExtensionQuarters: input.maturityExtensionQuarters,
    interestReductionBps: input.interestReductionBps, principalWriteDownBps: input.principalWriteDownBps,
    tradePayableWriteDownBps: input.tradePayableWriteDownBps, covenantWaiver: input.covenantWaiver,
  };
  const votes = creditors.map((creditor) => voteForCreditor(state, creditor, terms));
  const acceptedClaims = votes.filter((item) => item.vote === 'accepted').reduce((sum, item) => sum + item.claimCents, 0);
  const securedConsent = votes.every((item) => item.securedClaimCents <= 0 || item.vote === 'accepted');
  const thresholdBps = 6_667;
  const approved = acceptedClaims * 10_000 >= totalClaims * thresholdBps && securedConsent;
  const id = `workout:${input.entityId}:q${state.quarter}:${(state.creditorWorkouts ?? []).filter((item) => item.entityId === input.entityId).length + 1}`;
  const dueQuarter = state.quarter + input.deadlineQuarters;
  const milestones: CreditorWorkoutMilestone[] = [
    { id: `${id}:cash-flow`, metric: 'operating-cash-contribution', targetCents: input.minimumOperatingCashContributionCents, dueQuarter, status: 'pending' },
    { id: `${id}:payables`, metric: 'operating-payables', targetCents: input.maximumOperatingPayablesCents, dueQuarter, status: 'pending' },
    { id: `${id}:arrears`, metric: 'debt-arrears', targetCents: input.maximumDebtArrearsCents, dueQuarter, status: 'pending' },
  ];
  const workout: CreditorWorkout = {
    id, entityId: input.entityId, openedQuarter: state.quarter, status: approved ? 'active' : 'rejected',
    terms, totalClaimsCents: moneyFromCents(totalClaims), acceptedClaimsCents: moneyFromCents(acceptedClaims),
    approvalThresholdBps: thresholdBps, votes, milestones,
    resolutionNote: approved ? 'Approved by at least two-thirds of claim value, with secured-creditor consent.'
      : securedConsent ? 'The required two-thirds claim-value approval was not reached.' : 'A secured creditor did not consent.',
    ...(approved ? { effectiveQuarter: state.quarter } : {}),
  };
  if (!approved) {
    return { ok: true, state: { ...state, creditorWorkouts: [...(state.creditorWorkouts ?? []), workout] }, workout };
  }
  const debts = state.debts.map((debt) => {
    if (debt.borrowerId !== input.entityId || !debt.lenderId) return debt;
    const vote = votes.find((item) => item.creditorId === debt.lenderId);
    if (vote?.vote !== 'accepted') return debt;
    const secured = (state.assets ?? []).some((asset) => asset.ownerId === input.entityId &&
      asset.securedDebtId === debt.id && asset.disposedQuarter === undefined);
    const writeDown = secured ? 0 : Math.floor(debt.principalCents * terms.principalWriteDownBps / 10_000);
    const maturityQuarter = terms.maturityExtensionQuarters > 0
      ? Math.max(debt.maturityQuarter ?? state.quarter + 4, state.quarter) + terms.maturityExtensionQuarters
      : debt.maturityQuarter;
    return {
      ...debt, principalCents: moneyFromCents(debt.principalCents - writeDown),
      arrearsPrincipalCents: moneyFromCents(Math.min(debt.arrearsPrincipalCents ?? 0, debt.principalCents - writeDown)),
      quarterlyInterestRate: Math.max(0, debt.quarterlyInterestRate - terms.interestReductionBps / 10_000),
      ...(maturityQuarter !== undefined ? { maturityQuarter } : {}),
      ...(terms.standstillQuarters > 0 ? { paymentStandstillThroughQuarter: state.quarter + terms.standstillQuarters - 1 } : {}),
      ...(terms.covenantWaiver ? { covenantTerms: undefined, covenantStatus: 'compliant' as const, covenantBreachStreak: 0 } : {}),
    };
  });
  const operatingPayables = (state.operatingPayables ?? []).map((payable) => {
    if (payable.entityId !== input.entityId || terms.tradePayableWriteDownBps <= 0) return payable;
    const vote = votes.find((item) => item.creditorId === `trade:${payable.creditorClass}`);
    if (vote?.vote !== 'accepted') return payable;
    const writeDown = Math.floor(payable.outstandingAmountCents * terms.tradePayableWriteDownBps / 10_000);
    return { ...payable, outstandingAmountCents: moneyFromCents(payable.outstandingAmountCents - writeDown) };
  });
  const organizations = state.organizations.map((organization) => organization.id === input.entityId
    ? { ...organization, debtCents: moneyFromCents(debts.filter((debt) => debt.borrowerId === input.entityId).reduce((sum, debt) => sum + debt.principalCents, 0)) }
    : organization);
  return {
    ok: true,
    state: { ...state, debts, operatingPayables, organizations, creditorWorkouts: [...(state.creditorWorkouts ?? []), workout] },
    workout,
  };
}

/** Evaluates the persisted recovery milestones against the just-resolved quarter. */
export function advanceCreditorWorkouts(state: GameState, report: QuarterReport): GameState {
  let anyChanged = false;
  const creditorWorkouts = (state.creditorWorkouts ?? []).map((workout) => {
    if (workout.status !== 'active') return workout;
    let workoutChanged = false;
    const entityReport = report.companies.find((item) => item.companyId === workout.entityId);
    const payables = (state.operatingPayables ?? []).filter((item) => item.entityId === workout.entityId)
      .reduce((sum, item) => sum + item.outstandingAmountCents, 0);
    const arrears = state.debts.filter((item) => item.borrowerId === workout.entityId)
      .reduce((sum, item) => sum + (item.arrearsInterestCents ?? 0) + (item.arrearsPrincipalCents ?? 0), 0);
    const milestones = workout.milestones.map((milestone) => {
      if (milestone.status !== 'pending') return milestone;
      const measured = milestone.metric === 'operating-cash-contribution'
        ? entityReport?.operations.operatingCashContributionCents ?? 0
        : milestone.metric === 'operating-payables' ? payables : arrears;
      const met = milestone.metric === 'operating-cash-contribution' ? measured >= milestone.targetCents : measured <= milestone.targetCents;
      if (met || report.quarter >= milestone.dueQuarter) {
        workoutChanged = true;
        return { ...milestone, status: met ? 'met' as const : 'missed' as const, measuredCents: moneyFromCents(measured), assessedQuarter: report.quarter };
      }
      return milestone;
    });
    const breached = milestones.some((item) => item.status === 'missed');
    const completed = milestones.every((item) => item.status === 'met');
    if (!workoutChanged && !breached && !completed) return workout;
    anyChanged = true;
    return {
      ...workout, milestones,
      ...(completed ? { status: 'completed' as const, completedQuarter: report.quarter, resolutionNote: 'All recovery milestones were achieved.' }
        : breached ? { status: 'breached' as const, breachedQuarter: report.quarter, resolutionNote: 'A recovery milestone was missed; creditors may enforce or renegotiate.' } : {}),
    };
  });
  return anyChanged ? { ...state, creditorWorkouts } : state;
}
