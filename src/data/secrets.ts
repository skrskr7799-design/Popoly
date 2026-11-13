import type { CompanySecret } from '../entities/types';

/** description field holds i18n key (secret_*) */
export const SECRET_POOL: Omit<CompanySecret, 'id' | 'discoveredBy' | 'leaked'>[] = [
  { type: 'personal', severity: 9, description: 'secret_ceo_rival_affair' },
  { type: 'personal', severity: 7, description: 'secret_founder_jets' },
  { type: 'personal', severity: 8, description: 'secret_cto_supplier' },
  { type: 'personal', severity: 6, description: 'secret_board_lobby' },
  { type: 'personal', severity: 8, description: 'secret_exec_investigation' },
  { type: 'scandal', severity: 10, description: 'secret_safety_suppress' },
  { type: 'scandal', severity: 9, description: 'secret_data_delay' },
  { type: 'scandal', severity: 8, description: 'secret_fake_reviews' },
  { type: 'scandal', severity: 7, description: 'secret_visa_pressure' },
  { type: 'scandal', severity: 9, description: 'secret_influence_press' },
  { type: 'scandal', severity: 8, description: 'secret_insider_softpedal' },
  { type: 'financial', severity: 8, description: 'secret_revenue_inflate' },
  { type: 'financial', severity: 7, description: 'secret_related_party' },
  { type: 'financial', severity: 9, description: 'secret_offbalance' },
  { type: 'financial', severity: 6, description: 'secret_customer_conc' },
  { type: 'financial', severity: 7, description: 'secret_burn_rate' },
  { type: 'tech', severity: 6, description: 'secret_repro_issue' },
  { type: 'tech', severity: 7, description: 'secret_weak_patents' },
  { type: 'tech', severity: 8, description: 'secret_single_provider' },
  { type: 'tech', severity: 5, description: 'secret_benchmark_cheat' },
  { type: 'tech', severity: 7, description: 'secret_unmaintained_dep' },
  { type: 'other', severity: 7, description: 'secret_researcher_exit' },
  { type: 'other', severity: 6, description: 'secret_sla_risk' },
  { type: 'other', severity: 8, description: 'secret_gov_clawback' },
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
