import type { AdministrationCase, GameState } from '../domain/types';

export type AdministrationTrigger = AdministrationCase['trigger'];
export type AdministrationOutcome = 'reorganized';

export interface AdministrationTransition {
  ok: true;
  state: GameState;
  administrationCase: AdministrationCase;
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
 * Creditor and asset resolution is a separate explicit decision.
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

/**
 * Records a successful creditor-approved reorganization. Existing claims and
 * balances remain intact; the company simply exits formal administration.
 */
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
