import type { GameState } from '../domain/types';
import { validateGameState } from '../domain/invariants';
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type CampaignSaveV1, type PersistenceError, type PersistenceResult } from './types';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const records = (value: unknown): value is UnknownRecord[] => Array.isArray(value) && value.every(isRecord);

function hasOptionalRecord(record: UnknownRecord, key: string): boolean {
  return record[key] === undefined || isRecord(record[key]);
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
  if (value.schemaVersion !== 1 || !isString(value.scenarioId) || !isString(value.scenarioVersion) ||
      !Number.isSafeInteger(value.seed) || !Number.isInteger(value.quarter) || !isRecord(value.holding)) return false;

  if (!value.organizations.every((item) => isString(item.id) && isString(item.name) && isString(item.kind) &&
      isNumber(item.cashCents) && isNumber(item.debtCents) && isNumber(item.reputation))) return false;
  if (!value.ownership.every((item) => isString(item.ownerId) && isString(item.companyId) &&
      isNumber(item.shares) && isNumber(item.votingShares))) return false;
  if (!value.debts.every((item) => isString(item.id) && isString(item.borrowerId) &&
      isNumber(item.principalCents) && isNumber(item.quarterlyInterestRate) &&
      hasOptionalRecord(item, 'covenantTerms'))) return false;

  const holding = value.holding;
  if (!isString(holding.organizationId) || !isNumber(holding.leadershipCapacityPerQuarter) ||
      !isNumber(holding.institutionalAccess) || !isNumber(holding.revolverLimitCents) ||
      !isString(holding.strategicRiskPolicy)) return false;

  if (!value.operatingCompanies.every((item) => isString(item.organizationId) && isRecord(item.capacity) &&
      isNumber(item.capacity.installedITMW) && isNumber(item.capacity.gridAllocationMW) &&
      isNumber(item.capacity.commissionedEquipmentMW) && isNumber(item.capacity.operationalLimitMW) &&
      isNumber(item.capacity.reliability) && isNumber(item.deliveredWorkloadMW) &&
      isRecord(item.cashCosts) && isNumber(item.cashCosts.operationsAndStaffingCents) &&
      isNumber(item.cashCosts.maintenanceCents) && isNumber(item.cashCosts.networkAndConnectivityCents) &&
      isNumber(item.cashCosts.overheadComplianceInsuranceCents) && records(item.contracts) &&
      item.contracts.every((contract) => isString(contract.id) && isString(contract.customerId) &&
        isString(contract.providerId) && isNumber(contract.workloadMW) &&
        isNumber(contract.priceCentsPerMWQuarter) && isString(contract.flexibility)))) return false;

  if (!value.regionalMarkets.every((item) => isString(item.id) && isString(item.name) &&
      isNumber(item.quarterHours) && isNumber(item.availablePowerMW) && isNumber(item.committedPowerMW) &&
      isNumber(item.referenceEnergyPriceCentsPerMWh) && isNumber(item.immediateFirmPowerHeadroomMW) &&
      isNumber(item.equipmentDeliveryPoolMWEquivalentPerQuarter))) return false;
  if (!value.actors.every((item) => isString(item.organizationId) && isStringArray(item.goals) &&
      isRecord(item.hiddenMetrics) && Object.values(item.hiddenMetrics).every(isNumber))) return false;
  if (!value.playerIntelligence.every((item) => isString(item.subjectId) && isString(item.metric) &&
      isNumber(item.min) && isNumber(item.max) && isString(item.knowledge) && isNumber(item.confidence) &&
      isNumber(item.observedQuarter) && isString(item.source))) return false;
  if (!value.projects.every((item) => isString(item.id) && isString(item.initiativeId) &&
      isNumber(item.startedQuarter) && isNumber(item.remainingQuarters) &&
      isNumber(item.leadershipCost) && isNumber(item.initialCostCents))) return false;
  if (!value.equipmentOrders.every((item) => isString(item.id) && isString(item.buyerId) &&
      isNumber(item.quantityMWEquivalent) && isNumber(item.placedQuarter) &&
      isNumber(item.deliveryQuarter) && isString(item.status))) return false;
  if (!value.lenders.every((item) => isString(item.organizationId) && isNumber(item.availableCapacityCents) &&
      isString(item.riskAppetite) && isNumber(item.baseQuarterlyInterestRate) &&
      isNumber(item.minimumCreditScore) && isNumber(item.maxLoanToAnnualCashFlow))) return false;
  if (!value.loanOffers.every((item) => isString(item.id) && isString(item.lenderId) &&
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
  let issues;
  try {
    issues = validateGameState(value.state);
  } catch {
    return invalid('save.state_shape_invalid', 'The saved GameState could not be safely inspected.');
  }
  if (issues.length > 0) {
    return { ok: false, error: { code: 'save.state_invalid', message: 'The saved GameState violates domain invariants.', issues } };
  }
  const state = value.state;
  if (value.scenarioId !== state.scenarioId || value.scenarioVersion !== state.scenarioVersion ||
      value.gameStateSchemaVersion !== state.schemaVersion || value.quarter !== state.quarter) {
    return invalid('save.metadata_mismatch', 'Save metadata does not match its authoritative GameState.');
  }
  if (!Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt)) ||
      value.updatedAt < value.createdAt || value.campaignId.trim().length === 0 ||
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
