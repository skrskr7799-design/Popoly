import { validateGameState } from '../domain/invariants';
import { moneyFromCents } from '../domain/money';
import type { GameState, StrategicProjectState, ValidationIssue } from '../domain/types';
import { getInitiativeDefinition } from '../scenario/initiatives';
import { advanceAutonomousActors, getRivalRenewalBid } from '../systems/actors';
import { buildQuarterReport, type ContractNegotiationResult, type ContractRenewalResult, type CreditDecisionReportLine, type CovenantReportLine, type DebtRestructuringReportLine, type QuarterReport } from '../systems/quarterReport';
import { calculateCreditAssessment, calculateScenarioDebtService } from '../systems/finance';

export interface WorkloadDecision {
  companyId: string;
  desiredWorkloadMW: number;
}

export interface ContractOfferCommand {
  contractId: string;
  offeredPriceCentsPerMWQuarter: number;
}

export interface DebtRepaymentCommand {
  debtId: string;
  principalCents: number;
}

export interface DebtDrawdownCommand {
  debtId: string;
  principalCents: number;
}

export interface LoanAcceptanceCommand {
  offerId: string;
}

export interface DebtRefinanceCommand {
  debtId: string; offerId: string; feeBasisPoints?: number;
}
export interface DebtRestructuringCommand {
  debtId: string; requestedMaturityQuarter?: number; requestedQuarterlyInterestRate?: number;
  requestedScheduledPrincipalCentsPerQuarter?: number; requestCovenantWaiver?: boolean; reason?: string;
}
export interface CreditRequestCommand {
  borrowerId: string;
  requestedPrincipalCents: number;
  termQuarters: number;
  collateralDescription?: string;
}

interface ResolvedDebtRepayment extends DebtRepaymentCommand {
  repaymentType: 'scheduled' | 'maturity' | 'acceleration' | 'voluntary';
}

function getScheduledDebtRepayments(state: GameState): ResolvedDebtRepayment[] {
  return state.debts.reduce<ResolvedDebtRepayment[]>((repayments, debt) => {
    if (debt.principalCents <= 0) return repayments;
    if (debt.acceleratedAtQuarter !== undefined && debt.acceleratedAtQuarter <= state.quarter) {
      repayments.push({ debtId: debt.id, principalCents: debt.principalCents, repaymentType: 'acceleration' });
      return repayments;
    }
    if (debt.maturityQuarter !== undefined && debt.maturityQuarter <= state.quarter) {
      repayments.push({ debtId: debt.id, principalCents: debt.principalCents, repaymentType: 'maturity' });
      return repayments;
    }
    const scheduled = (debt.arrearsPrincipalCents ?? 0) + (debt.scheduledPrincipalCentsPerQuarter ?? 0);
    if (scheduled > 0) repayments.push({
      debtId: debt.id,
      principalCents: moneyFromCents(Math.min(debt.principalCents, scheduled)),
      repaymentType: 'scheduled',
    });
    return repayments;
  }, []);
}

export interface ContractRenewalCommand {
  contractId: string;
  offeredPriceCentsPerMWQuarter: number;
  offeredWorkloadMW: number;
  termQuarters: number;
}

export interface QuarterCommands {
  workloadDecisions?: WorkloadDecision[];
  /** Initiatives to sponsor this quarter. Costs and effects come from scenario data. */
  launchInitiatives?: string[];
  /** Price proposal for an existing flexible customer contract; accepted terms begin next quarter. */
  contractOffers?: ContractOfferCommand[];
  /** Renewal proposals for fixed contracts currently inside their notice window. */
  contractRenewals?: ContractRenewalCommand[];
  /** Voluntary principal repayments are validated against opening cash and serviced after contractual debt obligations. */
  debtRepayments?: DebtRepaymentCommand[];
  /** Draws against an existing committed credit facility; proceeds belong to its borrower. */
  debtDrawdowns?: DebtDrawdownCommand[];
  /** Accept lender-originated terms; proceeds and debt belong to the named borrower. */
  acceptLoanOffers?: LoanAcceptanceCommand[];
  /** Ask all eligible lenders to independently underwrite a loan request. */
  requestCredit?: CreditRequestCommand[];
  refinanceDebts?: DebtRefinanceCommand[];
  restructureDebts?: DebtRestructuringCommand[];
  /** Creditor-initiated acceleration notices for defaulted or contractually cross-defaulted instruments. */
  accelerateDebts?: Array<{ debtId: string }>;
}

export interface AdvanceQuarterSuccess {
  ok: true;
  state: GameState;
  report: QuarterReport;
}
export interface AdvanceQuarterFailure { ok: false; issues: ValidationIssue[]; }
export type AdvanceQuarterResult = AdvanceQuarterSuccess | AdvanceQuarterFailure;

const issue = (code: string, message: string, entityId?: string): ValidationIssue => ({
  code, message, ...(entityId ? { entityId } : {}),
});

function applyProjectEffect(state: GameState, project: StrategicProjectState): GameState {
  const definition = getInitiativeDefinition(project.initiativeId);
  if (!definition) return state;
  const effect = definition.effect;
  const operatingCompanies = state.operatingCompanies.map((company, index) => {
    if (index !== 0) return company;
    const capacity = { ...company.capacity };
    if (effect.type === 'capacity-expansion') {
      capacity.installedITMW += effect.installedITMW;
      capacity.operationalLimitMW += effect.operationalLimitMW;
    } else if (effect.type === 'equipment-reservation') {
      capacity.commissionedEquipmentMW += effect.commissionedEquipmentMW;
    } else if (effect.type === 'firm-power') {
      const market = state.regionalMarkets[0];
      const available = market?.immediateFirmPowerHeadroomMW ?? 0;
      capacity.gridAllocationMW += Math.min(effect.gridAllocationMW, available);
    } else if (effect.type === 'resilience') {
      capacity.reliability = Math.min(1, capacity.reliability + effect.reliabilityGain);
    }
    return { ...company, capacity };
  });

  let regionalMarkets = state.regionalMarkets;
  if (effect.type === 'firm-power' && regionalMarkets[0]) {
    const granted = Math.min(effect.gridAllocationMW, regionalMarkets[0].immediateFirmPowerHeadroomMW);
    regionalMarkets = regionalMarkets.map((market, index) => index === 0 ? {
      ...market,
      immediateFirmPowerHeadroomMW: market.immediateFirmPowerHeadroomMW - granted,
      committedPowerMW: market.committedPowerMW + granted,
    } : market);
  }

  let playerIntelligence = state.playerIntelligence;
  if (effect.type === 'market-study') {
    playerIntelligence = playerIntelligence.map((estimate) => ({
      ...estimate,
      confidence: Math.min(1, estimate.confidence + effect.confidenceGain),
      observedQuarter: state.quarter,
      source: 'commissioned market study',
    }));
  }

  return { ...state, operatingCompanies, regionalMarkets, playerIntelligence };
}

