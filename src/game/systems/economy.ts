import { addMoney, moneyFromCents, multiplyMoney } from '../domain/money';
import type { MoneyCents, OperatingCompanyState, RegionalMarketState, ServiceContract } from '../domain/types';

export interface FulfilledContract {
  contractId: string;
  deliveredMW: number;
  revenueCents: MoneyCents;
}

export interface OperatingQuarterResult {
  effectiveCapacityMW: number;
  deliveredWorkloadMW: number;
  energyConsumedMWh: number;
  fulfilledContracts: FulfilledContract[];
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

/**
 * Fulfils contracted workload before flexible workload when capacity is scarce.
 * Contract order is the tie-breaker within each class and is scenario data.
 */
export function allocateContractWorkload(
  contracts: ServiceContract[],
  availableWorkloadMW: number,
): FulfilledContract[] {
  let remainingMW = Math.max(0, availableWorkloadMW);
  const ordered = [
    ...contracts.filter((contract) => contract.flexibility === 'contracted'),
    ...contracts.filter((contract) => contract.flexibility === 'flexible'),
  ];

  return ordered.map((contract) => {
    const deliveredMW = Math.min(contract.workloadMW, remainingMW);
    remainingMW -= deliveredMW;
    return {
      contractId: contract.id,
      deliveredMW,
      revenueCents: moneyFromCents(Math.round(deliveredMW * contract.priceCentsPerMWQuarter)),
    };
  });
}

export function calculateRevenueCents(
  company: OperatingCompanyState,
  deliveredWorkloadMW = company.contracts.reduce((sum, contract) => sum + contract.workloadMW, 0),
): MoneyCents {
  const fulfilled = allocateContractWorkload(company.contracts, deliveredWorkloadMW);
  return moneyFromCents(fulfilled.reduce((sum, contract) => sum + contract.revenueCents, 0));
}

export function calculateOperatingQuarter(
  company: OperatingCompanyState,
  market: RegionalMarketState,
): OperatingQuarterResult {
  const effectiveCapacityMW = calculateEffectiveCapacityMW(company);
  const deliveredWorkloadMW = Math.min(company.deliveredWorkloadMW, effectiveCapacityMW);
  const fulfilledContracts = allocateContractWorkload(company.contracts, deliveredWorkloadMW);
  const revenueCents = moneyFromCents(
    fulfilledContracts.reduce((sum, contract) => sum + contract.revenueCents, 0),
  );
  const energyConsumedMWh = deliveredWorkloadMW * market.quarterHours;
  const energyCostCents = multiplyMoney(market.referenceEnergyPriceCentsPerMWh, energyConsumedMWh);
  const nonEnergyOperatingCostCents = addMoney(
    company.cashCosts.operationsAndStaffingCents,
    company.cashCosts.maintenanceCents,
    company.cashCosts.networkAndConnectivityCents,
    company.cashCosts.overheadComplianceInsuranceCents,
  );
  const totalOperatingCostCents = addMoney(energyCostCents, nonEnergyOperatingCostCents);
  const operatingCashContributionCents = moneyFromCents(revenueCents - totalOperatingCostCents);

  return {
    effectiveCapacityMW,
    deliveredWorkloadMW,
    energyConsumedMWh,
    fulfilledContracts,
    revenueCents,
    energyCostCents,
    nonEnergyOperatingCostCents,
    totalOperatingCostCents,
    operatingCashContributionCents,
  };
}
