import type { OperatingCostProfile, TurnaroundActionId } from '../domain/types';

export interface TurnaroundActionDefinition {
  id: TurnaroundActionId;
  name: string;
  description: string;
  tradeoff: string;
  costReductionBps: Partial<Record<keyof OperatingCostProfile, number>>;
  reliabilityPenalty?: number;
  reputationPenalty?: number;
  operationalLimitReductionMW?: number;
}

/** Scenario-owned balance values; the engine applies only these reviewed effects. */
export const COMPUTE_BOTTLENECK_TURNAROUND_ACTIONS: TurnaroundActionDefinition[] = [
  {
    id: 'workforce-reset',
    name: 'Workforce & shift redesign',
    description: 'Consolidate shifts, remove duplicated coverage and renegotiate staffing schedules.',
    tradeoff: 'Lower staffing flexibility and a small reputation hit.',
    costReductionBps: { operationsAndStaffingCents: 3_000 },
    reliabilityPenalty: 0.001,
    reputationPenalty: 1,
  },
  {
    id: 'maintenance-deferral',
    name: 'Maintenance deferral',
    description: 'Defer non-critical maintenance and move to a minimum viable service schedule.',
    tradeoff: 'Reliability falls; repeated outages can damage contract performance.',
    costReductionBps: { maintenanceCents: 4_000 },
    reliabilityPenalty: 0.002,
  },
  {
    id: 'vendor-renegotiation',
    name: 'Network & vendor renegotiation',
    description: 'Consolidate connectivity providers and renegotiate network service tiers.',
    tradeoff: 'Less supplier redundancy and reduced room for burst capacity.',
    costReductionBps: { networkAndConnectivityCents: 3_000 },
    reliabilityPenalty: 0.001,
  },
  {
    id: 'facility-consolidation',
    name: 'Facility consolidation',
    description: 'Close underused facility space and reduce recurring compliance and site overhead.',
    tradeoff: 'The operational envelope contracts and future expansion becomes harder.',
    costReductionBps: { overheadComplianceInsuranceCents: 2_500 },
    operationalLimitReductionMW: 1.5,
  },
];

export function getTurnaroundAction(id: string): TurnaroundActionDefinition | undefined {
  return COMPUTE_BOTTLENECK_TURNAROUND_ACTIONS.find((action) => action.id === id);
}
