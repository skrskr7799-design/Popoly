import { describe, expect, it } from 'vitest';
import { CampaignSession, GUIDED_CAMPAIGN_QUARTERS } from '../campaign/session';
import { validateGameState } from '../domain/invariants';

const strategies: Array<{ id: string; initiativesByQuarter: string[][] }> = [
  {
    id: 'scale-first',
    initiativesByQuarter: [
      ['capacity-expansion-phase-i', 'secure-equipment-allocation'],
      ['negotiate-firm-power'],
    ],
  },
  {
    id: 'resilience-first',
    initiativesByQuarter: [
      ['resilience-security-program', 'commission-market-study'],
      [],
    ],
  },
  {
    id: 'bottleneck-control',
    initiativesByQuarter: [
      ['secure-equipment-allocation', 'negotiate-firm-power'],
      ['commission-market-study'],
    ],
  },
];

describe('Compute Bottleneck vertical slice', () => {
  it('completes eight quarters under distinct strategic approaches and deterministic seeds', () => {
    for (const seed of [2035, 2042]) {
      const outcomes = new Map<string, { installedITMW: number; gridAllocationMW: number; reliability: number }>();
      for (const strategy of strategies) {
        const session = CampaignSession.start({
          seed,
          campaignId: `vertical-${seed}-${strategy.id}`,
          now: () => new Date('2035-01-01T00:00:00.000Z'),
        });

        for (let quarter = 0; quarter < GUIDED_CAMPAIGN_QUARTERS; quarter += 1) {
          const result = session.advance({
            launchInitiatives: strategy.initiativesByQuarter[quarter] ?? [],
          });
          if (!result.ok) {
            throw new Error(
              `Seed ${seed}, strategy ${strategy.id}, quarter ${quarter + 1} failed: ${result.issues.map((item) => item.message).join('; ')}`,
            );
          }
          expect(result.report.quarter).toBe(quarter + 1);
          expect(result.state.quarter).toBe(quarter + 2);
        }

        const finalState = session.state;
        expect(finalState.quarter).toBe(9);
        expect(session.completedQuarters).toBe(8);
        expect(session.stage).toBe('sandbox');
        expect(validateGameState(finalState)).toEqual([]);
        expect(finalState.organizations.every((organization) => organization.cashCents >= 0)).toBe(true);
        const nodeworks = finalState.operatingCompanies.find((company) => company.organizationId === 'nodeworks');
        if (!nodeworks) throw new Error('NodeWorks is missing from the final campaign state.');
        outcomes.set(strategy.id, {
          installedITMW: nodeworks.capacity.installedITMW,
          gridAllocationMW: nodeworks.capacity.gridAllocationMW,
          reliability: nodeworks.capacity.reliability,
        });
      }
      expect(outcomes.get('scale-first')?.installedITMW).toBeGreaterThan(24);
      expect(outcomes.get('bottleneck-control')?.gridAllocationMW).toBeGreaterThan(20);
      expect(outcomes.get('resilience-first')?.reliability).toBeGreaterThan(0.985);
    }
  });
});
