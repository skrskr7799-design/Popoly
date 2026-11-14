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
      { id: 'northstar-commercial-bank', name: 'Northstar Commercial Bank', kind: 'lender', cashCents: moneyFromDollars(25_000_000), debtCents: moneyFromDollars(0), reputation: 78 },
      { id: 'frontier-development-bank', name: 'Frontier Development Bank', kind: 'lender', cashCents: moneyFromDollars(18_000_000), debtCents: moneyFromDollars(0), reputation: 71 },
    ],
    ownership: [
      { ownerId: 'meridian-group', companyId: 'nodeworks', shares: 7_200_000, votingShares: 7_200_000 },
      { ownerId: 'founders-employees', companyId: 'nodeworks', shares: 1_800_000, votingShares: 1_800_000 },
      { ownerId: 'regional-infrastructure-fund', companyId: 'nodeworks', shares: 1_000_000, votingShares: 1_000_000 },
    ],
    assets: [
      { id: 'nodeworks-compute-fleet', ownerId: 'nodeworks', assetClass: 'compute-equipment',
        bookValueCents: moneyFromDollars(8_500_000), realizableValueCents: moneyFromDollars(5_600_000),
        securedDebtId: 'nodeworks-infrastructure-debt' },
      { id: 'nodeworks-power-systems', ownerId: 'nodeworks', assetClass: 'power-infrastructure',
        bookValueCents: moneyFromDollars(3_600_000), realizableValueCents: moneyFromDollars(2_200_000),
        securedDebtId: 'nodeworks-infrastructure-debt' },
      { id: 'nodeworks-network-core', ownerId: 'nodeworks', assetClass: 'network-infrastructure',
        bookValueCents: moneyFromDollars(1_700_000), realizableValueCents: moneyFromDollars(850_000) },
      { id: 'nodeworks-facility-interest', ownerId: 'nodeworks', assetClass: 'facility',
        bookValueCents: moneyFromDollars(1_400_000), realizableValueCents: moneyFromDollars(650_000) },
    ],
    debts: [
      { id: 'meridian-revolver', borrowerId: 'meridian-group', lenderId: 'northstar-commercial-bank', principalCents: moneyFromDollars(3_000_000), quarterlyInterestRate: 0.02, facilityLimitCents: moneyFromDollars(8_000_000) },
      { id: 'nodeworks-infrastructure-debt', borrowerId: 'nodeworks', lenderId: 'frontier-development-bank', principalCents: moneyFromDollars(14_000_000), quarterlyInterestRate: 0.0225 },
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
        { id: 'asterion-contract-a', customerId: 'asterion-ai', providerId: 'nodeworks', workloadMW: 8, priceCentsPerMWQuarter: moneyFromDollars(510_000), flexibility: 'contracted', termEndQuarter: 4, renewalNoticeQuarters: 2, minimumWorkloadMW: 7.5, slaTargetReliability: 0.98, slaServiceCreditBps: 500 },
        { id: 'asterion-contract-b', customerId: 'asterion-ai', providerId: 'nodeworks', workloadMW: 5, priceCentsPerMWQuarter: moneyFromDollars(485_000), flexibility: 'contracted', termEndQuarter: 5, renewalNoticeQuarters: 2, minimumWorkloadMW: 4, slaTargetReliability: 0.98, slaServiceCreditBps: 500 },
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
      { organizationId: 'asterion-ai', goals: ['secure-reliable-compute', 'diversify-suppliers', 'reduce-unit-cost'], hiddenMetrics: { demandMW: 28, nodeworksContractMW: 13, kestrelContractMW: 10, flexibleDemandMW: 5, nodeworksFlexibleMW: 4, kestrelFlexibleMW: 0, otherFlexibleMW: 1, otherProviderCapacityMW: 16, otherProviderReliability: 0.965, otherProviderPriceCentsPerMWQuarter: 43_000_000, maxFlexiblePriceCentsPerMWQuarter: 44_000_000, baseMaxFlexiblePriceCentsPerMWQuarter: 44_000_000, relationshipScore: 65, customerSatisfaction: 65, slaBreachStreak: 0, 'renewalMaxPrice:asterion-contract-a': 53_500_000, 'renewalMaxPrice:asterion-contract-b': 51_000_000, 'baseRenewalMaxPrice:asterion-contract-a': 53_500_000, 'baseRenewalMaxPrice:asterion-contract-b': 51_000_000, 'renewalMinVolume:asterion-contract-a': 7.5, 'renewalMinVolume:asterion-contract-b': 4, 'baseRenewalMinVolume:asterion-contract-a': 7.5, 'baseRenewalMinVolume:asterion-contract-b': 4 } },
      { organizationId: 'solara-grid', goals: ['grid-stability', 'predictable-revenue', 'regulatory-compliance'], hiddenMetrics: { regionalHeadroomMW: 6 } },
      { organizationId: 'silicon-vein', goals: ['maximize-margin', 'prioritize-strategic-buyers'], hiddenMetrics: { deliveryLeadQuarters: 2, rushPremium: 0.25 } },
      { organizationId: 'regional-infrastructure-authority', goals: ['grid-resilience', 'competition', 'regional-jobs', 'investment'], hiddenMetrics: {} },
    ],
    projects: [],
    equipmentOrders: [],
    lenders: [
      { organizationId: 'northstar-commercial-bank', availableCapacityCents: moneyFromDollars(12_000_000), riskAppetite: 'conservative', baseQuarterlyInterestRate: 0.018, minimumCreditScore: 620, maxLoanToAnnualCashFlow: 2.2 },
      { organizationId: 'frontier-development-bank', availableCapacityCents: moneyFromDollars(9_000_000), riskAppetite: 'growth', baseQuarterlyInterestRate: 0.02, minimumCreditScore: 500, maxLoanToAnnualCashFlow: 2.8 },
    ],
    loanOffers: [
      { id: 'northstar-nodeworks-q1', lenderId: 'northstar-commercial-bank', borrowerId: 'nodeworks',
        principalCents: moneyFromDollars(2_000_000), quarterlyInterestRate: 0.028,
        maturityQuarter: 9, expiresAfterQuarter: 2, collateralDescription: 'Equipment and receivables', covenantTerms: { minimumDebtServiceCoverage: 1.3, maximumDebtToAnnualCashFlow: 3, restrictAdditionalBorrowing: true, graceQuarters: 1, breachRatePremium: 0.004 }, creditScore: 686, creditRating: 'BBB', status: 'available' },
      { id: 'frontier-meridian-q1', lenderId: 'frontier-development-bank', borrowerId: 'meridian-group',
        principalCents: moneyFromDollars(3_000_000), quarterlyInterestRate: 0.032,
        maturityQuarter: 9, expiresAfterQuarter: 2, collateralDescription: 'Holding-company assets; covenant package applies', covenantTerms: { minimumDebtServiceCoverage: 1.05, maximumDebtToAnnualCashFlow: 4.5, restrictAdditionalBorrowing: true, graceQuarters: 2, breachRatePremium: 0.004 }, creditScore: 528, creditRating: 'B', status: 'available' },
    ],
    playerIntelligence: [
      { subjectId: 'kestrel-compute', metric: 'effectiveCapacityMW', min: 22, max: 26, knowledge: 'estimated', confidence: 0.65, observedQuarter: 1, source: 'market analyst consensus' },
      { subjectId: 'kestrel-compute', metric: 'deliveredWorkloadMW', min: 17, max: 21, knowledge: 'estimated', confidence: 0.7, observedQuarter: 1, source: 'customer and grid reports' },
      { subjectId: 'kestrel-compute', metric: 'reliability', min: 0.96, max: 0.98, knowledge: 'estimated', confidence: 0.55, observedQuarter: 1, source: 'industry reliability estimate' },
      { subjectId: 'asterion-ai', metric: 'computeDemandMW', min: 28, max: 28, knowledge: 'reported', confidence: 0.8, observedQuarter: 1, source: 'Asterion procurement brief' },
    ],
  };
}
