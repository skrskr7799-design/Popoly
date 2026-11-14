import type { CorporateAsset, GameState, MoneyCents, OperatingPayable } from '../domain/types';
import { moneyFromCents } from '../domain/money';

export interface LiquidationDistribution {
  claimId: string;
  creditorId: string;
  claimClass: 'secured-debt' | 'operating-payable' | 'unsecured-debt';
  claimAmountCents: MoneyCents;
  recoveryCents: MoneyCents;
  shortfallCents: MoneyCents;
}

export interface LiquidationAssetRealization {
  assetId: string;
  assetClass: CorporateAsset['assetClass'];
  grossProceedsCents: MoneyCents;
  administrationCostCents: MoneyCents;
  netProceedsCents: MoneyCents;
  securedDebtId?: string;
  securedRecoveryCents: MoneyCents;
  estateContributionCents: MoneyCents;
}

export interface LiquidationWaterfall {
  entityId: string;
  grossAssetProceedsCents: MoneyCents;
  administrationCostsCents: MoneyCents;
  securedDebtRecoveryCents: MoneyCents;
  unsecuredEstateCents: MoneyCents;
  totalCreditorClaimsCents: MoneyCents;
  totalCreditorRecoveryCents: MoneyCents;
  shareholderResidualCents: MoneyCents;
  assetRealizations: LiquidationAssetRealization[];
  distributions: LiquidationDistribution[];
}

/**
 * Deterministic, legal-entity-scoped liquidation estimate. Secured lenders
 * recover only from their pledged assets; all remaining proceeds follow the
 * scenario's statutory-style operating-creditor and unsecured-debt waterfall.
 * It is a calculation only and never mutates the campaign.
 */