function validateCommands(state: GameState, commands: QuarterCommands): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenCompanies = new Set<string>();
  for (const decision of commands.workloadDecisions ?? []) {
    if (seenCompanies.has(decision.companyId)) {
      issues.push(issue('command.workload_duplicate', 'Only one workload decision is allowed per company.', decision.companyId));
      continue;
    }
    seenCompanies.add(decision.companyId);
    const company = state.operatingCompanies.find((item) => item.organizationId === decision.companyId);
    if (!company) {
      issues.push(issue('command.company_unknown', 'Workload decision references an unknown operating company.', decision.companyId));
      continue;
    }
    const maximumDemand = company.contracts.reduce((sum, contract) => sum + contract.workloadMW, 0);
    if (!Number.isFinite(decision.desiredWorkloadMW) || decision.desiredWorkloadMW < 0 ||
        decision.desiredWorkloadMW > maximumDemand) {
      issues.push(issue('command.workload_out_of_range', `Desired workload must be between 0 and contracted demand of ${maximumDemand} MW.`, decision.companyId));
    }
  }

  const refinanceDebtIds = new Set<string>();
  const refinanceOfferIds = new Set<string>();
  const scheduledRepayments = getScheduledDebtRepayments(state)
    .filter((item) => !(commands.refinanceDebts ?? []).some((command) => command.debtId === item.debtId));
  const scheduledByDebt = new Map(scheduledRepayments.map((item) => [item.debtId, item.principalCents]));
  const seenDebtRepayments = new Set<string>();
  const repaymentByBorrower = new Map<string, number>();
  for (const repayment of commands.debtRepayments ?? []) {
    if (seenDebtRepayments.has(repayment.debtId)) {
      issues.push(issue('command.debt_repayment_duplicate', 'Only one principal repayment per debt instrument is allowed in a quarter.', repayment.debtId));
      continue;
    }
    seenDebtRepayments.add(repayment.debtId);
    const debt = state.debts.find((item) => item.id === repayment.debtId);
    if (!debt) {
      issues.push(issue('command.debt_unknown', 'Debt repayment references an unknown debt instrument.', repayment.debtId));
      continue;
    }
    if (!Number.isSafeInteger(repayment.principalCents) || repayment.principalCents <= 0) {
      issues.push(issue('command.debt_repayment_invalid', 'Principal repayment must be a positive integer number of cents.', repayment.debtId));
      continue;
    }
    if ((debt.arrearsPrincipalCents ?? 0) > 0) {
      issues.push(issue('command.debt_repayment_arrears_conflict', 'Overdue principal must be cured through its scheduled payment or creditor-approved restructuring before a voluntary repayment.', repayment.debtId));
      continue;
    }
    if ((commands.refinanceDebts ?? []).some((item) => item.debtId === repayment.debtId)) {
      issues.push(issue('command.debt_refinance_repayment_conflict', 'A debt instrument cannot be voluntarily repaid and refinanced in the same quarter.', repayment.debtId));
      continue;
    }
    if (repayment.principalCents + (scheduledByDebt.get(repayment.debtId) ?? 0) > debt.principalCents) {
      issues.push(issue('command.debt_repayment_exceeds_principal', 'Voluntary and scheduled repayments cannot exceed the outstanding debt balance.', repayment.debtId));
      continue;
    }
    repaymentByBorrower.set(debt.borrowerId, (repaymentByBorrower.get(debt.borrowerId) ?? 0) + repayment.principalCents);
  }

  const borrowerHasBorrowingRestriction = (borrowerId: string) => state.debts.some((debt) =>
    debt.borrowerId === borrowerId && (
      (debt.covenantTerms?.restrictAdditionalBorrowing === true && debt.covenantStatus === 'breached') ||
      debt.paymentStatus === 'defaulted' || debt.crossDefaultedByDebtId !== undefined
    ));

  for (const refinance of commands.refinanceDebts ?? []) {
    if (refinanceDebtIds.has(refinance.debtId) || refinanceOfferIds.has(refinance.offerId)) {
      issues.push(issue('command.debt_refinance_duplicate', 'A debt or loan offer can only participate in one refinancing operation per quarter.', refinance.debtId));
      continue;
    }
    refinanceDebtIds.add(refinance.debtId);
    refinanceOfferIds.add(refinance.offerId);
    const debt = state.debts.find((item) => item.id === refinance.debtId);
    const offer = state.loanOffers.find((item) => item.id === refinance.offerId);
    if (!debt || debt.principalCents <= 0) {
      issues.push(issue('command.debt_refinance_debt_invalid', 'Refinancing requires an existing debt instrument with outstanding principal.', refinance.debtId));
      continue;
    }
    if (debt.acceleratedAtQuarter !== undefined || debt.paymentStatus === 'defaulted' || debt.crossDefaultedByDebtId !== undefined) {
      issues.push(issue('command.debt_refinance_acceleration_or_default', 'Defaulted or accelerated debt cannot be refinanced through the ordinary refinancing path.', refinance.debtId));
    }
    if (debt.maturityQuarter !== undefined && debt.maturityQuarter <= state.quarter) {
      issues.push(issue('command.debt_refinance_maturity_due', 'A debt already due for repayment this quarter cannot be refinanced through this command.', refinance.debtId));
    }
    if (!offer || offer.status !== 'available' || state.quarter > offer.expiresAfterQuarter) {
      issues.push(issue('command.debt_refinance_offer_unavailable', 'Refinancing requires an available, unexpired lender offer.', refinance.offerId));
      continue;
    }
    if (offer.borrowerId !== debt.borrowerId) {
      issues.push(issue('command.debt_refinance_borrower_mismatch', 'The replacement loan must belong to the same legal borrower as the debt being refinanced.', refinance.offerId));
    }
    const feeBps = refinance.feeBasisPoints ?? 100;
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 1000) {
      issues.push(issue('command.debt_refinance_fee_invalid', 'Refinancing fee must be an integer from 0 to 1,000 basis points.', refinance.debtId));
    } else {
      const fee = Math.ceil(debt.principalCents * feeBps / 10_000);
      if (offer.principalCents < debt.principalCents + fee) {
        issues.push(issue('command.debt_refinance_amount_insufficient', 'The replacement facility must cover the old principal and refinancing fee.', refinance.offerId));
      }
    }
    if ((commands.acceptLoanOffers ?? []).some((item) => item.offerId === refinance.offerId)) {
      issues.push(issue('command.loan_offer_duplicate', 'A refinancing offer cannot also be accepted as a separate new loan.', refinance.offerId));
    }
  }

  const acceleratedDebtIds = new Set<string>();
  for (const command of commands.accelerateDebts ?? []) {
    if (acceleratedDebtIds.has(command.debtId)) {
      issues.push(issue('command.debt_acceleration_duplicate', 'Only one acceleration notice per debt instrument is allowed in a quarter.', command.debtId));
      continue;
    }
    acceleratedDebtIds.add(command.debtId);
    const debt = state.debts.find((item) => item.id === command.debtId);
    if (!debt || debt.principalCents <= 0 || !debt.lenderId || !state.lenders.some((item) => item.organizationId === debt.lenderId)) {
      issues.push(issue('command.debt_acceleration_creditor_missing', 'Acceleration requires outstanding debt with a represented contractual lender.', command.debtId));
      continue;
    }
    if (debt.paymentStatus !== 'defaulted' && debt.crossDefaultedByDebtId === undefined) {
      issues.push(issue('command.debt_acceleration_no_default', 'A creditor may accelerate only a payment-defaulted or contractually cross-defaulted instrument.', command.debtId));
    }
    if (debt.acceleratedAtQuarter !== undefined) {
      issues.push(issue('command.debt_acceleration_already_noticed', 'This instrument already has an acceleration notice or an effective acceleration.', command.debtId));
    }
  }

  const restructuredDebtIds = new Set<string>();
  for (const proposal of commands.restructureDebts ?? []) {
    if (restructuredDebtIds.has(proposal.debtId)) {
      issues.push(issue('command.debt_restructure_duplicate', 'Only one restructuring proposal per debt instrument is allowed in a quarter.', proposal.debtId));
      continue;
    }
    restructuredDebtIds.add(proposal.debtId);
    const debt = state.debts.find((item) => item.id === proposal.debtId);
    if (!debt || debt.principalCents <= 0 || !debt.lenderId || !state.lenders.some((item) => item.organizationId === debt.lenderId)) {
      issues.push(issue('command.debt_restructure_creditor_missing', 'Restructuring requires outstanding debt with a represented lender.', proposal.debtId));
      continue;
    }
    if (refinanceDebtIds.has(proposal.debtId)) {
      issues.push(issue('command.debt_restructure_refinance_conflict', 'A debt cannot be restructured and refinanced in the same quarter.', proposal.debtId));
    }
    if (debt.acceleratedAtQuarter !== undefined) {
      issues.push(issue('command.debt_restructure_accelerated', 'An accelerated debt cannot be amended through ordinary restructuring; the creditor must first withdraw or replace its demand.', proposal.debtId));
    }
    if (debt.maturityQuarter !== undefined && debt.maturityQuarter <= state.quarter) {
      issues.push(issue('command.debt_restructure_maturity_due', 'A debt due for mandatory repayment this quarter cannot be restructured after its maturity has arrived.', proposal.debtId));
    }
    const hasTerms = proposal.requestedMaturityQuarter !== undefined ||
      proposal.requestedQuarterlyInterestRate !== undefined ||
      proposal.requestedScheduledPrincipalCentsPerQuarter !== undefined;
    if (!hasTerms && proposal.requestCovenantWaiver !== true) issues.push(issue('command.debt_restructure_terms_missing', 'A restructuring proposal must change a financial term or request a covenant waiver.', proposal.debtId));
    if (proposal.requestCovenantWaiver === true && !debt.covenantTerms) {
      issues.push(issue('command.debt_restructure_no_covenant', 'A covenant waiver can only be requested for a debt instrument that has active covenant terms.', proposal.debtId));
    }
    if (proposal.requestCovenantWaiver !== undefined && typeof proposal.requestCovenantWaiver !== 'boolean') {
      issues.push(issue('command.debt_restructure_waiver_invalid', 'Covenant waiver request must be boolean.', proposal.debtId));
    }
    if (proposal.requestedMaturityQuarter !== undefined &&
        (!Number.isInteger(proposal.requestedMaturityQuarter) ||
          proposal.requestedMaturityQuarter <= Math.max(state.quarter, debt.maturityQuarter ?? state.quarter) ||
          proposal.requestedMaturityQuarter > state.quarter + 16)) {
      issues.push(issue('command.debt_restructure_maturity_invalid', 'A revised maturity must extend the existing maturity and fall within the next 16 quarters.', proposal.debtId));
    }
    if (proposal.requestedQuarterlyInterestRate !== undefined &&
        (!Number.isFinite(proposal.requestedQuarterlyInterestRate) || proposal.requestedQuarterlyInterestRate < 0 ||
          proposal.requestedQuarterlyInterestRate > debt.quarterlyInterestRate)) {
      issues.push(issue('command.debt_restructure_rate_invalid', 'A restructuring may only retain or reduce the current quarterly interest rate.', proposal.debtId));
    }
    if (proposal.requestedScheduledPrincipalCentsPerQuarter !== undefined &&
        (!Number.isSafeInteger(proposal.requestedScheduledPrincipalCentsPerQuarter) ||
          proposal.requestedScheduledPrincipalCentsPerQuarter < 0 ||
          debt.scheduledPrincipalCentsPerQuarter === undefined ||
          proposal.requestedScheduledPrincipalCentsPerQuarter > debt.scheduledPrincipalCentsPerQuarter)) {
      issues.push(issue('command.debt_restructure_amortization_invalid', 'A revised scheduled installment must be an integer no greater than the existing contractual installment.', proposal.debtId));
    }
    const improvesTerms =
      (proposal.requestedMaturityQuarter !== undefined && proposal.requestedMaturityQuarter > (debt.maturityQuarter ?? state.quarter)) ||
      (proposal.requestedQuarterlyInterestRate !== undefined && proposal.requestedQuarterlyInterestRate < debt.quarterlyInterestRate) ||
      (proposal.requestedScheduledPrincipalCentsPerQuarter !== undefined &&
        debt.scheduledPrincipalCentsPerQuarter !== undefined &&
        proposal.requestedScheduledPrincipalCentsPerQuarter < debt.scheduledPrincipalCentsPerQuarter);
    if (hasTerms && !improvesTerms) issues.push(issue('command.debt_restructure_no_improvement', 'The proposed terms must extend maturity, reduce interest, or lower scheduled principal.', proposal.debtId));
    if (proposal.reason !== undefined && (typeof proposal.reason !== 'string' || proposal.reason.length > 240)) {
      issues.push(issue('command.debt_restructure_reason_invalid', 'Restructuring rationale must be 240 characters or fewer.', proposal.debtId));
    }
  }

  const seenDebtDrawdowns = new Set<string>();
  const drawdownByFacility = new Map<string, number>();
  for (const drawdown of commands.debtDrawdowns ?? []) {
    if (seenDebtDrawdowns.has(drawdown.debtId)) {
      issues.push(issue('command.debt_drawdown_duplicate', 'Only one drawdown per credit facility is allowed in a quarter.', drawdown.debtId));
      continue;
    }
    seenDebtDrawdowns.add(drawdown.debtId);
    const facility = state.debts.find((item) => item.id === drawdown.debtId);
    if (!facility) {
      issues.push(issue('command.debt_unknown', 'Credit drawdown references an unknown debt instrument.', drawdown.debtId));
      continue;
    }
    if (borrowerHasBorrowingRestriction(facility.borrowerId)) {
      issues.push(issue('command.covenant_borrowing_restricted', 'An uncured covenant breach or payment default restricts additional borrowing by this legal entity.', facility.borrowerId));
      continue;
    }
    if (facility.facilityLimitCents === undefined) {
      issues.push(issue('command.debt_not_revolving_facility', 'Only a debt instrument with a committed facility limit can be drawn.', drawdown.debtId));
      continue;
    }
    if (!Number.isSafeInteger(drawdown.principalCents) || drawdown.principalCents <= 0) {
      issues.push(issue('command.debt_drawdown_invalid', 'Credit drawdown must be a positive integer number of cents.', drawdown.debtId));
      continue;
    }
    const totalDrawdown = (drawdownByFacility.get(drawdown.debtId) ?? 0) + drawdown.principalCents;
    if (facility.principalCents + totalDrawdown > facility.facilityLimitCents) {
      issues.push(issue('command.debt_facility_limit_exceeded', 'Drawdown would exceed the committed credit facility limit.', drawdown.debtId));
      continue;
    }
    drawdownByFacility.set(drawdown.debtId, totalDrawdown);
  }

  const seenCreditRequests = new Set<string>();
  for (const request of commands.requestCredit ?? []) {
    if (seenCreditRequests.has(request.borrowerId)) {
      issues.push(issue('command.credit_request_duplicate', 'Only one credit request per borrower is allowed in a quarter.', request.borrowerId));
      continue;
    }
    seenCreditRequests.add(request.borrowerId);
    const borrower = state.organizations.find((item) => item.id === request.borrowerId);
    if (!borrower || borrower.kind === 'lender') {
      issues.push(issue('command.credit_borrower_invalid', 'Credit request must identify an existing non-lender legal entity.', request.borrowerId));
    }
    if (borrower && borrowerHasBorrowingRestriction(request.borrowerId)) {
      issues.push(issue('command.covenant_borrowing_restricted', 'An uncured covenant breach or payment default restricts new credit requests for this legal entity.', request.borrowerId));
    }
    if (!Number.isSafeInteger(request.requestedPrincipalCents) || request.requestedPrincipalCents <= 0) {
      issues.push(issue('command.credit_amount_invalid', 'Requested principal must be a positive integer number of cents.', request.borrowerId));
    }
    if (!Number.isInteger(request.termQuarters) || request.termQuarters < 2 || request.termQuarters > 12) {
      issues.push(issue('command.credit_term_invalid', 'Requested loan term must be between 2 and 12 quarters.', request.borrowerId));
    }
    if (request.collateralDescription !== undefined &&
        (typeof request.collateralDescription !== 'string' || request.collateralDescription.length > 160)) {
      issues.push(issue('command.credit_collateral_invalid', 'Collateral description must be 160 characters or fewer.', request.borrowerId));
    }
  }

  const seenLoanOffers = new Set<string>();
  const lenderCapacityUsed = new Map<string, number>();
  const loanFundingCommands = [
    ...(commands.acceptLoanOffers ?? []),
    ...(commands.refinanceDebts ?? []).map((item) => ({ offerId: item.offerId })),
  ];
  for (const acceptance of loanFundingCommands) {
    if (seenLoanOffers.has(acceptance.offerId)) {
      issues.push(issue('command.loan_offer_duplicate', 'A loan offer can only be accepted once per quarter.', acceptance.offerId));
      continue;
    }
    seenLoanOffers.add(acceptance.offerId);
    const offer = state.loanOffers.find((item) => item.id === acceptance.offerId);
    if (!offer) {
      issues.push(issue('command.loan_offer_unknown', 'Loan acceptance references an unknown offer.', acceptance.offerId));
      continue;
    }
    if (!refinanceOfferIds.has(offer.id) && borrowerHasBorrowingRestriction(offer.borrowerId)) {
      issues.push(issue('command.covenant_borrowing_restricted', 'An uncured covenant breach or payment default restricts additional borrowing by this legal entity.', offer.borrowerId));
      continue;
    }
    if (offer.status !== 'available') {
      issues.push(issue('command.loan_offer_unavailable', 'This loan offer is no longer available.', acceptance.offerId));
      continue;
    }
    if (state.quarter > offer.expiresAfterQuarter) {
      issues.push(issue('command.loan_offer_expired', 'This loan offer has expired.', acceptance.offerId));
      continue;
    }
    const lender = state.lenders.find((item) => item.organizationId === offer.lenderId);
    const lenderOrg = state.organizations.find((item) => item.id === offer.lenderId);
    const borrower = state.organizations.find((item) => item.id === offer.borrowerId);
    if (!lender || !lenderOrg || !borrower) {
      issues.push(issue('command.loan_offer_party_missing', 'The lender or borrower for this offer is missing.', acceptance.offerId));
      continue;
    }
    const used = (lenderCapacityUsed.get(offer.lenderId) ?? 0) + offer.principalCents;
    if (used > lender.availableCapacityCents || used > lenderOrg.cashCents) {
      issues.push(issue('command.lender_capacity_insufficient', 'The lender no longer has enough available lending capacity or liquidity.', offer.lenderId));
      continue;
    }
    lenderCapacityUsed.set(offer.lenderId, used);
  }

  const seenContractOffers = new Set<string>();
  for (const offer of commands.contractOffers ?? []) {
    if (seenContractOffers.has(offer.contractId)) {
      issues.push(issue('command.contract_offer_duplicate', 'Only one offer per contract is allowed in a quarter.', offer.contractId));
      continue;
    }
    seenContractOffers.add(offer.contractId);
    const company = state.operatingCompanies.find((item) =>
      item.contracts.some((contract) => contract.id === offer.contractId));
    const contract = company?.contracts.find((item) => item.id === offer.contractId);
    if (!company || !contract) {
      issues.push(issue('command.contract_unknown', 'Contract offer references an unknown contract.', offer.contractId));
      continue;
    }
    if (contract.flexibility !== 'flexible') {
      issues.push(issue('command.contract_not_flexible', 'Only flexible contracts can be renegotiated in this scenario.', offer.contractId));
    }
    if (!Number.isSafeInteger(offer.offeredPriceCentsPerMWQuarter) || offer.offeredPriceCentsPerMWQuarter <= 0) {
      issues.push(issue('command.contract_price_invalid', 'Offered contract price must be a positive integer number of cents.', offer.contractId));
    }
    if (!state.actors.some((actor) => actor.organizationId === contract.customerId)) {
      issues.push(issue('command.contract_customer_missing', 'Contract customer is not present in the autonomous world.', contract.customerId));
    }
  }

  const seenRenewals = new Set<string>();
  for (const renewal of commands.contractRenewals ?? []) {
    if (seenRenewals.has(renewal.contractId)) {
      issues.push(issue('command.contract_renewal_duplicate', 'Only one renewal proposal per contract is allowed in a quarter.', renewal.contractId));
      continue;
    }
    seenRenewals.add(renewal.contractId);
    const company = state.operatingCompanies.find((item) => item.contracts.some((contract) => contract.id === renewal.contractId));
    const contract = company?.contracts.find((item) => item.id === renewal.contractId);
    if (!contract) {
      issues.push(issue('command.contract_unknown', 'Renewal proposal references an unknown contract.', renewal.contractId));
      continue;
    }
    if (contract.flexibility !== 'contracted' || contract.termEndQuarter === undefined) {
      issues.push(issue('command.contract_not_term_contract', 'Only fixed-term contracted services can be renewed.', renewal.contractId));
      continue;
    }
    if (contract.termEndQuarter - state.quarter > (contract.renewalNoticeQuarters ?? 0)) {
      issues.push(issue('command.contract_renewal_too_early', 'The contract is not yet inside its renewal notice window.', renewal.contractId));
    }
    if (!Number.isSafeInteger(renewal.offeredPriceCentsPerMWQuarter) || renewal.offeredPriceCentsPerMWQuarter <= 0 ||
        !Number.isFinite(renewal.offeredWorkloadMW) || renewal.offeredWorkloadMW <= 0 ||
        renewal.offeredWorkloadMW > contract.workloadMW ||
        !Number.isInteger(renewal.termQuarters) || renewal.termQuarters < 2 || renewal.termQuarters > 8) {
      issues.push(issue('command.contract_renewal_terms_invalid', 'Renewal price, volume, or term is outside the permitted range.', renewal.contractId));
    }
  }

  const launches = commands.launchInitiatives ?? [];
  if (launches.includes('secure-equipment-allocation')) {
    const market = state.regionalMarkets[0];
    if (!market) {
      issues.push(issue('command.equipment_market_missing', 'No regional equipment market is available.'));
    } else {
      const deliveryQuarter = state.quarter + 2;
      const alreadyReserved = state.equipmentOrders
        .filter((order) => order.status === 'reserved' && order.deliveryQuarter === deliveryQuarter)
        .reduce((sum, order) => sum + order.quantityMWEquivalent, 0);
      const available = market.equipmentDeliveryPoolMWEquivalentPerQuarter - 2 - alreadyReserved;
      if (available < 6) {
        issues.push(issue('command.equipment_allocation_unavailable', `Only ${Math.max(0, available)} MW-equivalent of the delivery pool remains for quarter ${deliveryQuarter}; 6 is required.`));
      }
    }
  }
  const seenInitiatives = new Set<string>();
  let leadershipCommitted = 0;
  let cashCommitted = 0;
  for (const initiativeId of launches) {
    if (seenInitiatives.has(initiativeId)) {
      issues.push(issue('command.initiative_duplicate', 'An initiative can only be launched once per quarter.', initiativeId));
      continue;
    }
    seenInitiatives.add(initiativeId);
    const definition = getInitiativeDefinition(initiativeId);
    if (!definition) {
      issues.push(issue('command.initiative_unknown', 'Unknown strategic initiative.', initiativeId));
      continue;
    }
    if (state.projects.some((project) => project.initiativeId === initiativeId && project.remainingQuarters > 0)) {
      issues.push(issue('command.initiative_already_active', 'This initiative is already in progress.', initiativeId));
    }
    leadershipCommitted += definition.leadershipCost;
    cashCommitted += definition.upfrontCostCents;
  }

  if (leadershipCommitted > state.holding.leadershipCapacityPerQuarter) {
    issues.push(issue('command.leadership_exceeded', `Initiatives require ${leadershipCommitted} leadership units; only ${state.holding.leadershipCapacityPerQuarter} are available.`));
  }
  const holding = state.organizations.find((organization) => organization.id === state.holding.organizationId);
  if (!holding || cashCommitted + (repaymentByBorrower.get(state.holding.organizationId) ?? 0) > (holding?.cashCents ?? 0)) {
    issues.push(issue('command.insufficient_holding_cash', 'The holding company does not have enough opening cash for project commitments and debt repayments.', state.holding.organizationId));
  }
  for (const [borrowerId, repaymentCents] of repaymentByBorrower) {
    const borrower = state.organizations.find((organization) => organization.id === borrowerId);
    if (!borrower) {
      issues.push(issue('command.debt_borrower_missing', 'Debt instrument references a missing borrower.', borrowerId));
    } else if (repaymentCents > borrower.cashCents) {
      issues.push(issue('command.debt_repayment_insufficient_cash', 'The borrower does not have enough opening cash for the requested principal repayments.', borrowerId));
    }
  }
  return issues;
}

