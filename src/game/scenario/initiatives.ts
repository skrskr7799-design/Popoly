import { moneyFromDollars } from '../domain/money';

export type InitiativeEffect =
  | { type: 'capacity-expansion'; installedITMW: number; operationalLimitMW: number }
  | { type: 'equipment-reservation'; commissionedEquipmentMW: number }
  | { type: 'firm-power'; gridAllocationMW: number }
  | { type: 'resilience'; reliabilityGain: number }
  | { type: 'market-study'; confidenceGain: number };

export interface StrategicInitiativeDefinition {
  id: string;
  name: string;
  description: string;
  leadershipCost: number;
  upfrontCostCents: number;
  durationQuarters: number;
  effect: InitiativeEffect;
}

/** Scenario balance data; command handlers contain no initiative prices or effects. */
export const COMPUTE_BOTTLENECK_INITIATIVES: StrategicInitiativeDefinition[] = [
  {
    id: 'capacity-expansion-phase-i',
    name: 'Capacity expansion — Phase I',
    description: 'Expand the physical footprint and operational envelope by 6 MW.',
    leadershipCost: 2,
    upfrontCostCents: moneyFromDollars(2_000_000),
    durationQuarters: 3,
    effect: { type: 'capacity-expansion', installedITMW: 6, operationalLimitMW: 6 },
  },
  {
    id: 'secure-equipment-allocation',
    name: 'Secure equipment allocation',
    description: 'Reserve a 6 MW-equivalent equipment delivery window.',
    leadershipCost: 1,
    upfrontCostCents: moneyFromDollars(1_200_000),
    durationQuarters: 2,
    effect: { type: 'equipment-reservation', commissionedEquipmentMW: 6 },
  },
  {
    id: 'negotiate-firm-power',
    name: 'Negotiate additional firm power',
    description: 'Reserve the region’s currently available 2 MW of firm grid capacity.',
    leadershipCost: 2,
    upfrontCostCents: moneyFromDollars(500_000),
    durationQuarters: 3,
    effect: { type: 'firm-power', gridAllocationMW: 2 },
  },
  {
    id: 'resilience-security-program',
    name: 'Resilience and security program',
    description: 'Improve operational resilience and service reliability.',
    leadershipCost: 1,
    upfrontCostCents: moneyFromDollars(900_000),
    durationQuarters: 2,
    effect: { type: 'resilience', reliabilityGain: 0.005 },
  },
  {
    id: 'commission-market-study',
    name: 'Commission competitor market study',
    description: 'Refresh external estimates and improve confidence in rival intelligence.',
    leadershipCost: 1,
    upfrontCostCents: moneyFromDollars(250_000),
    durationQuarters: 1,
    effect: { type: 'market-study', confidenceGain: 0.15 },
  },
];

export function getInitiativeDefinition(id: string): StrategicInitiativeDefinition | undefined {
  return COMPUTE_BOTTLENECK_INITIATIVES.find((initiative) => initiative.id === id);
}
