import { moneyFromDollars } from '../domain/money';
import type { GameState } from '../domain/types';

export const COMPUTE_BOTTLENECK_SCENARIO_ID = 'the-compute-bottleneck';
export const COMPUTE_BOTTLENECK_SCENARIO_VERSION = '0.1.0';

export function createComputeBottleneckState(seed = 2035): GameState {
  return {
    schemaVersion: 1, scenarioId: COMPUTE_BOTTLENECK_SCENARIO_ID,
    scenarioVersion: COMPUTE_BOTTLENECK_SCENARIO_VERSION, seed, quarter: 1,
    organizations: [
      { id: 'meridian-group', name: 'Meridian Group', kind: 'holding', cashCents: moneyFromDollars(14_000_000), debtCents: moneyFromDollars(3_000_000), reputation: 62 },
      { id: 'nodeworks', name: 'NodeWorks', kind: 'operating_company', cashCents: moneyFromDollars(4_200_000), debtCents: moneyFromDollars(14_000_000), reputation: 74 },
      { id: 'founders-employees', name: 'Founders & Employees', kind: 'holding', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 50 },
      { id: 'regional-infrastructure-fund', name: 'Regional Infrastructure Fund', kind: 'holding', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 50 },
      { id: 'kestrel-compute', name: 'Kestrel Compute', kind: 'competitor', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 68 },
      { id: 'asterion-ai', name: 'Asterion AI', kind: 'customer', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 70 },
      { id: 'solara-grid', name: 'Solara Grid', kind: 'supplier', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 72 },
      { id: 'silicon-vein', name: 'Silicon Vein', kind: 'supplier', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 66 },
      { id: 'regional-infrastructure-authority', name: 'Regional Infrastructure Authority', kind: 'institution', cashCents: moneyFromDollars(0), debtCents: moneyFromDollars(0), reputation: 60 },
    ],
    ownership: [
      { ownerId: 'meridian-group', companyId: 'nodeworks', shares: 7_200_000, votingShares: 7_200_000 },
      { ownerId: 'founders-employees', companyId: 'nodeworks', shares: 1_800_000, votingShares: 1_800_000 },
      { ownerId: 'regional-infrastructure-fund', companyId: 'nodeworks', shares: 1_000_000, votingShares: 1_000_000 },
    ],
    debts: [
      { id: 'meridian-revolver', borrowerId: 'meridian-group', principalCents: moneyFromDollars(3_000_000), quarterlyInterestRate: 0.02, facilityLimitCents: moneyFromDollars(8_000_000) },
      { id: 'nodeworks-infrastructure-debt', borrowerId: 'nodeworks', principalCents: moneyFromDollars(14_000_000), quarterlyInterestRate: 0.0225 },
    ],
    holding: {
      organizationId: 'meridian-group', leadershipCapacityPerQuarter: 4, institutionalAccess: 55,
      revolverLimitCents: moneyFromDollars(8_000_000), strategicRiskPolicy: 'balanced',
    },
    operatingCompanies: [{
      organizationId: 'nodeworks', issuedShares: 10_000_000,
      capacity: { installedITMW: 24, gridAllocationMW: 20, commissionedEquipmentMW: 23, operationalLimitMW: 22, reliability: 0.985 },
      deliveredWorkloadMW: 17,
      cashCosts: {
        operationsAndStaffingCents: moneyFromDollars(1_350_000),
        maintenanceCents: moneyFromDollars(620_000),
        networkAndConnectivityCents: moneyFromDollars(460_000),
        overheadComplianceInsuranceCents: moneyFromDollars(580_000),
      },
      contracts: [
        { id: 'asterion-contract-a', customerId: 'asterion-ai', providerId: 'nodeworks', workloadMW: 8, priceCentsPerMWQuarter: moneyFromDollars(510_000), flexibility: 'contracted' },
        { id: 'asterion-contract-b', customerId: 'asterion-ai', providerId: 'nodeworks', workloadMW: 5, priceCentsPerMWQuarter: moneyFromDollars(485_000), flexibility: 'contracted' },
        { id: 'flexible-workload', customerId: 'asterion-ai', providerId: 'nodeworks', workloadMW: 4, priceCentsPerMWQuarter: moneyFromDollars(415_000), flexibility: 'flexible' },
      ],
    }],
    regionalMarkets: [{
      id: 'north-region', name: 'North Regional Compute & Power Market', quarterHours: 2_160,
      availablePowerMW: 64, committedPowerMW: 58, referenceEnergyPriceCentsPerMWh: moneyFromDollars(72),
      immediateFirmPowerHeadroomMW: 2, equipmentDeliveryPoolMWEquivalentPerQuarter: 10,
    }],
    actors: [
      { organizationId: 'kestrel-compute', goals: ['expand-capacity', 'protect-anchor-contracts', 'preserve-liquidity'], hiddenMetrics: { effectiveCapacityMinMW: 22, effectiveCapacityMaxMW: 26, effectiveCapacityMW: 24, expansionPipelineQuarters: 0, deliveredWorkloadMinMW: 17, deliveredWorkloadMaxMW: 21, currentWorkloadMW: 19, reliabilityMin: 0.96, reliabilityMax: 0.98, reliability: 0.975, priceCentsPerMWQuarter: 40_500_000 } },
      { organizationId: 'asterion-ai', goals: ['secure-reliable-compute', 'diversify-suppliers', 'reduce-unit-cost'], hiddenMetrics: { demandMW: 28, nodeworksContractMW: 13, kestrelContractMW: 10, flexibleDemandMW: 5, nodeworksFlexibleMW: 4, kestrelFlexibleMW: 0, otherFlexibleMW: 1, otherProviderCapacityMW: 16, otherProviderReliability: 0.965, otherProviderPriceCentsPerMWQuarter: 43_000_000 } },
      { organizationId: 'solara-grid', goals: ['grid-stability', 'predictable-revenue', 'regulatory-compliance'], hiddenMetrics: { regionalHeadroomMW: 6 } },
      { organizationId: 'silicon-vein', goals: ['maximize-margin', 'prioritize-strategic-buyers'], hiddenMetrics: { deliveryLeadQuarters: 2, rushPremium: 0.25 } },
      { organizationId: 'regional-infrastructure-authority', goals: ['grid-resilience', 'competition', 'regional-jobs', 'investment'], hiddenMetrics: {} },
    ],
    projects: [],
    equipmentOrders: [],
    playerIntelligence: [
      { subjectId: 'kestrel-compute', metric: 'effectiveCapacityMW', min: 22, max: 26, knowledge: 'estimated', confidence: 0.65, observedQuarter: 1, source: 'market analyst consensus' },
      { subjectId: 'kestrel-compute', metric: 'deliveredWorkloadMW', min: 17, max: 21, knowledge: 'estimated', confidence: 0.7, observedQuarter: 1, source: 'customer and grid reports' },
      { subjectId: 'kestrel-compute', metric: 'reliability', min: 0.96, max: 0.98, knowledge: 'estimated', confidence: 0.55, observedQuarter: 1, source: 'industry reliability estimate' },
      { subjectId: 'asterion-ai', metric: 'computeDemandMW', min: 28, max: 28, knowledge: 'reported', confidence: 0.8, observedQuarter: 1, source: 'Asterion procurement brief' },
    ],
  };
}