/**
 * Customer evaluates a price proposal against its private reservation price.
 * Accepted terms are applied after this quarter's report, so they affect the
 * next operating quarter rather than rewriting already-delivered service.
 */
function resolveContractOffers(
  state: GameState,
  offers: ContractOfferCommand[],
): { state: GameState; results: ContractNegotiationResult[] } {
  let operatingCompanies = state.operatingCompanies;
  const results: ContractNegotiationResult[] = [];

  for (const offer of offers) {
    let resolved = false;
    operatingCompanies = operatingCompanies.map((company) => {
      const contract = company.contracts.find((item) => item.id === offer.contractId);
      if (!contract) return company;
      resolved = true;
      const customer = state.actors.find((actor) => actor.organizationId === contract.customerId);
      const reservationPrice = customer?.hiddenMetrics.maxFlexiblePriceCentsPerMWQuarter ?? 44_000_000;
      const offeredPrice = offer.offeredPriceCentsPerMWQuarter;

      if (offeredPrice <= reservationPrice) {
        results.push({
          contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          offeredPriceCents: moneyFromCents(offeredPrice), status: 'accepted',
          message: 'Asterion accepted the revised flexible-service price. The new rate takes effect next quarter.',
        });
        return {
          ...company,
          contracts: company.contracts.map((item) => item.id === contract.id
            ? { ...item, priceCentsPerMWQuarter: moneyFromCents(offeredPrice) }
            : item),
        };
      }

      if (offeredPrice <= Math.round(reservationPrice * 1.1)) {
        results.push({
          contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          offeredPriceCents: moneyFromCents(offeredPrice), status: 'countered',
          counterPriceCents: moneyFromCents(reservationPrice),
          message: 'Asterion declined the proposed rate but returned a lower counteroffer.',
        });
      } else {
        results.push({
          contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          offeredPriceCents: moneyFromCents(offeredPrice), status: 'rejected',
          message: 'Asterion rejected the proposed rate as commercially uncompetitive.',
        });
      }
      return company;
    });
    if (!resolved) {
      throw new Error(`Validated contract offer could not be resolved: ${offer.contractId}`);
    }
  }

  return { state: { ...state, operatingCompanies }, results };
}

