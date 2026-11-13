import { addMoney, moneyFromCents, multiplyMoney } from '../domain/money';
import type { MoneyCents, OperatingCompanyState, RegionalMarketState } from '../domain/types';

export interface OperatingQuarterResult {
  effectiveCapacityMW: number;
  deliveredWorkloadMW: number;
  energyConsumedMWh: number;
  revenueCents: MoneyCents;
  energyCostCents: MoneyCents;
  nonEnergyOperatingCostCents: MoneyCents;
  totalOperatingCostCents: MoneyCents;
  operatingCashContributionCents: MoneyCents;
}

export function calculateEffectiveCapacityMW(company: OperatingCompanyState): number {
  const { installedITMW, gridAllocationMW, commissionedEquipmentMW, operationalLimitMW, reliability } = company.capacity;
  return Math.min(installedITMW, gridAllocationMW, commissionedEquipmentMW, operationalLimitMW) * reliability;
}

export function calculateRevenueCents(company: OperatingCompanyState): MoneyCents {
  const total = company.contracts.reduce(
    (sum, contract) => sum + contract.workloadMW * contract.priceCentsPerMWQuarter,
    0,
  );
  return moneyFromCents(total);
}

export function calculateOperatingQuarter(
  company: OperatingCompanyState,
  market: RegionalMarketState,
): OperatingQuarterResult {
  const effectiveCapacityMW = calculateEffectiveCapacityMW(company);
  const deliveredWorkloadMW = Math.min(company.deliveredWorkloadMW, effectiveCapacityMW);
  const energyConsumedMWh = deliveredWorkloadMW * market.quarterHours;
  const energyPrice = market.referenceEnergyPriceCentsPerMWh;
  const energyCostCents = multiplyMoney(energyPrice, energyConsumedMWh);
  const nonEnergyOperatingCostCents = addMoney(
    company.cashCosts.operationsAndStaffingCents,
    company.cashCosts.maintenanceCents,
    company.cashCosts.networkAndConnectivityCents,
    company.cashCosts.overheadComplianceInsuranceCents,
  );
  const totalOperatingCostCents = addMoney(energyCostCents, nonEnergyOperatingCostCents);
  const revenueCents = calculateRevenueCents(company);
  const operatingCashContributionCents = moneyFromCents(revenueCents - totalOperatingCostCents);

  return {
    effectiveCapacityMW,
    deliveredWorkloadMW,
    energyConsumedMWh,
    revenueCents,
    energyCostCents,
    nonEnergyOperatingCostCents,
    totalOperatingCostCents,
    operatingCashContributionCents,
  };
}
