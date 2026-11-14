/**
 * Framework-independent domain model for Popoly: Tech Dominion.
 * Money is integer USD cents; physical values carry explicit units in field names.
 */
export type EntityId = string;
export type MoneyCents = number & { readonly __moneyCents: unique symbol };
export type OrganizationKind = 'holding' | 'operating_company' | 'supplier' | 'customer' | 'competitor' | 'institution' | 'lender';
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
export interface DebtCovenantTerms {
  minimumDebtServiceCoverage?: number;
  maximumDebtToAnnualCashFlow?: number;
  restrictAdditionalBorrowing?: boolean;
  graceQuarters?: number;
  breachRatePremium?: number;
}
export interface DebtInstrument {
  id: EntityId; borrowerId: EntityId; lenderId?: EntityId; collateralDescription?: string; principalCents: MoneyCents; quarterlyInterestRate: number; facilityLimitCents?: MoneyCents;
  covenantTerms?: DebtCovenantTerms;
  covenantStartQuarter?: number;
  covenantBreachStreak?: number;
  covenantStatus?: 'compliant' | 'grace' | 'breached';
  covenantPenaltyApplied?: boolean;
  /** Contractual principal amount due each quarter, in integer cents. */
  scheduledPrincipalCentsPerQuarter?: MoneyCents;
  /** Final maturity quarter; any remaining principal becomes due in full in this quarter. */
  maturityQuarter?: number;
  /** Principal already due but not paid; remains included in principalCents. */
  arrearsPrincipalCents?: MoneyCents;
  /** Contractual interest already accrued but not paid; never capitalized into principal. */
  arrearsInterestCents?: MoneyCents;
  /** Contract clause: this instrument may cross-default when another debt of the same legal borrower defaults. */
  crossDefaultClause?: boolean;
  /** Source instrument for a contractual cross-default; does not create arrears on this debt. */
  crossDefaultedByDebtId?: EntityId;
  /** Quarter in which the creditor delivered an acceleration notice. */
  accelerationNoticeQuarter?: number;
  /** First quarter in which the full outstanding principal is contractually due. */
  acceleratedAtQuarter?: number;
  /** Consecutive quarters with any unpaid contractual interest or principal service. */
  overdueQuarters?: number;
  paymentStatus?: 'current' | 'overdue' | 'defaulted' | 'settled';
}
export interface ServiceContract {
  id: EntityId; customerId: EntityId; providerId: EntityId; workloadMW: number;
  priceCentsPerMWQuarter: MoneyCents; flexibility: 'contracted' | 'flexible';
  /** Contract remains active through this quarter; omitted for rolling flexible supply. */
  termEndQuarter?: number;
  renewalNoticeQuarters?: number;
  minimumWorkloadMW?: number;
  /** Minimum service reliability required by this agreement (0..1). */
  slaTargetReliability?: number;
  /** Share of this contract's quarterly revenue credited when the SLA is breached, in basis points. */
  slaServiceCreditBps?: number;
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
export type TurnaroundActionId = 'workforce-reset' | 'maintenance-deferral' | 'vendor-renegotiation' | 'facility-consolidation';
export type OperatingPayableClass = 'energy' | 'payroll' | 'network-vendor' | 'tax-overhead';
export interface OperatingPayable {
  id: EntityId;
  entityId: EntityId;
  creditorClass: OperatingPayableClass;
  originalAmountCents: MoneyCents;
  outstandingAmountCents: MoneyCents;
  incurredQuarter: number;
  dueQuarter: number;
  /** Lower values are paid first; priority is scenario-defined, not player-editable. */
  priority: number;
}
export interface OperatingCompanyState {
  organizationId: EntityId; issuedShares: number; capacity: InfrastructureCapacity;
  deliveredWorkloadMW: number; cashCosts: OperatingCostProfile; contracts: ServiceContract[];
  /** One-time turnaround actions already implemented; prevents duplicate savings. */
  turnaroundActions?: TurnaroundActionId[];
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
export interface EquipmentOrderState {
  id: string;
  buyerId: EntityId;
  quantityMWEquivalent: number;
  placedQuarter: number;
  deliveryQuarter: number;
  status: 'reserved' | 'delivered' | 'cancelled';
}
export interface LenderState {
  organizationId: EntityId;
  /** Remaining lending capacity, separate from the lender's cash balance. */
  availableCapacityCents: MoneyCents;
  riskAppetite: 'conservative' | 'balanced' | 'growth';
  baseQuarterlyInterestRate: number;
  minimumCreditScore: number;
  maxLoanToAnnualCashFlow: number;
}
export interface LoanOfferState {
  id: EntityId;
  lenderId: EntityId;
  borrowerId: EntityId;
  principalCents: MoneyCents;
  quarterlyInterestRate: number;
  maturityQuarter: number;
  expiresAfterQuarter: number;
  collateralDescription?: string;
  covenantTerms?: DebtCovenantTerms;
  /** Whether the resulting instrument includes a cross-default clause. */
  crossDefaultClause?: boolean;
  creditScore: number;
  creditRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  status: 'available' | 'accepted' | 'expired' | 'withdrawn';
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
  regionalMarkets: RegionalMarketState[]; operatingPayables?: OperatingPayable[]; actors: ActorState[]; playerIntelligence: IntelligenceEstimate[]; projects: StrategicProjectState[]; equipmentOrders: EquipmentOrderState[]; lenders: LenderState[]; loanOffers: LoanOfferState[];
}
export interface ValidationIssue { code: string; message: string; entityId?: EntityId; }
