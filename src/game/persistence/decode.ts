import type { GameState } from '../domain/types';
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type CampaignSaveV1, type PersistenceError, type PersistenceResult } from './types';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const records = (value: unknown): value is UnknownRecord[] => Array.isArray(value) && value.every(isRecord);

function hasOptionalRecord(record: object, key: string): boolean {
  const value = (record as Record<string, unknown>)[key];
  return value === undefined || isRecord(value);
}

/**
 * Performs defensive shape checks before domain validation. It deliberately
 * validates object/array boundaries first so malformed JSON cannot crash the
 * domain invariant validator through missing nested containers.
 */
export function isGameStateShape(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  const arrayKeys = ['organizations', 'ownership', 'debts', 'operatingCompanies', 'regionalMarkets',
    'actors', 'playerIntelligence', 'projects', 'equipmentOrders', 'lenders', 'loanOffers'];
  if (!arrayKeys.every((key) => records(value[key]))) return false;
  const state = value as unknown as GameState;
  if (state.schemaVersion !== 1 || !isString(state.scenarioId) || !isString(state.scenarioVersion) ||
      !Number.isSafeInteger(state.seed) || !Number.isInteger(state.quarter) || !isRecord(state.holding)) return false;

  if (!state.organizations.every((item) => isString(item.id) && isString(item.name) && isString(item.kind) &&
      isNumber(item.cashCents) && isNumber(item.debtCents) && isNumber(item.reputation))) return false;
  if (!state.ownership.every((item) => isString(item.ownerId) && isString(item.companyId) &&
      isNumber(item.shares) && isNumber(item.votingShares))) return false;
  if (!state.debts.every((item) => isString(item.id) && isString(item.borrowerId) &&
      isNumber(item.principalCents) && isNumber(item.quarterlyInterestRate) &&
      hasOptionalRecord(item, 'covenantTerms') &&
      (item.paymentStandstillThroughQuarter === undefined || isNumber(item.paymentStandstillThroughQuarter)))) return false;

  const holding = state.holding;
  if (!isString(holding.organizationId) || !isNumber(holding.leadershipCapacityPerQuarter) ||
      !isNumber(holding.institutionalAccess) || !isNumber(holding.revolverLimitCents) ||
      !isString(holding.strategicRiskPolicy)) return false;

  if (!state.operatingCompanies.every((item) => isString(item.organizationId) && isRecord(item.capacity) &&
      isNumber(item.capacity.installedITMW) && isNumber(item.capacity.gridAllocationMW) &&
      isNumber(item.capacity.commissionedEquipmentMW) && isNumber(item.capacity.operationalLimitMW) &&
      isNumber(item.capacity.reliability) && isNumber(item.deliveredWorkloadMW) &&
      isRecord(item.cashCosts) && isNumber(item.cashCosts.operationsAndStaffingCents) &&
      isNumber(item.cashCosts.maintenanceCents) && isNumber(item.cashCosts.networkAndConnectivityCents) &&
      isNumber(item.cashCosts.overheadComplianceInsuranceCents) &&
      (item.turnaroundActions === undefined || isStringArray(item.turnaroundActions)) &&
      (item.status === undefined || isString(item.status)) && records(item.contracts) &&
      item.contracts.every((contract) => isString(contract.id) && isString(contract.customerId) &&
        isString(contract.providerId) && isNumber(contract.workloadMW) &&
        isNumber(contract.priceCentsPerMWQuarter) && isString(contract.flexibility)))) return false;

  if (!state.regionalMarkets.every((item) => isString(item.id) && isString(item.name) &&
      isNumber(item.quarterHours) && isNumber(item.availablePowerMW) && isNumber(item.committedPowerMW) &&
      isNumber(item.referenceEnergyPriceCentsPerMWh) && isNumber(item.immediateFirmPowerHeadroomMW) &&
      isNumber(item.equipmentDeliveryPoolMWEquivalentPerQuarter))) return false;
  if (state.assets !== undefined && (!records(state.assets) ||
      !state.assets.every((item) => isString(item.id) && isString(item.ownerId) &&
        isString(item.assetClass) && isNumber(item.bookValueCents) &&
        isNumber(item.realizableValueCents) &&
        (item.securedDebtId === undefined || isString(item.securedDebtId)) &&
        (item.disposedQuarter === undefined || isNumber(item.disposedQuarter))))) return false;
  if (state.operatingPayables !== undefined && (!records(state.operatingPayables) ||
      !state.operatingPayables.every((item) => isString(item.id) && isString(item.entityId) &&
        isString(item.creditorClass) && isNumber(item.originalAmountCents) &&
        isNumber(item.outstandingAmountCents) && isNumber(item.incurredQuarter) &&
        isNumber(item.dueQuarter) && isNumber(item.priority)))) return false;
  if (state.administrationCases !== undefined && (!records(state.administrationCases) ||
      !state.administrationCases.every((item) => isString(item.id) && isString(item.entityId) &&
        isNumber(item.openedQuarter) && isString(item.trigger) && isString(item.status) &&
        (item.resolvedQuarter === undefined || isNumber(item.resolvedQuarter)) &&
        (item.resolution === undefined || (isRecord(item.resolution) &&
          isNumber(item.resolution.resolvedQuarter) &&
          isNumber(item.resolution.grossAssetProceedsCents) &&
          isNumber(item.resolution.cashRealizedCents) &&
          isNumber(item.resolution.administrationCostsCents) &&
          isNumber(item.resolution.totalCreditorClaimsCents) &&
          isNumber(item.resolution.totalCreditorRecoveryCents) &&
          isNumber(item.resolution.shareholderResidualCents) &&
          records(item.resolution.distributions) &&
          item.resolution.distributions.every((distribution) => isString(distribution.claimId) &&
            isString(distribution.creditorId) && isString(distribution.claimClass) &&
            isNumber(distribution.claimAmountCents) && isNumber(distribution.recoveryCents) &&
            isNumber(distribution.shortfallCents))))))) return false;
  if (state.creditorWorkouts !== undefined && (!records(state.creditorWorkouts) ||
      !state.creditorWorkouts.every((item) => isString(item.id) && isString(item.entityId) &&
        isNumber(item.openedQuarter) && isString(item.status) && isRecord(item.terms) &&
        isNumber(item.terms.standstillQuarters) && isNumber(item.terms.maturityExtensionQuarters) &&
        isNumber(item.terms.interestReductionBps) && isNumber(item.terms.principalWriteDownBps) &&
        isNumber(item.terms.tradePayableWriteDownBps) && isNumber(item.terms.debtToEquityConversionBps) &&
        (item.terms.equityPreMoneyValuationCents === undefined || isNumber(item.terms.equityPreMoneyValuationCents)) && typeof item.terms.covenantWaiver === 'boolean' &&
        isNumber(item.totalClaimsCents) && isNumber(item.acceptedClaimsCents) &&
        isNumber(item.approvalThresholdBps) && records(item.votes) &&
        item.votes.every((vote) => isString(vote.creditorId) && isString(vote.creditorKind) &&
          isNumber(vote.claimCents) && isNumber(vote.securedClaimCents) && isString(vote.vote) &&
          isString(vote.reason) && (vote.counterTerms === undefined || isRecord(vote.counterTerms))) &&
        records(item.milestones) && item.milestones.every((milestone) => isString(milestone.id) &&
          isString(milestone.metric) && isNumber(milestone.targetCents) && isNumber(milestone.dueQuarter) &&
          isString(milestone.status) && (milestone.measuredCents === undefined || isNumber(milestone.measuredCents)) &&
          (milestone.assessedQuarter === undefined || isNumber(milestone.assessedQuarter))) &&
        (item.effectiveQuarter === undefined || isNumber(item.effectiveQuarter)) &&
        (item.completedQuarter === undefined || isNumber(item.completedQuarter)) &&
        (item.breachedQuarter === undefined || isNumber(item.breachedQuarter)) &&
        (item.debtConvertedCents === undefined || isNumber(item.debtConvertedCents)) &&
        (item.newSharesIssued === undefined || isNumber(item.newSharesIssued)) &&
        (item.resolutionNote === undefined || isString(item.resolutionNote))))) return false;
  if (!state.actors.every((item) => isString(item.organizationId) && isStringArray(item.goals) &&
      isRecord(item.hiddenMetrics) && Object.values(item.hiddenMetrics).every(isNumber))) return false;
  if (!state.playerIntelligence.every((item) => isString(item.subjectId) && isString(item.metric) &&
      isNumber(item.min) && isNumber(item.max) && isString(item.knowledge) && isNumber(item.confidence) &&
      isNumber(item.observedQuarter) && isString(item.source))) return false;
  if (!state.projects.every((item) => isString(item.id) && isString(item.initiativeId) &&
      isNumber(item.startedQuarter) && isNumber(item.remainingQuarters) &&
      isNumber(item.leadershipCost) && isNumber(item.initialCostCents))) return false;
  if (!state.equipmentOrders.every((item) => isString(item.id) && isString(item.buyerId) &&
      isNumber(item.quantityMWEquivalent) && isNumber(item.placedQuarter) &&
      isNumber(item.deliveryQuarter) && isString(item.status))) return false;
  if (!state.lenders.every((item) => isString(item.organizationId) && isNumber(item.availableCapacityCents) &&
      isString(item.riskAppetite) && isNumber(item.baseQuarterlyInterestRate) &&
      isNumber(item.minimumCreditScore) && isNumber(item.maxLoanToAnnualCashFlow))) return false;
  if (!state.loanOffers.every((item) => isString(item.id) && isString(item.lenderId) &&
      isString(item.borrowerId) && isNumber(item.principalCents) &&
      isNumber(item.quarterlyInterestRate) && isNumber(item.maturityQuarter) &&
      isNumber(item.expiresAfterQuarter) && isNumber(item.creditScore) &&
      isString(item.creditRating) && isString(item.status) && hasOptionalRecord(item, 'covenantTerms'))) return false;
  return true;
}

