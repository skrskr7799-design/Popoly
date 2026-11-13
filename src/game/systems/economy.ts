import { addMoney, moneyFromCents, multiplyMoney } from '../domain/money';
import type { MoneyCents, OperatingCompanyState, RegionalMarketState, ServiceContract } from '../domain/types';

export interface FulfilledContract {
  contractId: string;
  deliveredMW: number;
  revenueCents: MoneyCents;
  serviceCreditCents: MoneyCents;
}

export interface OperatingQuarterResult {
  effectiveCapacityMW: number;
  deliveredWorkloadMW: number;
  energyConsumedMWh: number;
  fulfilledContracts: FulfilledContract[];
  grossRevenueCents: MoneyCents;
  serviceCreditCents: MoneyCents;
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
  actualReliability?: number,
): FulfilledContract[] {
  let remainingMW = Math.max(0, availableWorkloadMW);
  const ordered = [
    ...contracts.filter((contract) => contract.flexibility === 'contracted'),
    ...contracts.filter((contract) => contract.flexibility === 'flexible'),
  ];

  return ordered.map((contract) => {
    const deliveredMW = Math.min(contract.workloadMW, remainingMW);
    remainingMW -= deliveredMW;
    const grossRevenueCents = Math.round(deliveredMW * contract.priceCentsPerMWQuarter);
    const slaBreached = contract.slaTargetReliability !== undefined &&
      actualReliability !== undefined && actualReliability < contract.slaTargetReliability;
    const serviceCreditCents = slaBreached
      ? Math.round(grossRevenueCents * (contract.slaServiceCreditBps ?? 0) / 10_000)
      : 0;
    return {
      contractId: contract.id,
      deliveredMW,
      revenueCents: moneyFromCents(grossRevenueCents - serviceCreditCents),
      serviceCreditCents: moneyFromCents(serviceCreditCents),
    };
  });
}

export function calculateRevenueCents(
  company: OperatingCompanyState,
  deliveredWorkloadMW = company.contracts.reduce((sum, contract) => sum + contract.workloadMW, 0),
): MoneyCents {
  const fulfilled = allocateContractWorkload(company.contracts, deliveredWorkloadMW, company.capacity.reliability);
  return moneyFromCents(fulfilled.reduce((sum, contract) => sum + contract.revenueCents, 0));
}

export function calculateOperatingQuarter(
  company: OperatingCompanyState,
  market: RegionalMarketState,
): OperatingQuarterResult {
  const effectiveCapacityMW = calculateEffectiveCapacityMW(company);
  const deliveredWorkloadMW = Math.min(company.deliveredWorkloadMW, effectiveCapacityMW);
  const fulfilledContracts = allocateContractWorkload(company.contracts, deliveredWorkloadMW, company.capacity.reliability);
  const grossRevenueCents = moneyFromCents(fulfilledContracts.reduce(
    (sum, contract) => sum + contract.revenueCents + contract.serviceCreditCents, 0,
  ));
  const serviceCreditCents = moneyFromCents(fulfilledContracts.reduce(
    (sum, contract) => sum + contract.serviceCreditCents, 0,
  ));
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
    grossRevenueCents,
    serviceCreditCents,
    revenueCents,
    energyCostCents,
    nonEnergyOperatingCostCents,
    totalOperatingCostCents,
    operatingCashContributionCents,
  };
}