export function calculateLiquidationWaterfall(
  state: GameState,
  entityId: string,
  administrationCostBasisPoints = 500,
): LiquidationWaterfall {
  if (!state.organizations.some((organization) => organization.id === entityId)) {
    throw new Error(`Unknown liquidation entity: ${entityId}`);
  }
  if (!Number.isInteger(administrationCostBasisPoints) ||
      administrationCostBasisPoints < 0 || administrationCostBasisPoints > 10_000) {
    throw new Error('Administration cost must be between 0 and 10,000 basis points.');
  }

  const assets = (state.assets ?? []).filter((asset) =>
    asset.ownerId === entityId && asset.disposedQuarter === undefined);
  const debts = state.debts.filter((debt) => debt.borrowerId === entityId && debt.principalCents > 0);
  const payables = (state.operatingPayables ?? []).filter((payable) =>
    payable.entityId === entityId && payable.outstandingAmountCents > 0);
  const debtClaims = new Map(debts.map((debt) => [
    debt.id,
    debt.principalCents + (debt.arrearsInterestCents ?? 0),
  ]));

  const distributions: LiquidationDistribution[] = [];
  const assetRealizations: LiquidationAssetRealization[] = [];
  let grossAssetProceedsCents = 0;
  let administrationCostsCents = 0;
  let securedDebtRecoveryCents = 0;
  let unsecuredEstateCents = 0;

  for (const asset of assets) {
    const gross = asset.realizableValueCents;
    const administrationCost = Math.floor(gross * administrationCostBasisPoints / 10_000);
    const net = gross - administrationCost;
    grossAssetProceedsCents += gross;
    administrationCostsCents += administrationCost;
    let securedRecovery = 0;
    if (asset.securedDebtId) {
      const remainingClaim = debtClaims.get(asset.securedDebtId) ?? 0;
      securedRecovery = Math.min(net, remainingClaim);
      debtClaims.set(asset.securedDebtId, remainingClaim - securedRecovery);
      securedDebtRecoveryCents += securedRecovery;
    }
    const estateContribution = net - securedRecovery;
    unsecuredEstateCents += estateContribution;
    assetRealizations.push({
      assetId: asset.id,
      assetClass: asset.assetClass,
      grossProceedsCents: moneyFromCents(gross),
      administrationCostCents: moneyFromCents(administrationCost),
      netProceedsCents: moneyFromCents(net),
      ...(asset.securedDebtId ? { securedDebtId: asset.securedDebtId } : {}),
      securedRecoveryCents: moneyFromCents(securedRecovery),
      estateContributionCents: moneyFromCents(estateContribution),
    });
  }

  const securedDebts = debts.filter((debt) => assets.some((asset) =>
    asset.securedDebtId === debt.id));
  for (const debt of securedDebts) {
    const originalClaim = debt.principalCents + (debt.arrearsInterestCents ?? 0);
    const recovered = securedDebtRecoveryCentsForDebt(assetRealizations, debt.id);
    distributions.push({
      claimId: debt.id,
      creditorId: debt.lenderId ?? `lender-claim:${debt.id}`,
      claimClass: 'secured-debt',
      // The secured tranche is limited to realized collateral proceeds; any
      // remaining principal is represented once in the unsecured tier below.
      claimAmountCents: moneyFromCents(recovered),
      recoveryCents: moneyFromCents(recovered),
      shortfallCents: moneyFromCents(0),
    });
  }

  const unsecuredClaims: Array<{
    claimId: string; creditorId: string; claimClass: 'operating-payable' | 'unsecured-debt';
    amountCents: number; priority: number; incurredQuarter: number;
  }> = [];

  for (const payable of payables) {
    const priority = payablePriority(payable);
    unsecuredClaims.push({
      claimId: payable.id,
      creditorId: `operating-creditor:${payable.creditorClass}`,
      claimClass: 'operating-payable',
      amountCents: payable.outstandingAmountCents,
      priority,
      incurredQuarter: payable.incurredQuarter,
    });
  }

  for (const debt of debts) {
    const originalClaim = debt.principalCents + (debt.arrearsInterestCents ?? 0);
    const secured = securedDebts.some((item) => item.id === debt.id);
    const securedRecovery = secured ? securedDebtRecoveryCentsForDebt(assetRealizations, debt.id) : 0;
    const residual = originalClaim - securedRecovery;
    if (residual > 0) unsecuredClaims.push({
      claimId: debt.id,
      creditorId: debt.lenderId ?? `lender-claim:${debt.id}`,
      claimClass: 'unsecured-debt',
      amountCents: residual,
      priority: 6,
      incurredQuarter: 0,
    });
  }

  const tiers = [...new Set(unsecuredClaims.map((claim) => claim.priority))].sort((a, b) => a - b);
  let estateRemaining = unsecuredEstateCents;
  for (const tier of tiers) {
    const claims = unsecuredClaims.filter((claim) => claim.priority === tier)
      .sort((a, b) => a.incurredQuarter - b.incurredQuarter ||
        (a.claimId < b.claimId ? -1 : a.claimId > b.claimId ? 1 : 0));
    const tierTotal = claims.reduce((sum, claim) => sum + claim.amountCents, 0);
    const tierRecovery = Math.min(estateRemaining, tierTotal);
    const allocations = proRata(tierRecovery, claims.map((claim) => ({
      id: claim.claimId, amount: claim.amountCents,
    })));
    for (const claim of claims) {
      const recovered = allocations.get(claim.claimId) ?? 0;
      distributions.push({
        claimId: claim.claimId,
        creditorId: claim.creditorId,
        claimClass: claim.claimClass,
        claimAmountCents: moneyFromCents(claim.amountCents),
        recoveryCents: moneyFromCents(recovered),
        shortfallCents: moneyFromCents(claim.amountCents - recovered),
      });
    }
    estateRemaining -= tierRecovery;
    if (estateRemaining <= 0) break;
  }

  const totalCreditorClaimsCents = distributions.reduce((sum, item) => sum + item.claimAmountCents, 0);
  const totalCreditorRecoveryCents = distributions.reduce((sum, item) => sum + item.recoveryCents, 0);
  return {
    entityId,
    grossAssetProceedsCents: moneyFromCents(grossAssetProceedsCents),
    administrationCostsCents: moneyFromCents(administrationCostsCents),
    securedDebtRecoveryCents: moneyFromCents(securedDebtRecoveryCents),
    unsecuredEstateCents: moneyFromCents(unsecuredEstateCents),
    totalCreditorClaimsCents: moneyFromCents(totalCreditorClaimsCents),
    totalCreditorRecoveryCents: moneyFromCents(totalCreditorRecoveryCents),
    shareholderResidualCents: moneyFromCents(Math.max(0, estateRemaining)),
    assetRealizations,
    distributions,
  };
}

function securedDebtRecoveryCentsForDebt(
  assets: LiquidationAssetRealization[],
  debtId: string,
): number {
  return assets.filter((asset) => asset.securedDebtId === debtId)
    .reduce((sum, asset) => sum + asset.securedRecoveryCents, 0);
}

function payablePriority(payable: OperatingPayable): number {
  const statutoryClassPriority: Record<OperatingPayable['creditorClass'], number> = {
    payroll: 1,
    'tax-overhead': 2,
    energy: 3,
    maintenance: 4,
    'network-vendor': 5,
  };
  return statutoryClassPriority[payable.creditorClass] * 100 + payable.priority;
}

function proRata(total: number, claims: Array<{ id: string; amount: number }>): Map<string, number> {
  const claimTotal = claims.reduce((sum, claim) => sum + claim.amount, 0);
  if (total <= 0 || claimTotal <= 0) return new Map(claims.map((claim) => [claim.id, 0]));
  const allocations = new Map<string, number>();
  let assigned = 0;
  for (const claim of claims) {
    const amount = Math.floor(total * claim.amount / claimTotal);
    allocations.set(claim.id, amount);
    assigned += amount;
  }
  let remainder = total - assigned;
  for (const claim of [...claims].sort((a, b) =>
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (remainder <= 0) break;
    const current = allocations.get(claim.id) ?? 0;
    if (current < claim.amount) {
      allocations.set(claim.id, current + 1);
      remainder -= 1;
    }
  }
  return allocations;
}
