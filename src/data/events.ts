import type { Sector } from '../entities/types';

export type EventTarget = 'global' | 'sector' | 'company' | 'player';

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  target: EventTarget;
  sector?: Sector;
  weight: number; // relative chance
  // Effects are applied by the engine
  effects: {
    sharePriceMult?: number;       // e.g. 1.15 = +15%
    cashFlowMult?: number;
    reputationDelta?: number;      // for companies or players
    securityDelta?: number;
    playerCashDelta?: number;      // flat or later %
    creditRatingDelta?: number;
  };
}

export const GAME_EVENTS: GameEvent[] = [
  // Global positive
  {
    id: 'ai-boom',
    title: 'AI Investment Frenzy',
    description: 'Massive capital floods into AI and compute. Valuations surge.',
    target: 'sector',
    sector: 'ai_compute',
    weight: 8,
    effects: { sharePriceMult: 1.18, cashFlowMult: 1.1 },
  },
  {
    id: 'green-wave',
    title: 'Green Energy Mandate',
    description: 'New regulations and subsidies boost clean energy companies.',
    target: 'sector',
    sector: 'energy',
    weight: 7,
    effects: { sharePriceMult: 1.14, cashFlowMult: 1.12, reputationDelta: 5 },
  },
  {
    id: 'space-race',
    title: 'Orbital Infrastructure Race',
    description: 'Governments and corps pour money into space logistics.',
    target: 'sector',
    sector: 'space',
    weight: 6,
    effects: { sharePriceMult: 1.16, cashFlowMult: 1.08 },
  },

  // Global negative / mixed
  {
    id: 'antitrust',
    title: 'Antitrust Crackdown',
    description: 'Regulators open major investigations into platform giants.',
    target: 'sector',
    sector: 'platform',
    weight: 7,
    effects: { sharePriceMult: 0.88, reputationDelta: -8, securityDelta: 1 },
  },
  {
    id: 'data-scandal',
    title: 'Massive Data Breach Wave',
    description: 'Several high-profile leaks shake public trust in data companies.',
    target: 'sector',
    sector: 'data',
    weight: 7,
    effects: { sharePriceMult: 0.85, reputationDelta: -12, securityDelta: -1 },
  },
  {
    id: 'chip-shortage',
    title: 'Advanced Chip Shortage',
    description: 'Supply constraints hit hardware and AI accelerator makers.',
    target: 'sector',
    sector: 'hardware',
    weight: 6,
    effects: { sharePriceMult: 0.9, cashFlowMult: 0.85 },
  },
  {
    id: 'biotech-setback',
    title: 'Clinical Trial Failures',
    description: 'A wave of late-stage trial failures cools biotech enthusiasm.',
    target: 'sector',
    sector: 'biotech',
    weight: 5,
    effects: { sharePriceMult: 0.87, cashFlowMult: 0.9, reputationDelta: -5 },
  },

  // Broader market
  {
    id: 'liquidity-crunch',
    title: 'Liquidity Crunch',
    description: 'Credit markets tighten. Interest rates feel higher and cash is king.',
    target: 'global',
    weight: 5,
    effects: { sharePriceMult: 0.93, creditRatingDelta: -3 },
  },
  {
    id: 'risk-on',
    title: 'Risk-On Sentiment',
    description: 'Markets turn optimistic. Almost everything grinds higher.',
    target: 'global',
    weight: 6,
    effects: { sharePriceMult: 1.08 },
  },
  {
    id: 'talent-war',
    title: 'Talent War Intensifies',
    description: 'Top engineers and researchers command extreme premiums. Costs rise.',
    target: 'global',
    weight: 5,
    effects: { cashFlowMult: 0.92 },
  },
  {
    id: 'breakthrough',
    title: 'Foundational Tech Breakthrough',
    description: 'A major scientific leap lifts infrastructure and compute names.',
    target: 'global',
    weight: 4,
    effects: { sharePriceMult: 1.1, cashFlowMult: 1.06 },
  },
];

export function pickWeightedEvent(events: GameEvent[]): GameEvent {
  const total = events.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (const e of events) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return events[events.length - 1];
}
