import type { Sector } from '../entities/types';

export interface SectorAbility {
  sector: Sector;
  name: string;
  summary: string;
  /** Extra score when you control a company in this sector */
  controlScoreBonus: number;
  /** Multiplier on dividends from this sector when you hold shares */
  dividendMult: number;
  /** Additive mod to espionage success when targeting this sector */
  spyTargetMod: number;
  /** If you control this sector, slight personal intel edge (additive to ops) */
  controllerSpyBonus: number;
}

export const SECTOR_ABILITIES: Record<Sector, SectorAbility> = {
  platform: {
    sector: 'platform',
    name: 'Network Effects',
    summary: 'Control yields influence. Strong score bonus; soft spy resistance.',
    controlScoreBonus: 1_200_000,
    dividendMult: 1.05,
    spyTargetMod: -0.03,
    controllerSpyBonus: 0.01,
  },
  ai_compute: {
    sector: 'ai_compute',
    name: 'Model Moat',
    summary: 'High cash engines. Strong dividends; valuable to control.',
    controlScoreBonus: 1_500_000,
    dividendMult: 1.12,
    spyTargetMod: 0,
    controllerSpyBonus: 0.02,
  },
  infrastructure: {
    sector: 'infrastructure',
    name: 'Pick-and-Shovel',
    summary: 'Steady cash. Reliable dividends when held.',
    controlScoreBonus: 900_000,
    dividendMult: 1.1,
    spyTargetMod: -0.02,
    controllerSpyBonus: 0,
  },
  biotech: {
    sector: 'biotech',
    name: 'Binary Outcomes',
    summary: 'Volatile science. Weaker base dividends, high control prestige.',
    controlScoreBonus: 1_400_000,
    dividendMult: 0.9,
    spyTargetMod: 0.02,
    controllerSpyBonus: 0,
  },
  energy: {
    sector: 'energy',
    name: 'Grid Anchor',
    summary: 'Stable cash and mild dividend boost.',
    controlScoreBonus: 1_000_000,
    dividendMult: 1.08,
    spyTargetMod: -0.01,
    controllerSpyBonus: 0,
  },
  space: {
    sector: 'space',
    name: 'Orbital Optionality',
    summary: 'Prestige control. Lower dividends, high score if dominated.',
    controlScoreBonus: 1_600_000,
    dividendMult: 0.85,
    spyTargetMod: 0.01,
    controllerSpyBonus: 0.01,
  },
  hardware: {
    sector: 'hardware',
    name: 'Silicon Leverage',
    summary: 'Solid cash + synergy with AI compute when both controlled.',
    controlScoreBonus: 1_100_000,
    dividendMult: 1.06,
    spyTargetMod: -0.01,
    controllerSpyBonus: 0,
  },
  data: {
    sector: 'data',
    name: 'Surveillance Edge',
    summary: 'Controller gains spy edge; sector is harder to infiltrate.',
    controlScoreBonus: 1_000_000,
    dividendMult: 1.04,
    spyTargetMod: -0.04,
    controllerSpyBonus: 0.04,
  },
};

/** Hybrid map adjacency: controlling linked sectors adds synergy score */
export const SECTOR_ADJACENCY: Record<Sector, Sector[]> = {
  platform: ['data', 'ai_compute'],
  data: ['platform', 'ai_compute', 'infrastructure'],
  ai_compute: ['platform', 'data', 'hardware'],
  hardware: ['ai_compute', 'infrastructure', 'energy'],
  infrastructure: ['data', 'hardware', 'energy'],
  energy: ['infrastructure', 'hardware', 'space'],
  space: ['energy', 'biotech'],
  biotech: ['space', 'data'],
};

export const SECTOR_LABELS: Record<Sector, string> = {
  platform: 'Platform',
  ai_compute: 'AI & Compute',
  infrastructure: 'Infrastructure',
  biotech: 'Biotech',
  energy: 'Energy',
  space: 'Space',
  hardware: 'Hardware',
  data: 'Data',
};

export function countControlledSectors(
  controlledCompanySectors: Sector[]
): Set<Sector> {
  return new Set(controlledCompanySectors);
}

/** Synergy: +0.8M score per controlled adjacency edge (undirected counted once) */
export function adjacencySynergyScore(controlledSectors: Set<Sector>): number {
  let edges = 0;
  const seen = new Set<string>();
  for (const s of controlledSectors) {
    for (const n of SECTOR_ADJACENCY[s]) {
      if (!controlledSectors.has(n)) continue;
      const key = [s, n].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      edges++;
    }
  }
  return edges * 800_000;
}
