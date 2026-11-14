import type { Sector } from '../entities/types';

export type EventTarget = 'global' | 'sector';

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  target: EventTarget;
  sector?: Sector;
  weight: number;
  /** Prefer certain economy phases (empty = any) */
  preferredPhases?: string[];
  effects: {
    sharePriceMult?: number;
    cashFlowMult?: number;
    reputationDelta?: number;
    securityDelta?: number;
    creditRatingDelta?: number;
  };
}

export const GAME_EVENTS: GameEvent[] = [
  // Sector — positive
  {
    id: 'ai-boom',
    title: 'AI Investment Frenzy',
    description: 'Capital floods into foundation models and inference. AI names re-rate higher.',
    target: 'sector',
    sector: 'ai_compute',
    weight: 8,
    preferredPhases: ['innovation_boom', 'hypergrowth', 'bubble'],
    effects: { sharePriceMult: 1.16, cashFlowMult: 1.08 },
  },
  {
    id: 'green-wave',
    title: 'Green Energy Mandate',
    description: 'Subsidies and procurement rules lift clean energy and grid software.',
    target: 'sector',
    sector: 'energy',
    weight: 7,
    effects: { sharePriceMult: 1.13, cashFlowMult: 1.1, reputationDelta: 4 },
  },
  {
    id: 'space-race',
    title: 'Orbital Infrastructure Race',
    description: 'Governments and primes expand LEO and logistics budgets.',
    target: 'sector',
    sector: 'space',
    weight: 6,
    effects: { sharePriceMult: 1.14, cashFlowMult: 1.07 },
  },
  {
    id: 'cloud-expansion',
    title: 'Enterprise Cloud Wave',
    description: 'Large migrations accelerate. Infrastructure providers book multi-year deals.',
    target: 'sector',
    sector: 'infrastructure',
    weight: 6,
    effects: { sharePriceMult: 1.1, cashFlowMult: 1.09 },
  },
  {
    id: 'biotech-approval',
    title: 'Major Therapy Approval',
    description: 'A landmark approval lifts the whole biotech complex on sentiment.',
    target: 'sector',
    sector: 'biotech',
    weight: 5,
    preferredPhases: ['innovation_boom', 'hypergrowth'],
    effects: { sharePriceMult: 1.15, cashFlowMult: 1.06, reputationDelta: 5 },
  },
  {
    id: 'platform-engagement',
    title: 'Engagement Rebound',
    description: 'Time-spent metrics surprise to the upside across major platforms.',
    target: 'sector',
    sector: 'platform',
    weight: 5,
    effects: { sharePriceMult: 1.09, cashFlowMult: 1.07 },
  },

  // Sector — negative
  {
    id: 'antitrust',
    title: 'Antitrust Crackdown',
    description: 'Regulators open structural investigations into dominant platforms.',
    target: 'sector',
    sector: 'platform',
    weight: 7,
    preferredPhases: ['bubble', 'correction'],
    effects: { sharePriceMult: 0.88, reputationDelta: -8, securityDelta: 1 },
  },
  {
    id: 'data-scandal',
    title: 'Massive Data Breach Wave',
    description: 'A cluster of breaches destroys trust in data and surveillance businesses.',
    target: 'sector',
    sector: 'data',
    weight: 7,
    effects: { sharePriceMult: 0.86, reputationDelta: -11, securityDelta: -1 },
  },
  {
    id: 'chip-shortage',
    title: 'Advanced Chip Shortage',
    description: 'Process and packaging constraints hit hardware and accelerator roadmaps.',
    target: 'sector',
    sector: 'hardware',
    weight: 6,
    effects: { sharePriceMult: 0.9, cashFlowMult: 0.88 },
  },
  {
    id: 'biotech-setback',
    title: 'Clinical Trial Failures',
    description: 'A string of late-stage failures cools speculative biotech capital.',
    target: 'sector',
    sector: 'biotech',
    weight: 5,
    preferredPhases: ['bubble', 'correction'],
    effects: { sharePriceMult: 0.87, cashFlowMult: 0.9, reputationDelta: -5 },
  },
  {
    id: 'infra-outage',
    title: 'Cascade Outage',
    description: 'A multi-region failure triggers SLA credits and customer audits.',
    target: 'sector',
    sector: 'infrastructure',
    weight: 5,
    effects: { sharePriceMult: 0.91, cashFlowMult: 0.93, reputationDelta: -4 },
  },
  {
    id: 'space-failure',
    title: 'Launch Failure Cluster',
    description: 'Back-to-back anomalies freeze insurance markets and delay manifests.',
    target: 'sector',
    sector: 'space',
    weight: 4,
    effects: { sharePriceMult: 0.88, cashFlowMult: 0.9, reputationDelta: -6 },
  },

  // Global
  {
    id: 'liquidity-crunch',
    title: 'Liquidity Crunch',
    description: 'Credit spreads widen. Cash becomes scarce and expensive.',
    target: 'global',
    weight: 6,
    preferredPhases: ['correction', 'recovery'],
    effects: { sharePriceMult: 0.94, creditRatingDelta: -4 },
  },
  {
    id: 'risk-on',
    title: 'Risk-On Sentiment',
    description: 'Markets bid almost everything higher on soft data and easy narratives.',
    target: 'global',
    weight: 6,
    preferredPhases: ['hypergrowth', 'bubble'],
    effects: { sharePriceMult: 1.07 },
  },
  {
    id: 'talent-war',
    title: 'Talent War Intensifies',
    description: 'Comp for senior engineers and researchers jumps again. Margins compress.',
    target: 'global',
    weight: 5,
    effects: { cashFlowMult: 0.93 },
  },
  {
    id: 'breakthrough',
    title: 'Foundational Tech Breakthrough',
    description: 'A real scientific leap reprices infrastructure and compute optionality.',
    target: 'global',
    weight: 4,
    preferredPhases: ['innovation_boom', 'hypergrowth'],
    effects: { sharePriceMult: 1.09, cashFlowMult: 1.05 },
  },
  {
    id: 'regulatory-freeze',
    title: 'Regulatory Freeze',
    description: 'Uncertainty freezes dealmaking and slows product launches across the board.',
    target: 'global',
    weight: 5,
    preferredPhases: ['correction', 'bubble'],
    effects: { sharePriceMult: 0.95, cashFlowMult: 0.96 },
  },
  {
    id: 'capital-wave',
    title: 'Private Capital Wave',
    description: 'Dry powder deploys aggressively into late-stage tech.',
    target: 'global',
    weight: 5,
    preferredPhases: ['innovation_boom', 'hypergrowth', 'bubble'],
    effects: { sharePriceMult: 1.06, creditRatingDelta: 2 },
  },
];

export function pickWeightedEvent(
  events: GameEvent[],
  currentPhase?: string
): GameEvent {
  const adjusted = events.map((e) => {
    if (!currentPhase || !e.preferredPhases?.length) return e;
    const boost = e.preferredPhases.includes(currentPhase) ? 1.6 : 0.75;
    return { ...e, weight: e.weight * boost };
  });
  const total = adjusted.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (const e of adjusted) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return adjusted[adjusted.length - 1];
}
