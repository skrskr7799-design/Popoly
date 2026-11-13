/**
 * Framework-independent domain model for Popoly: Tech Dominion.
 * Money is integer USD cents; physical values carry explicit units in field names.
 */
export type EntityId = string;
export type MoneyCents = number & { readonly __moneyCents: unique symbol };
export type OrganizationKind = 'holding' | 'operating_company' | 'supplier' | 'customer' | 'competitor' | 'institution';
export type KnowledgeClass = 'known' | 'reported' | 'estimated' | 'unknown';

export interface Organization {
  id: EntityId;
  name: string;
  kind: OrganizationKind;
  cashCents: MoneyCents;
  debtCents: MoneyCents;
  reputation: number;
}
export interface OwnershipStake { ownerId: EntityId; companyId: EntityId; shares: number; votingShares: number; }
export interface DebtInstrument {
  id: EntityId; borrowerId: EntityId; principalCents: MoneyCents; quarterlyInterestRate: number; facilityLimitCents?: MoneyCents;
}
export interface ServiceContract {
  id: EntityId; customerId: EntityId; providerId: EntityId; workloadMW: number;
  priceCentsPerMWQuarter: MoneyCents; flexibility: 'contracted' | 'flexible';
}
export interface InfrastructureCapacity {
  installedITMW: number; gridAllocationMW: number; commissionedEquipmentMW: number;
  operationalLimitMW: number; reliability: number;
}
export interface OperatingCostProfile {
  operationsAndStaffingCents: MoneyCents;
  maintenanceCents: MoneyCents;
  networkAndConnectivityCents: MoneyCents;
  overheadComplianceInsuranceCents: MoneyCents;
}
export interface OperatingCompanyState {
  organizationId: EntityId; issuedShares: number; capacity: InfrastructureCapacity;
  deliveredWorkloadMW: number; cashCosts: OperatingCostProfile; contracts: ServiceContract[];
}
export interface HoldingState {
  organizationId: EntityId; leadershipCapacityPerQuarter: number; institutionalAccess: number;
  revolverLimitCents: MoneyCents; strategicRiskPolicy: 'balanced' | 'growth' | 'conservative';
}
export interface RegionalMarketState {
  id: EntityId; name: string; quarterHours: number; availablePowerMW: number; committedPowerMW: number;
  referenceEnergyPriceCentsPerMWh: MoneyCents; immediateFirmPowerHeadroomMW: number;
  equipmentDeliveryPoolMWEquivalentPerQuarter: number;
}
export interface ActorState {
  organizationId: EntityId; goals: string[];
  /** True operational values; never expose these directly to player UI. */
  hiddenMetrics: Record<string, number>;
}
export interface IntelligenceEstimate {
  subjectId: EntityId; metric: string; min: number; max: number; knowledge: KnowledgeClass;
  confidence: number; observedQuarter: number; source: string;
}
export interface StrategicProjectState {
  id: string;
  initiativeId: string;
  startedQuarter: number;
  remainingQuarters: number;
  leadershipCost: number;
  initialCostCents: MoneyCents;
}
export interface GameState {
  schemaVersion: 1; scenarioId: string; scenarioVersion: string; seed: number; quarter: number;
  organizations: Organization[]; ownership: OwnershipStake[]; debts: DebtInstrument[];
  holding: HoldingState; operatingCompanies: OperatingCompanyState[];
  regionalMarkets: RegionalMarketState[]; actors: ActorState[]; playerIntelligence: IntelligenceEstimate[]; projects: StrategicProjectState[];
}
export interface ValidationIssue { code: string; message: string; entityId?: EntityId; }