/**
 * Renewal proposals are evaluated against private customer reservation terms.
 * Accepted price, volume and duration begin after the current quarter closes.
 */
function resolveContractRenewals(
  state: GameState,
  renewals: ContractRenewalCommand[],
): { state: GameState; results: ContractRenewalResult[] } {
  let operatingCompanies = state.operatingCompanies;
  const results: ContractRenewalResult[] = [];
  for (const renewal of renewals) {
    let found = false;
    operatingCompanies = operatingCompanies.map((company) => {
      const contract = company.contracts.find((item) => item.id === renewal.contractId);
      if (!contract) return company;
      found = true;
      const customer = state.actors.find((actor) => actor.organizationId === contract.customerId);
      const maxPrice = customer?.hiddenMetrics[`renewalMaxPrice:${contract.id}`] ?? contract.priceCentsPerMWQuarter;
      const minVolume = customer?.hiddenMetrics[`renewalMinVolume:${contract.id}`] ?? contract.minimumWorkloadMW ?? 0;
      const rivalBid = getRivalRenewalBid(state, contract);
      const rivalWins = !!rivalBid && renewal.offeredPriceCentsPerMWQuarter > rivalBid.offeredPriceCentsPerMWQuarter;
      if (renewal.offeredWorkloadMW < minVolume) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'rejected', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, message: 'Asterion declined the proposed guaranteed volume because it does not secure enough strategic capacity.' });
        return company;
      }
      if (rivalWins) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'rejected', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, competitorBidAvailable: true,
          competitorProviderId: rivalBid!.providerId,
          message: 'Asterion selected a credible competing proposal with sufficient available capacity. The rival price remains confidential.' });
        return company;
      }
      if (renewal.offeredPriceCentsPerMWQuarter <= maxPrice) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'accepted', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, termQuarters: renewal.termQuarters,
          message: 'Asterion renewed the service agreement. Revised price, guaranteed volume and term begin next quarter.' });
        return { ...company, contracts: company.contracts.map((item) => item.id === contract.id ? {
          ...item, priceCentsPerMWQuarter: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          workloadMW: renewal.offeredWorkloadMW, minimumWorkloadMW: renewal.offeredWorkloadMW,
          termEndQuarter: state.quarter + renewal.termQuarters,
        } : item) };
      }
      if (renewal.offeredPriceCentsPerMWQuarter <= Math.round(maxPrice * 1.1)) {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'countered', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, counterPriceCents: moneyFromCents(maxPrice),
          message: 'Asterion returned a lower counterprice for the proposed renewal.' });
      } else {
        results.push({ contractId: contract.id, providerId: contract.providerId, customerId: contract.customerId,
          status: 'rejected', offeredPriceCents: moneyFromCents(renewal.offeredPriceCentsPerMWQuarter),
          offeredWorkloadMW: renewal.offeredWorkloadMW, message: 'Asterion rejected the renewal as commercially uncompetitive.' });
      }
      return company;
    });
    if (!found) throw new Error(`Validated renewal could not be resolved: ${renewal.contractId}`);
  }
  return { state: { ...state, operatingCompanies }, results };
}

/**
 * Pure, atomic quarter transaction. All decisions are validated before a
 * candidate state is built; the original state is never mutated.
 */
