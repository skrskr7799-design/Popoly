import type { CompanySecret } from '../entities/types';

/** Expanded secret pool — personal, scandal, financial, tech */
export const SECRET_POOL: Omit<CompanySecret, 'id' | 'discoveredBy' | 'leaked'>[] = [
  // Personal
  {
    type: 'personal',
    severity: 9,
    description:
      'CEO has been having a long-term affair with an intelligence officer employed by a direct rival.',
  },
  {
    type: 'personal',
    severity: 7,
    description:
      'Founder regularly diverts corporate jets and security details for private parties and family travel.',
  },
  {
    type: 'personal',
    severity: 8,
    description:
      'CTO has an undisclosed financial relationship with a major supplier that wins most hardware RFPs.',
  },
  {
    type: 'personal',
    severity: 6,
    description:
      'Board chair quietly lobbied regulators while holding personal options that would spike on favorable rulings.',
  },
  {
    type: 'personal',
    severity: 8,
    description:
      'Key executive is under sealed investigation for past securities violations in another jurisdiction.',
  },

  // Scandal
  {
    type: 'scandal',
    severity: 10,
    description:
      'Internal memos show deliberate suppression of safety research that would have delayed a flagship launch.',
  },
  {
    type: 'scandal',
    severity: 9,
    description:
      'Executives knew about a major user-data exposure for months and coordinated a delayed disclosure strategy.',
  },
  {
    type: 'scandal',
    severity: 8,
    description:
      'Evidence of coordinated review bombing, fake accounts, and manipulated store rankings for core products.',
  },
  {
    type: 'scandal',
    severity: 7,
    description:
      'Whistleblower file alleges systematic underpayment and visa pressure on foreign research staff.',
  },
  {
    type: 'scandal',
    severity: 9,
    description:
      'Company ran covert influence campaigns targeting journalists who published critical coverage.',
  },
  {
    type: 'scandal',
    severity: 8,
    description:
      'Security team was ordered to soft-pedal an insider threat case involving a senior product manager.',
  },

  // Financial
  {
    type: 'financial',
    severity: 8,
    description:
      'Aggressive revenue recognition has inflated reported cash flow for at least three consecutive quarters.',
  },
  {
    type: 'financial',
    severity: 7,
    description:
      'Significant related-party transactions flow through entities ultimately controlled by board members.',
  },
  {
    type: 'financial',
    severity: 9,
    description:
      'Off-balance-sheet vehicles were used to park underperforming assets ahead of a funding round.',
  },
  {
    type: 'financial',
    severity: 6,
    description:
      'Customer concentration is far higher than disclosed; loss of two accounts would crater guidance.',
  },
  {
    type: 'financial',
    severity: 7,
    description:
      'Internal models show burn rate inconsistent with public runway claims under realistic hiring plans.',
  },

  // Tech
  {
    type: 'tech',
    severity: 6,
    description:
      'Core model training pipeline has a critical reproducibility issue that senior staff have papered over.',
  },
  {
    type: 'tech',
    severity: 7,
    description:
      'Key patent applications are narrower and easier to design around than public messaging suggests.',
  },
  {
    type: 'tech',
    severity: 8,
    description:
      'Production inference stack still depends on a single external provider with no viable failover.',
  },
  {
    type: 'tech',
    severity: 5,
    description:
      'Benchmark numbers used in marketing were run on non-representative hardware and cherry-picked seeds.',
  },
  {
    type: 'tech',
    severity: 7,
    description:
      'A critical open-source dependency is unmaintained; security patches have been skipped for months.',
  },

  // Other
  {
    type: 'other',
    severity: 7,
    description:
      'A senior researcher leading a flagship project is in advanced talks with a direct competitor.',
  },
  {
    type: 'other',
    severity: 6,
    description:
      'Major enterprise contract renewals are at risk after repeated SLA misses that were never escalated.',
  },
  {
    type: 'other',
    severity: 8,
    description:
      'Government customer is preparing to claw back funding over missed milestone documentation.',
  },
];

export function createRandomSecrets(count: number = 1): CompanySecret[] {
  const shuffled = [...SECRET_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((s, i) => ({
    ...s,
    id: `secret-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    discoveredBy: [],
    leaked: false,
  }));
}
