import type { CompanySecret } from '../entities/types';

/** Pre-defined secrets that can be attached to companies at game start or later */
export const SECRET_POOL: Omit<CompanySecret, 'id' | 'discoveredBy' | 'leaked'>[] = [
  {
    type: 'personal',
    severity: 8,
    description: 'CEO has been having an affair with a rival company\'s intelligence officer.',
  },
  {
    type: 'personal',
    severity: 7,
    description: 'Founder regularly uses company resources for private luxury travel and parties.',
  },
  {
    type: 'scandal',
    severity: 9,
    description: 'Internal documents show deliberate suppression of safety research results.',
  },
  {
    type: 'scandal',
    severity: 8,
    description: 'Executives knew about major data exposure for months and delayed disclosure.',
  },
  {
    type: 'financial',
    severity: 7,
    description: 'Aggressive accounting has inflated reported cash flow for the last three quarters.',
  },
  {
    type: 'financial',
    severity: 6,
    description: 'Significant related-party transactions with entities controlled by the board.',
  },
  {
    type: 'tech',
    severity: 5,
    description: 'Core model training pipeline has a critical reproducibility issue.',
  },
  {
    type: 'tech',
    severity: 6,
    description: 'Key patent applications are weaker than publicly claimed.',
  },
  {
    type: 'other',
    severity: 7,
    description: 'Senior researcher is quietly interviewing with a direct competitor.',
  },
  {
    type: 'scandal',
    severity: 9,
    description: 'Evidence of coordinated review bombing and manipulated app-store rankings.',
  },
];

export function createRandomSecrets(count: number = 1): CompanySecret[] {
  const shuffled = [...SECRET_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((s, i) => ({
    ...s,
    id: `secret-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    discoveredBy: [],
    leaked: false,
  }));
}