export function advanceQuarter(state: GameState, commands: QuarterCommands = {}): AdvanceQuarterResult {
  const initialIssues = validateGameState(state);
  if (initialIssues.length > 0) return { ok: false, issues: initialIssues };
  const commandIssues = validateCommands(state, commands);
  if (commandIssues.length > 0) return { ok: false, issues: commandIssues };

  try {
    const decisions = commands.workloadDecisions ?? [];
    const launches = commands.launchInitiatives ?? [];
    const definitions = launches.map((id) => getInitiativeDefinition(id)!);
    const leadershipCommitted = definitions.reduce((sum, item) => sum + item.leadershipCost, 0);
    const cashCommitted = definitions.reduce((sum, item) => sum + item.upfrontCostCents, 0);

    const decisionByCompany = new Map(decisions.map((decision) => [decision.companyId, decision.desiredWorkloadMW]));
    let candidate: GameState = {
      ...state,
      organizations: state.organizations.map((organization) => ({ ...organization })),
      ownership: state.ownership.map((stake) => ({ ...stake })),
      debts: state.debts.map((debt) => ({ ...debt })),
      holding: { ...state.holding },
      operatingCompanies: state.operatingCompanies.map((company) => ({
        ...company,
        capacity: { ...company.capacity },
        cashCosts: { ...company.cashCosts },
        contracts: company.contracts.map((contract) => ({ ...contract })),
        deliveredWorkloadMW: decisionByCompany.get(company.organizationId) ?? company.deliveredWorkloadMW,
      })),
      regionalMarkets: state.regionalMarkets.map((market) => ({ ...market })),
      actors: state.actors.map((actor) => ({ ...actor, goals: [...actor.goals], hiddenMetrics: { ...actor.hiddenMetrics } })),
      playerIntelligence: state.playerIntelligence.map((estimate) => ({ ...estimate })),
      projects: state.projects.map((project) => ({ ...project })),
      equipmentOrders: state.equipmentOrders.map((order) => ({ ...order })),
      lenders: state.lenders.map((lender) => ({ ...lender })),
      loanOffers: state.loanOffers.map((offer) => ({ ...offer })),
    };

    const accelerationLines: NonNullable<QuarterReport['debtAccelerations']> = [];
    candidate = {
      ...candidate,
      debts: candidate.debts.map((debt) => {
        const command = (commands.accelerateDebts ?? []).find((item) => item.debtId === debt.id);
        if (!command) return debt;
        const effectiveQuarter = candidate.quarter + 1;
        accelerationLines.push({ debtId: debt.id, borrowerId: debt.borrowerId, lenderId: debt.lenderId!,
          effectiveQuarter, action: 'notice-issued' });
        return { ...debt, accelerationNoticeQuarter: candidate.quarter, acceleratedAtQuarter: effectiveQuarter };
      }),
    };

    // Supplier reservations mature at the start of their delivery quarter.
    candidate = {
      ...candidate,
      equipmentOrders: candidate.equipmentOrders.map((order) =>
        order.status === 'reserved' && order.deliveryQuarter <= state.quarter
          ? { ...order, status: 'delivered' }
          : order),
    };

    const newlyLaunched = definitions.map((definition): StrategicProjectState => ({
      id: `${definition.id}-q${state.quarter}`,
      initiativeId: definition.id,
      startedQuarter: state.quarter,
      remainingQuarters: definition.durationQuarters,
      leadershipCost: definition.leadershipCost,
      initialCostCents: moneyFromCents(definition.upfrontCostCents),
    }));
    const newIds = new Set(newlyLaunched.map((project) => project.id));
    if (launches.includes('secure-equipment-allocation')) {
      candidate = {
        ...candidate,
        equipmentOrders: [...candidate.equipmentOrders, {
          id: `nodeworks-equipment-q${state.quarter}`,
          buyerId: 'nodeworks',
          quantityMWEquivalent: 6,
          placedQuarter: state.quarter,
          deliveryQuarter: state.quarter + 2,
          status: 'reserved',
        }],
      };
    }
    const completed: StrategicProjectState[] = [];
    candidate = {
      ...candidate,
      projects: [
        ...candidate.projects.map((project) => {
          if (project.remainingQuarters <= 0 || newIds.has(project.id)) return project;
          const updated = { ...project, remainingQuarters: project.remainingQuarters - 1 };
          if (updated.remainingQuarters === 0) completed.push(updated);
          return updated;
        }),
        ...newlyLaunched,
      ],
    };

    for (const project of completed) candidate = applyProjectEffect(candidate, project);

    const report = buildQuarterReport(candidate);
    for (const debt of candidate.debts) {
      if (debt.acceleratedAtQuarter === candidate.quarter) accelerationLines.push({
        debtId: debt.id, borrowerId: debt.borrowerId, lenderId: debt.lenderId!,
        effectiveQuarter: candidate.quarter, action: 'acceleration-effective',
      });
    }
    if (accelerationLines.length > 0) report.debtAccelerations = accelerationLines;
    const creditDecisions: CreditDecisionReportLine[] = [];
    for (const request of commands.requestCredit ?? []) {
      const borrower = candidate.organizations.find((item) => item.id === request.borrowerId)!;
      const operatingCashFlow = report.companies.find((item) => item.companyId === request.borrowerId)?.operations.operatingCashContributionCents
        ?? moneyFromCents(0);
      const assessment = calculateCreditAssessment(candidate, request.borrowerId, operatingCashFlow)!;
      for (const lender of candidate.lenders) {
        const lenderOrg = candidate.organizations.find((item) => item.id === lender.organizationId)!;
        const eligibleScore = assessment.score >= lender.minimumCreditScore;
        const annualCashFlow = Math.max(operatingCashFlow * 4, borrower.cashCents);
        const borrowerLimit = operatingCashFlow > 0
          ? Math.round(annualCashFlow * lender.maxLoanToAnnualCashFlow)
          : Math.round(borrower.cashCents * 0.75);
        const amount = Math.min(request.requestedPrincipalCents, lender.availableCapacityCents, lenderOrg.cashCents, borrowerLimit);
        if (!eligibleScore || amount <= 0) {
          creditDecisions.push({
            lenderId: lender.organizationId, borrowerId: borrower.id,
            requestedPrincipalCents: moneyFromCents(request.requestedPrincipalCents),
            creditScore: assessment.score, creditRating: assessment.rating, status: 'rejected',
            reason: !eligibleScore ? 'Borrower does not meet this lender’s minimum credit score.' : 'Requested facility exceeds the lender’s current liquidity or borrower limit.',
          });
          continue;
        }
        const riskSpread = 0.005 + ((850 - assessment.score) / 550) * 0.018;
        const appetiteAdjustment = lender.riskAppetite === 'conservative' ? 0.003
          : lender.riskAppetite === 'growth' ? -0.001 : 0;
        const rate = Math.max(0.005, lender.baseQuarterlyInterestRate + riskSpread + appetiteAdjustment);
        const offerId = `${lender.organizationId}-${borrower.id}-q${candidate.quarter}`;
        const covenantTerms = {
          minimumDebtServiceCoverage: lender.riskAppetite === 'conservative' ? 1.3 : lender.riskAppetite === 'growth' ? 1.05 : 1.15,
          maximumDebtToAnnualCashFlow: lender.riskAppetite === 'conservative' ? 3.0 : lender.riskAppetite === 'growth' ? 4.5 : 3.75,
          restrictAdditionalBorrowing: true,
          graceQuarters: lender.riskAppetite === 'growth' ? 2 : 1,
          breachRatePremium: 0.004,
        };
        const offer = {
          id: offerId, lenderId: lender.organizationId, borrowerId: borrower.id,
          principalCents: moneyFromCents(amount), quarterlyInterestRate: Number(rate.toFixed(6)),
          maturityQuarter: candidate.quarter + request.termQuarters,
          expiresAfterQuarter: candidate.quarter + 1,
          covenantTerms,
          ...(request.collateralDescription ? { collateralDescription: request.collateralDescription } : {}),
          creditScore: assessment.score, creditRating: assessment.rating,
          // Conservative lenders require broader contractual protection; other policies do not by default.
          crossDefaultClause: lender.riskAppetite === 'conservative', status: 'available' as const,
        };
        candidate = { ...candidate, loanOffers: [...candidate.loanOffers, offer] };
        creditDecisions.push({
          lenderId: lender.organizationId, borrowerId: borrower.id,
          requestedPrincipalCents: moneyFromCents(request.requestedPrincipalCents),
          offeredPrincipalCents: offer.principalCents, quarterlyInterestRate: offer.quarterlyInterestRate,
          crossDefaultClause: offer.crossDefaultClause ?? false,
          creditScore: assessment.score, creditRating: assessment.rating, status: 'offered',
          reason: amount < request.requestedPrincipalCents
            ? 'Lender approved a smaller amount within its risk and liquidity limits.'
            : 'Lender approved the requested amount under its current underwriting policy.',
          offerId,
        });
      }
    }
    if (creditDecisions.length > 0) report.creditDecisions = creditDecisions;

    const refinancingDebtIds = new Set((commands.refinanceDebts ?? []).map((item) => item.debtId));
    const scheduledDue = getScheduledDebtRepayments(candidate)
      .filter((item) => !refinancingDebtIds.has(item.debtId));
    const voluntaryRepayments: ResolvedDebtRepayment[] = (commands.debtRepayments ?? [])
      .map((item) => ({ ...item, repaymentType: 'voluntary' as const }));
    // Cash available to service debt is legal-entity cash plus this quarter's
    // operating contribution. Project commitments remain ring-fenced; no group cash pooling.
    const operatingCashByBorrower = new Map(report.entityCashBridges.map((bridge) =>
      [bridge.organizationId, bridge.operatingCashContributionCents] as const));
    const availableByBorrower = new Map(candidate.organizations.map((borrower) => {
      const projectReserve = borrower.id === candidate.holding.organizationId ? cashCommitted : 0;
      return [borrower.id, borrower.cashCents + (operatingCashByBorrower.get(borrower.id) ?? 0) - projectReserve] as const;
    }));
    const interestAccrualByDebt = new Map(calculateScenarioDebtService(candidate).map((line) =>
      [line.debtId, line.interestExpenseCents] as const));
    const interestLines: NonNullable<QuarterReport['debtInterestService']> = [];
    const interestPaidByBorrower = new Map<string, number>();
    const interestReceivedByLender = new Map<string, number>();
    const unpaidInterestByDebt = new Map<string, number>();
    const unpaidPrincipalByDebt = new Map<string, number>();

    // Each instrument is serviced in ledger order: its interest first, then its own scheduled principal.
    const scheduledByDebt = new Map(scheduledDue.map((due) => [due.debtId, due]));
    for (const debt of candidate.debts) {
      const accrued = interestAccrualByDebt.get(debt.id) ?? 0;
      const openingArrears = debt.arrearsInterestCents ?? 0;
      const totalDue = openingArrears + accrued;
      let available = availableByBorrower.get(debt.borrowerId) ?? 0;
      const paid = Math.min(Math.max(0, available), totalDue);
      const closingArrears = totalDue - paid;
      available -= paid;
      if (paid > 0) {
        interestPaidByBorrower.set(debt.borrowerId, (interestPaidByBorrower.get(debt.borrowerId) ?? 0) + paid);
        if (debt.lenderId) {
          interestReceivedByLender.set(debt.lenderId,
            (interestReceivedByLender.get(debt.lenderId) ?? 0) + paid);
          // A lender that is also a borrower may use receipts from earlier ledger entries
          // to service its own later entries in this same deterministic pass.
          const lenderLiquidity = availableByBorrower.get(debt.lenderId);
          if (lenderLiquidity !== undefined) availableByBorrower.set(debt.lenderId, lenderLiquidity + paid);
        }
      }
      if (closingArrears > 0) unpaidInterestByDebt.set(debt.id, closingArrears);
      interestLines.push({
        debtId: debt.id, borrowerId: debt.borrowerId,
        ...(debt.lenderId ? { lenderId: debt.lenderId } : {}),
        accruedInterestCents: moneyFromCents(accrued),
        openingInterestArrearsCents: moneyFromCents(openingArrears),
        interestPaidCents: moneyFromCents(paid),
        closingInterestArrearsCents: moneyFromCents(closingArrears),
        missedContractualService: closingArrears > 0,
      });

      const principalDue = scheduledByDebt.get(debt.id);
      if (principalDue) {
        if (available >= principalDue.principalCents) {
          available -= principalDue.principalCents;
        } else {
          unpaidPrincipalByDebt.set(debt.id, Math.min(debt.principalCents, principalDue.principalCents));
          // A higher-priority contractual installment reserves the remaining liquidity;
          // later instruments cannot leapfrog it just because this installment is all-or-nothing.
          available = 0;
        }
      }
      availableByBorrower.set(debt.borrowerId, available);
    }
    const arrearsLines: NonNullable<QuarterReport['debtArrears']> = [];

    // Voluntary principal repayments are explicit commitments, but rank behind all contractual service.
    for (const payment of voluntaryRepayments) {
      const debt = candidate.debts.find((item) => item.id === payment.debtId)!;
      const available = availableByBorrower.get(debt.borrowerId) ?? 0;
      if (available < payment.principalCents) {
        return { ok: false, issues: [issue(
          'command.debt_repayment_insufficient_after_service',
          'Contractual interest and scheduled principal take priority; insufficient borrower liquidity remains for this voluntary repayment.',
          payment.debtId,
        )] };
      }
      availableByBorrower.set(debt.borrowerId, available - payment.principalCents);
    }

    const unpaidDebtIds = new Set<string>();
    candidate = {
      ...candidate,
      debts: candidate.debts.map((debt) => {
        const unpaidInterest = unpaidInterestByDebt.get(debt.id) ?? 0;
        const unpaidPrincipal = unpaidPrincipalByDebt.get(debt.id) ?? 0;
        const closingPrincipalArrears = unpaidPrincipal > 0 ? unpaidPrincipal : 0;
        const closingInterestArrears = unpaidInterest;
        const missedService = closingInterestArrears > 0 || closingPrincipalArrears > 0;
        const overdueQuarters = missedService ? (debt.overdueQuarters ?? 0) + 1 : 0;
        const status = missedService
          ? overdueQuarters >= 2 ? 'defaulted' as const : 'overdue' as const
          : debt.principalCents === 0 ? 'settled' as const : 'current' as const;
        if (missedService) {
          unpaidDebtIds.add(debt.id);
          arrearsLines.push({
            debtId: debt.id, borrowerId: debt.borrowerId,
            unpaidInterestCents: moneyFromCents(closingInterestArrears),
            unpaidDueCents: moneyFromCents(unpaidPrincipal),
            totalArrearsCents: moneyFromCents(closingPrincipalArrears),
            overdueQuarters, status: overdueQuarters >= 2 ? 'defaulted' : 'overdue',
          });
        }
        return {
          ...debt,
          arrearsInterestCents: moneyFromCents(closingInterestArrears),
          arrearsPrincipalCents: moneyFromCents(closingPrincipalArrears),
          overdueQuarters,
          paymentStatus: status,
        };
      }),
    };
    report.debtInterestService = interestLines.map((line) => ({
      ...line,
      missedContractualService: line.closingInterestArrearsCents > 0 || (unpaidPrincipalByDebt.get(line.debtId) ?? 0) > 0,
    }));
    if (arrearsLines.length > 0) report.debtArrears = arrearsLines;

    // Contractual cross-default applies only to instruments whose own agreement
    // contains the clause, and only between debts of the exact same legal borrower.
    const crossDefaultLines: NonNullable<QuarterReport['crossDefaults']> = [];
    const defaultedIds = new Set(candidate.debts
      .filter((debt) => debt.paymentStatus === 'defaulted')
      .map((debt) => debt.id));
    candidate = {
      ...candidate,
      debts: candidate.debts.map((debt) => {
        const previousSource = debt.crossDefaultedByDebtId;
        const stillTriggered = previousSource !== undefined && defaultedIds.has(previousSource);
        const activeTrigger = candidate.debts.find((trigger) =>
          trigger.id !== debt.id && trigger.borrowerId === debt.borrowerId &&
          trigger.paymentStatus === 'defaulted' && debt.paymentStatus !== 'defaulted' && debt.crossDefaultClause === true);
        const nextSource = stillTriggered ? previousSource : activeTrigger?.id;
        if (previousSource && !stillTriggered && !activeTrigger) {
          crossDefaultLines.push({ affectedDebtId: debt.id, triggerDebtId: previousSource,
            borrowerId: debt.borrowerId, ...(debt.lenderId ? { lenderId: debt.lenderId } : {}), action: 'released' });
        }
        if (!previousSource && nextSource) {
          crossDefaultLines.push({ affectedDebtId: debt.id, triggerDebtId: nextSource,
            borrowerId: debt.borrowerId, ...(debt.lenderId ? { lenderId: debt.lenderId } : {}), action: 'activated' });
        }
        return nextSource ? { ...debt, crossDefaultedByDebtId: nextSource }
          : (() => { const { crossDefaultedByDebtId: _ignored, ...rest } = debt; return rest; })();
      }),
    };
    if (crossDefaultLines.length > 0) report.crossDefaults = crossDefaultLines;

    // Record actual interest cash outflows and matching lender cash receipts.
    const adjustInterestBridge = (bridge: typeof report.entityCashBridges[number]) => {
      const paid = interestPaidByBorrower.get(bridge.organizationId) ?? 0;
      const received = interestReceivedByLender.get(bridge.organizationId) ?? 0;
      const net = received - paid;
      if (net === 0 && paid === 0 && received === 0) return bridge;
      return {
        ...bridge,
        interestPaidCents: moneyFromCents(paid),
        interestIncomeCents: moneyFromCents(received),
        netCashChangeCents: moneyFromCents(bridge.netCashChangeCents + net),
        closingCashCents: moneyFromCents(bridge.closingCashCents + net),
      };
    };
    report.entityCashBridges = report.entityCashBridges.map(adjustInterestBridge);
    report.companies = report.companies.map((company) => ({
      ...company, cashBridge: adjustInterestBridge(company.cashBridge),
    }));

    const paidScheduled = scheduledDue.filter((due) => !unpaidDebtIds.has(due.debtId));
    const debtRepayments: ResolvedDebtRepayment[] = [...paidScheduled, ...voluntaryRepayments];
    if (debtRepayments.length > 0) {
      const repaymentByBorrower = new Map<string, number>();
      const principalReceiptsByLender = new Map<string, number>();
      for (const repayment of debtRepayments) {
        const debt = candidate.debts.find((item) => item.id === repayment.debtId)!;
        repaymentByBorrower.set(debt.borrowerId, (repaymentByBorrower.get(debt.borrowerId) ?? 0) + repayment.principalCents);
        if (debt.lenderId) principalReceiptsByLender.set(debt.lenderId,
          (principalReceiptsByLender.get(debt.lenderId) ?? 0) + repayment.principalCents);
      }
      candidate = {
        ...candidate,
        debts: candidate.debts.map((debt) => {
          const repayment = debtRepayments.filter((item) => item.debtId === debt.id).reduce((sum, item) => sum + item.principalCents, 0);
          if (repayment <= 0) return debt;
          const remainingPrincipal = debt.principalCents - repayment;
          const stillOverdue = (debt.arrearsInterestCents ?? 0) > 0;
          return {
            ...debt,
            principalCents: moneyFromCents(remainingPrincipal),
            arrearsPrincipalCents: moneyFromCents(0),
            overdueQuarters: stillOverdue ? debt.overdueQuarters : 0,
            paymentStatus: stillOverdue ? debt.paymentStatus : remainingPrincipal === 0 ? 'settled' as const : 'current' as const,
          };
        }),
        organizations: candidate.organizations.map((organization) => {
          const repayment = repaymentByBorrower.get(organization.id) ?? 0;
          return repayment > 0 ? { ...organization, debtCents: moneyFromCents(organization.debtCents - repayment) } : organization;
        }),
        lenders: candidate.lenders.map((lender) => {
          const recovered = principalReceiptsByLender.get(lender.organizationId) ?? 0;
          return recovered > 0
            ? { ...lender, availableCapacityCents: moneyFromCents(lender.availableCapacityCents + recovered) }
            : lender;
        }),
      };
      const adjustBridge = (bridge: typeof report.entityCashBridges[number]) => {
        const repayment = repaymentByBorrower.get(bridge.organizationId) ?? 0;
        const principalReceived = principalReceiptsByLender.get(bridge.organizationId) ?? 0;
        if (repayment === 0 && principalReceived === 0) return bridge;
        const netPrincipalFlow = principalReceived - repayment;
        return {
          ...bridge,
          principalReceivedCents: moneyFromCents(bridge.principalReceivedCents + principalReceived),
          financingCashFlowCents: moneyFromCents(bridge.financingCashFlowCents + netPrincipalFlow),
          netCashChangeCents: moneyFromCents(bridge.netCashChangeCents + netPrincipalFlow),
          closingCashCents: moneyFromCents(bridge.closingCashCents + netPrincipalFlow),
        };
      };
      report.entityCashBridges = report.entityCashBridges.map(adjustBridge);
      report.companies = report.companies.map((company) => ({
        ...company,
        cashBridge: adjustBridge(company.cashBridge),
      }));
      report.debtRepayments = debtRepayments.map((repayment) => ({
        debtId: repayment.debtId,
        borrowerId: candidate.debts.find((debt) => debt.id === repayment.debtId)!.borrowerId,
        ...(candidate.debts.find((debt) => debt.id === repayment.debtId)!.lenderId
          ? { lenderId: candidate.debts.find((debt) => debt.id === repayment.debtId)!.lenderId } : {}),
        principalCents: moneyFromCents(repayment.principalCents),
        repaymentType: repayment.repaymentType,
      }));
    }
    const debtDrawdowns = commands.debtDrawdowns ?? [];
    if (debtDrawdowns.length > 0) {
      const drawdownByBorrower = new Map<string, number>();
      for (const drawdown of debtDrawdowns) {
        const facility = candidate.debts.find((item) => item.id === drawdown.debtId)!;
        drawdownByBorrower.set(facility.borrowerId, (drawdownByBorrower.get(facility.borrowerId) ?? 0) + drawdown.principalCents);
      }
      candidate = {
        ...candidate,
        debts: candidate.debts.map((debt) => {
          const drawdown = debtDrawdowns.find((item) => item.debtId === debt.id);
          return drawdown ? { ...debt, principalCents: moneyFromCents(debt.principalCents + drawdown.principalCents) } : debt;
        }),
        organizations: candidate.organizations.map((organization) => {
          const drawdown = drawdownByBorrower.get(organization.id) ?? 0;
          return drawdown > 0 ? { ...organization, debtCents: moneyFromCents(organization.debtCents + drawdown) } : organization;
        }),
      };
      const adjustBridge = (bridge: typeof report.entityCashBridges[number]) => {
        const drawdown = drawdownByBorrower.get(bridge.organizationId) ?? 0;
        if (drawdown === 0) return bridge;
        return {
          ...bridge,
          financingCashFlowCents: moneyFromCents(bridge.financingCashFlowCents + drawdown),
          netCashChangeCents: moneyFromCents(bridge.netCashChangeCents + drawdown),
          closingCashCents: moneyFromCents(bridge.closingCashCents + drawdown),
        };
      };
      report.entityCashBridges = report.entityCashBridges.map(adjustBridge);
      report.companies = report.companies.map((company) => ({
        ...company,
        cashBridge: adjustBridge(company.cashBridge),
      }));
      report.debtDrawdowns = debtDrawdowns.map((drawdown) => ({
        debtId: drawdown.debtId,
        borrowerId: candidate.debts.find((debt) => debt.id === drawdown.debtId)!.borrowerId,
        principalCents: moneyFromCents(drawdown.principalCents),
      }));
    }
    const acceptedOffers = commands.acceptLoanOffers ?? [];
    const refinanceCommands = commands.refinanceDebts ?? [];
    const accepted = [
      ...acceptedOffers.map((command) => candidate.loanOffers.find((offer) => offer.id === command.offerId)!),
      ...refinanceCommands.map((command) => candidate.loanOffers.find((offer) => offer.id === command.offerId)!),
    ];
    if (accepted.length > 0) {
      const fundingByBorrower = new Map<string, number>();
      const fundingByLender = new Map<string, number>();
      const refinancePayoffByBorrower = new Map<string, number>();
      const refinanceFeesByBorrower = new Map<string, number>();
      const repaymentReceiptsByLender = new Map<string, number>();
      const refinancingLines = [];
      const refinanceByDebt = new Map(refinanceCommands.map((item) => [item.debtId, item]));
      for (const offer of accepted) {
        fundingByBorrower.set(offer.borrowerId, (fundingByBorrower.get(offer.borrowerId) ?? 0) + offer.principalCents);
        fundingByLender.set(offer.lenderId, (fundingByLender.get(offer.lenderId) ?? 0) + offer.principalCents);
      }
      for (const command of refinanceCommands) {
        const oldDebt = candidate.debts.find((item) => item.id === command.debtId)!;
        if ((oldDebt.arrearsInterestCents ?? 0) > 0) {
          return { ok: false, issues: [issue('command.debt_refinance_interest_arrears_unsettled',
            'Refinancing cannot erase unpaid accrued interest; settle it before replacing the debt instrument.', oldDebt.id)] };
        }
        const offer = accepted.find((item) => item.id === command.offerId)!;
        const feeBps = command.feeBasisPoints ?? 100;
        const fee = Math.ceil(oldDebt.principalCents * feeBps / 10_000);
        refinancePayoffByBorrower.set(oldDebt.borrowerId, (refinancePayoffByBorrower.get(oldDebt.borrowerId) ?? 0) + oldDebt.principalCents);
        refinanceFeesByBorrower.set(oldDebt.borrowerId, (refinanceFeesByBorrower.get(oldDebt.borrowerId) ?? 0) + fee);
        if (oldDebt.lenderId) {
          repaymentReceiptsByLender.set(oldDebt.lenderId, (repaymentReceiptsByLender.get(oldDebt.lenderId) ?? 0) + oldDebt.principalCents);
        }
        refinancingLines.push({
          oldDebtId: oldDebt.id, newDebtId: `loan-${offer.id}`,
          borrowerId: oldDebt.borrowerId, newLenderId: offer.lenderId,
          refinancedPrincipalCents: moneyFromCents(oldDebt.principalCents),
          feeCents: moneyFromCents(fee),
          netCashReleasedCents: moneyFromCents(offer.principalCents - oldDebt.principalCents - fee),
        });
      }
      candidate = {
        ...candidate,
        loanOffers: candidate.loanOffers.map((offer) => accepted.some((item) => item.id === offer.id)
          ? { ...offer, status: 'accepted' as const } : offer),
        lenders: candidate.lenders.map((lender) => {
          const used = fundingByLender.get(lender.organizationId) ?? 0;
          const recovered = repaymentReceiptsByLender.get(lender.organizationId) ?? 0;
          return used > 0 || recovered > 0
            ? { ...lender, availableCapacityCents: moneyFromCents(lender.availableCapacityCents - used + recovered) }
            : lender;
        }),
        organizations: candidate.organizations.map((organization) => {
          const lent = fundingByLender.get(organization.id) ?? 0;
          const received = fundingByBorrower.get(organization.id) ?? 0;
          const payoff = refinancePayoffByBorrower.get(organization.id) ?? 0;
          const fee = refinanceFeesByBorrower.get(organization.id) ?? 0;
          const recovered = repaymentReceiptsByLender.get(organization.id) ?? 0;
          const cashFlow = -lent + received - payoff - fee + recovered;
          const debtChange = received - payoff;
          if (cashFlow === 0 && debtChange === 0) return organization;
          return {
            ...organization,
            cashCents: moneyFromCents(organization.cashCents + cashFlow),
            debtCents: debtChange !== 0 ? moneyFromCents(organization.debtCents + debtChange) : organization.debtCents,
          };
        }),
        debts: [
          ...candidate.debts.map((debt) => refinanceByDebt.has(debt.id)
            ? { ...debt, principalCents: moneyFromCents(0), scheduledPrincipalCentsPerQuarter: moneyFromCents(0) }
            : debt),
          ...accepted.map((offer) => ({
            id: `loan-${offer.id}`, borrowerId: offer.borrowerId, lenderId: offer.lenderId,
            ...(offer.collateralDescription ? { collateralDescription: offer.collateralDescription } : {}),
            principalCents: offer.principalCents, quarterlyInterestRate: offer.quarterlyInterestRate,
            maturityQuarter: offer.maturityQuarter,
            covenantTerms: offer.covenantTerms ? { ...offer.covenantTerms } : undefined,
            covenantStartQuarter: candidate.quarter + 1,
            covenantBreachStreak: 0,
            covenantStatus: 'compliant' as const,
            covenantPenaltyApplied: false,
            crossDefaultClause: offer.crossDefaultClause ?? false,
          })),
        ],
      };
      const adjustBridge = (bridge: typeof report.entityCashBridges[number]) => {
        const received = fundingByBorrower.get(bridge.organizationId) ?? 0;
        const lent = fundingByLender.get(bridge.organizationId) ?? 0;
        const payoff = refinancePayoffByBorrower.get(bridge.organizationId) ?? 0;
        const fee = refinanceFeesByBorrower.get(bridge.organizationId) ?? 0;
        const recovered = repaymentReceiptsByLender.get(bridge.organizationId) ?? 0;
        const flow = received - lent - payoff - fee + recovered;
        if (flow === 0) return bridge;
        return { ...bridge,
          principalReceivedCents: moneyFromCents(bridge.principalReceivedCents + recovered),
          financingCashFlowCents: moneyFromCents(bridge.financingCashFlowCents + flow),
          netCashChangeCents: moneyFromCents(bridge.netCashChangeCents + flow),
          closingCashCents: moneyFromCents(bridge.closingCashCents + flow) };
      };
      report.entityCashBridges = report.entityCashBridges.map(adjustBridge);
      report.companies = report.companies.map((company) => ({ ...company, cashBridge: adjustBridge(company.cashBridge) }));
      report.loanAcceptances = accepted.map((offer) => ({
        offerId: offer.id, lenderId: offer.lenderId, borrowerId: offer.borrowerId,
        principalCents: offer.principalCents, quarterlyInterestRate: offer.quarterlyInterestRate,
        maturityQuarter: offer.maturityQuarter, crossDefaultClause: offer.crossDefaultClause ?? false,
      }));
      if (refinancingLines.length > 0) report.debtRefinancings = refinancingLines;
    }
    candidate = { ...candidate, loanOffers: candidate.loanOffers.map((offer) =>
      offer.status === 'available' && offer.expiresAfterQuarter < state.quarter + 1
        ? { ...offer, status: 'expired' as const } : offer) };

    const nodeworksOperations = report.companies.find((item) => item.companyId === 'nodeworks')?.operations;
    if (nodeworksOperations) {
      const fixedContracts = candidate.operatingCompanies.find((item) => item.organizationId === 'nodeworks')?.contracts.filter((item) => item.flexibility === 'contracted') ?? [];
      const fixedResults = nodeworksOperations.fulfilledContracts.filter((line) => fixedContracts.some((contract) => contract.id === line.contractId));
      const hasSlaBreach = fixedResults.some((line) => line.serviceCreditCents > 0);
      const hasMaterialShortfall = fixedResults.some((line) => {
        const contract = fixedContracts.find((item) => item.id === line.contractId)!;
        return contract.workloadMW - line.deliveredMW > 0.25;
      });
      if (hasSlaBreach || hasMaterialShortfall) {
        candidate = { ...candidate, organizations: candidate.organizations.map((organization) => organization.id === 'nodeworks'
          ? { ...organization, reputation: Math.max(0, organization.reputation - (hasSlaBreach ? 1.5 : 1)) }
          : organization) };
      }
    }
    const nodeworksServiceSnapshot = candidate.operatingCompanies.find((company) => company.organizationId === 'nodeworks');
    const serviceSnapshot = nodeworksServiceSnapshot ? {
      companyId: nodeworksServiceSnapshot.organizationId,
      contracts: nodeworksServiceSnapshot.contracts.map((contract) => ({ ...contract })),
      fulfilledContracts: nodeworksOperations?.fulfilledContracts ?? [],
    } : undefined;
    const negotiations = resolveContractOffers(candidate, commands.contractOffers ?? []);
    candidate = negotiations.state;
    report.contractNegotiations = negotiations.results;
    const renewals = resolveContractRenewals(candidate, commands.contractRenewals ?? []);
    candidate = renewals.state;
    report.contractRenewals = renewals.results;
    const covenantUpdates: CovenantReportLine[] = [];
    candidate = {
      ...candidate,
      debts: candidate.debts.map((debt) => {
        const terms = debt.covenantTerms;
        if (!terms || (debt.covenantStartQuarter ?? 1) > report.quarter || debt.principalCents <= 0) return debt;
        const borrower = candidate.organizations.find((item) => item.id === debt.borrowerId);
        const operatingCashFlow = report.companies.find((item) => item.companyId === debt.borrowerId)?.operations.operatingCashContributionCents ?? moneyFromCents(0);
        const borrowerDebts = candidate.debts.filter((item) => item.borrowerId === debt.borrowerId && item.principalCents > 0);
        const interestAndScheduled = borrowerDebts.reduce((sum, item) =>
          sum + Math.round(item.principalCents * item.quarterlyInterestRate) + (item.scheduledPrincipalCentsPerQuarter ?? 0), 0);
        const dscr = interestAndScheduled > 0 ? operatingCashFlow / interestAndScheduled : operatingCashFlow > 0 ? 10 : 0;
        const annualCashFlowProxy = Math.max(operatingCashFlow * 4, borrower?.cashCents ?? 0, 1);
        const leverage = (borrower?.debtCents ?? 0) / annualCashFlowProxy;
        const reasons: string[] = [];
        if (terms.minimumDebtServiceCoverage !== undefined && dscr < terms.minimumDebtServiceCoverage) reasons.push('debt-service coverage below covenant minimum');
        if (terms.maximumDebtToAnnualCashFlow !== undefined && leverage > terms.maximumDebtToAnnualCashFlow) reasons.push('debt-to-annual-cash-flow above covenant maximum');
        const breached = reasons.length > 0;
        const breachStreak = breached ? (debt.covenantBreachStreak ?? 0) + 1 : 0;
        const graceQuarters = terms.graceQuarters ?? 0;
        const status = !breached ? 'compliant' as const : breachStreak <= graceQuarters ? 'grace' as const : 'breached' as const;
        const applyPenalty = status === 'breached' && !debt.covenantPenaltyApplied && (terms.breachRatePremium ?? 0) > 0;
        const penalty = applyPenalty ? terms.breachRatePremium ?? 0 : 0;
        covenantUpdates.push({
          debtId: debt.id, borrowerId: debt.borrowerId, status, breachStreak,
          debtServiceCoverage: Number.isFinite(dscr) ? dscr : 0,
          debtToAnnualCashFlow: Number.isFinite(leverage) ? leverage : 0,
          reasons, ...(penalty > 0 ? { ratePenaltyApplied: penalty } : {}),
        });
        return {
          ...debt,
          quarterlyInterestRate: debt.quarterlyInterestRate + penalty,
          covenantBreachStreak: breachStreak,
          covenantStatus: status,
          covenantPenaltyApplied: debt.covenantPenaltyApplied === true || applyPenalty,
        };
      }),
    };
    if (covenantUpdates.length > 0) report.covenantUpdates = covenantUpdates;

    const restructuringResults: DebtRestructuringReportLine[] = [];
    candidate = {
      ...candidate,
      debts: candidate.debts.map((debt) => {
        const proposal = (commands.restructureDebts ?? []).find((item) => item.debtId === debt.id);
        if (!proposal || !debt.lenderId) return debt;
        const lender = candidate.lenders.find((item) => item.organizationId === debt.lenderId);
        const operatingCashFlow = report.companies.find((item) => item.companyId === debt.borrowerId)?.operations.operatingCashContributionCents ?? moneyFromCents(0);
        const assessment = calculateCreditAssessment(candidate, debt.borrowerId, operatingCashFlow);
        const distressed = debt.covenantStatus === 'breached' || debt.covenantStatus === 'grace';
        const materiallyWeak = (assessment?.score ?? 850) < 600;
        const protectivePackage =
          (proposal.requestedMaturityQuarter ?? debt.maturityQuarter ?? 0) > (debt.maturityQuarter ?? candidate.quarter) &&
          (proposal.requestedQuarterlyInterestRate ?? debt.quarterlyInterestRate) < debt.quarterlyInterestRate;
        const approved = lender?.riskAppetite === 'growth'
          ? distressed || materiallyWeak
          : lender?.riskAppetite === 'balanced'
            ? debt.covenantStatus === 'breached' || materiallyWeak
            : debt.covenantStatus === 'breached' && (operatingCashFlow > 0 || protectivePackage);
        const reason = approved
          ? proposal.requestCovenantWaiver
            ? 'The lender approved a covenant waiver after reviewing the borrower’s distress and recovery capacity.'
            : 'The lender approved revised repayment terms to reduce near-term debt-service pressure.'
          : 'The lender declined the request because the borrower does not meet its restructuring criteria.';
        restructuringResults.push({
          debtId: debt.id, borrowerId: debt.borrowerId, lenderId: debt.lenderId,
          status: approved ? 'accepted' : 'rejected',
          previousQuarterlyInterestRate: debt.quarterlyInterestRate,
          ...(approved && proposal.requestedQuarterlyInterestRate !== undefined ? { newQuarterlyInterestRate: proposal.requestedQuarterlyInterestRate } : {}),
          ...(debt.maturityQuarter !== undefined ? { previousMaturityQuarter: debt.maturityQuarter } : {}),
          ...(approved && proposal.requestedMaturityQuarter !== undefined ? { newMaturityQuarter: proposal.requestedMaturityQuarter } : {}),
          ...(debt.scheduledPrincipalCentsPerQuarter !== undefined ? { previousScheduledPrincipalCentsPerQuarter: debt.scheduledPrincipalCentsPerQuarter } : {}),
          ...(approved && proposal.requestedScheduledPrincipalCentsPerQuarter !== undefined
            ? { newScheduledPrincipalCentsPerQuarter: moneyFromCents(proposal.requestedScheduledPrincipalCentsPerQuarter) } : {}),
          ...(approved && proposal.requestCovenantWaiver ? { covenantWaived: true } : {}),
          ...(proposal.reason ? { borrowerRationale: proposal.reason } : {}),
          reason,
        });
        if (!approved) return debt;
        return {
          ...debt,
          ...(proposal.requestedMaturityQuarter !== undefined ? { maturityQuarter: proposal.requestedMaturityQuarter } : {}),
          ...(proposal.requestedQuarterlyInterestRate !== undefined ? { quarterlyInterestRate: proposal.requestedQuarterlyInterestRate } : {}),
          ...(proposal.requestedScheduledPrincipalCentsPerQuarter !== undefined
            ? { scheduledPrincipalCentsPerQuarter: moneyFromCents(proposal.requestedScheduledPrincipalCentsPerQuarter) } : {}),
          ...(proposal.requestCovenantWaiver ? {
            covenantTerms: undefined, covenantStatus: 'compliant' as const, covenantBreachStreak: 0,
          } : {}),
        };
      }),
    };
    if (restructuringResults.length > 0) report.debtRestructurings = restructuringResults;

    const autonomousTurn = advanceAutonomousActors(candidate, serviceSnapshot);
    candidate = autonomousTurn.state;
    const closingCash = new Map(report.entityCashBridges.map((bridge) => [
      bridge.organizationId, bridge.closingCashCents,
    ]));
    const nextState: GameState = {
      ...candidate,
      quarter: state.quarter + 1,
      organizations: candidate.organizations.map((organization) => {
        const cashCents = closingCash.get(organization.id);
        if (cashCents === undefined) return organization;
        const projectCommitment = organization.id === state.holding.organizationId ? cashCommitted : 0;
        return { ...organization, cashCents: moneyFromCents(cashCents - projectCommitment) };
      }),
    };

    const finalIssues = validateGameState(nextState);
    if (finalIssues.length > 0) return { ok: false, issues: finalIssues };
    report.actorActions = autonomousTurn.actions;
    report.leadershipCapacity = state.holding.leadershipCapacityPerQuarter;
    report.leadershipCommitted = leadershipCommitted;
    report.projectsLaunched = newlyLaunched.map((project) => project.initiativeId);
    report.projectsCompleted = completed.map((project) => project.initiativeId);
    report.projectCashCommitmentCents = moneyFromCents(cashCommitted);
    return { ok: true, state: nextState, report };
  } catch (error) {
    return { ok: false, issues: [issue(
      'quarter.calculation_failed',
      error instanceof Error ? error.message : 'Quarter calculation failed unexpectedly.',
    )] };
  }
}