function invalid(code: string, message: string): PersistenceResult<never> {
  return { ok: false, error: { code, message } };
}

export function decodeCampaignSaveShape(value: unknown): PersistenceResult<CampaignSaveV1> {
  if (!isRecord(value)) return invalid('save.envelope_invalid', 'Save envelope must be a JSON object.');
  if (value.format !== SAVE_FORMAT) return invalid('save.format_unsupported', 'This file is not a supported Popoly campaign save.');
  if (value.saveSchemaVersion !== SAVE_SCHEMA_VERSION) {
    return invalid('save.schema_unsupported', `Save schema version ${String(value.saveSchemaVersion)} is not supported.`);
  }
  if (!isString(value.simulationVersion) || !isString(value.campaignId) ||
      !isString(value.createdAt) || !isString(value.updatedAt) ||
      !isString(value.scenarioId) || !isString(value.scenarioVersion) ||
      !isNumber(value.gameStateSchemaVersion) || !isNumber(value.quarter) ||
      !isString(value.checksum)) {
    return invalid('save.envelope_invalid', 'Save envelope metadata is incomplete or has invalid field types.');
  }
  if (!isGameStateShape(value.state)) {
    return invalid('save.state_shape_invalid', 'The saved GameState has an invalid structure.');
  }
  const state = value.state;
  if (value.scenarioId !== state.scenarioId || value.scenarioVersion !== state.scenarioVersion ||
      value.gameStateSchemaVersion !== state.schemaVersion || value.quarter !== state.quarter) {
    return invalid('save.metadata_mismatch', 'Save metadata does not match its authoritative GameState.');
  }
  if (!Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt)) ||
      Date.parse(value.updatedAt) < Date.parse(value.createdAt) || value.campaignId.trim().length === 0 ||
      value.simulationVersion.trim().length === 0) {
    return invalid('save.metadata_invalid', 'Campaign identity, timestamps, or simulation version are invalid.');
  }
  return { ok: true, value: value as unknown as CampaignSaveV1 };
}

export function asPersistenceError(error: unknown, fallbackCode: string): PersistenceError {
  return {
    code: fallbackCode,
    message: error instanceof Error ? error.message : 'An unexpected persistence error occurred.',
  };
}
