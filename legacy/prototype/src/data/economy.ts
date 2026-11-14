import type { EconomyPhase } from '../entities/types';

export interface PhaseConfig {
  id: EconomyPhase;
  label: string;
  /** Multiplier applied to base interest rates */
  interestMult: number;
  /** Soft bias on share price drift from buys/sells */
  priceImpactMult: number;
  /** Dividend effectiveness */
  dividendMult: number;
  /** Espionage success chance modifier (additive) */
  espionageChanceMod: number;
  /** How many rounds this phase tends to last before transition check */
  minRounds: number;
  description: string;
}

export const PHASE_CONFIG: Record<EconomyPhase, PhaseConfig> = {
  innovation_boom: {
    id: 'innovation_boom',
    label: 'Innovation Boom',
    interestMult: 0.9,
    priceImpactMult: 1.05,
    dividendMult: 1.0,
    espionageChanceMod: 0.02,
    minRounds: 2,
    description: 'New tech cycles attract capital. Credit is relatively cheap.',
  },
  hypergrowth: {
    id: 'hypergrowth',
    label: 'Hypergrowth',
    interestMult: 1.0,
    priceImpactMult: 1.15,
    dividendMult: 1.05,
    espionageChanceMod: 0,
    minRounds: 2,
    description: 'Growth narratives dominate. Prices move hard on flow.',
  },
  bubble: {
    id: 'bubble',
    label: 'Bubble',
    interestMult: 1.15,
    priceImpactMult: 1.25,
    dividendMult: 0.95,
    espionageChanceMod: -0.02,
    minRounds: 1,
    description: 'Valuations detach from cash flows. Fragility rises.',
  },
  correction: {
    id: 'correction',
    label: 'Correction',
    interestMult: 1.35,
    priceImpactMult: 0.9,
    dividendMult: 0.85,
    espionageChanceMod: 0.03,
    minRounds: 2,
    description: 'Credit tightens. Scandals and misses are punished.',
  },
  recovery: {
    id: 'recovery',
    label: 'Recovery',
    interestMult: 1.1,
    priceImpactMult: 1.0,
    dividendMult: 1.0,
    espionageChanceMod: 0.01,
    minRounds: 2,
    description: 'Stabilization. Selective capital returns to quality.',
  },
};

const PHASE_ORDER: EconomyPhase[] = [
  'innovation_boom',
  'hypergrowth',
  'bubble',
  'correction',
  'recovery',
];

export function nextPhase(current: EconomyPhase): EconomyPhase {
  const idx = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
}

export function getPhaseConfig(phase: EconomyPhase): PhaseConfig {
  return PHASE_CONFIG[phase];
}
