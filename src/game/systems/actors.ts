import { moneyFromCents } from '../domain/money';
import type { ActorState, GameState, RegionalMarketState } from '../domain/types';
import { createRandomState, nextRandom } from '../engine/random';

export interface ActorAction {
  actorId: string;
  kind: 'demand-growth' | 'capacity-expansion-started' | 'capacity-expansion-completed' | 'capacity-expansion-delayed' | 'energy-price-adjustment' | 'regulatory-review';
  summary: string;
}

function actorRandom(state: GameState, actorId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < actorId.length; index += 1) {
    hash ^= actorId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const seed = (state.seed ^ Math.imul(state.quarter, 0x9e3779b1) ^ hash) >>> 0;
  return nextRandom(createRandomState(seed)).value;
}

function updateActor(
  actor: ActorState,
  state: GameState,
  actions: ActorAction[],
  immediateFirmPowerHeadroomMW: number,
): ActorState {
  const metrics = { ...actor.hiddenMetrics };
  const actorId = actor.organizationId;
  const roll = actorRandom(state, actorId);

  if (actorId === 'asterion-ai' && Number.isFinite(metrics.demandMW)) {
    const growthRate = 0.05 + roll * 0.04;
    metrics.demandMW *= 1 + growthRate;
    metrics.flexibleDemandMW = Math.max(
      0,
      metrics.demandMW - (metrics.nodeworksContractMW ?? 0) - (metrics.kestrelContractMW ?? 0),
    );
    actions.push({
      actorId,
      kind: 'demand-growth',
      summary: 'Asterion AI expanded its compute demand forecast.',
    });
  }

  if (actorId === 'kestrel-compute') {
    const pipeline = metrics.expansionPipelineQuarters ?? 0;
    if (pipeline > 1) {
      metrics.expansionPipelineQuarters = pipeline - 1;
    } else if (pipeline === 1) {
      if (immediateFirmPowerHeadroomMW >= 2) {
        metrics.expansionPipelineQuarters = 0;
        metrics.effectiveCapacityMinMW = (metrics.effectiveCapacityMinMW ?? 0) + 2;
        metrics.effectiveCapacityMaxMW = (metrics.effectiveCapacityMaxMW ?? 0) + 2;
        actions.push({
          actorId,
          kind: 'capacity-expansion-completed',
          summary: 'Kestrel Compute brought additional capacity online after securing 2 MW of firm grid capacity.',
        });
      } else {
        // The physical project is ready, but it cannot operate without power.
        // Keep it at one quarter so it can complete when capacity becomes available.
        metrics.expansionPipelineQuarters = 1;
        actions.push({
          actorId,
          kind: 'capacity-expansion-delayed',
          summary: 'Kestrel Compute completed construction but its expansion is waiting for firm grid capacity.',
        });
      }
    } else if (roll < 0.3) {
      metrics.expansionPipelineQuarters = 2;
      actions.push({
        actorId,
        kind: 'capacity-expansion-started',
        summary: 'Kestrel Compute secured a new capacity expansion programme.',
      });
    }
  }

  return { ...actor, hiddenMetrics: metrics };
}

/**
 * Advances independent actors after the current quarter's operating report.
 * Decisions are deterministic for a given world seed and quarter, while true
 * actor metrics remain separate from the player's intelligence estimates.
 */
export function advanceAutonomousActors(state: GameState): {
  state: GameState;
  actions: ActorAction[];
} {
  const actions: ActorAction[] = [];
  let regionalMarkets: RegionalMarketState[] = state.regionalMarkets.map((market) => ({ ...market }));
  const initialFirmHeadroom = regionalMarkets[0]?.immediateFirmPowerHeadroomMW ?? 0;
  const actors = state.actors.map((actor) => updateActor(actor, state, actions, initialFirmHeadroom));

  // A rival expansion consumes the same scarce firm-power headroom that the
  // player's power initiative uses. Player-sponsored projects resolve first.
  const kestrelCompleted = actions.some((action) =>
    action.actorId === 'kestrel-compute' && action.kind === 'capacity-expansion-completed');
  if (kestrelCompleted && regionalMarkets[0]) {
    regionalMarkets = regionalMarkets.map((market, index) => index === 0 ? {
      ...market,
      immediateFirmPowerHeadroomMW: market.immediateFirmPowerHeadroomMW - 2,
      committedPowerMW: market.committedPowerMW + 2,
    } : market);
  }

  const solara = actors.find((actor) => actor.organizationId === 'solara-grid');
  if (solara && regionalMarkets[0]) {
    const market = regionalMarkets[0];
    const utilization = market.committedPowerMW / Math.max(1, market.availablePowerMW);
    const roll = actorRandom(state, solara.organizationId);
    const priceMultiplier = utilization >= 0.9
      ? 1.01 + roll * 0.02
      : utilization < 0.8
        ? 0.99 + roll * 0.01
        : 0.995 + roll * 0.015;
    regionalMarkets = regionalMarkets.map((item, index) => index === 0 ? {
      ...item,
      referenceEnergyPriceCentsPerMWh: moneyFromCents(Math.max(1, Math.round(item.referenceEnergyPriceCentsPerMWh * priceMultiplier))),
    } : item);
    actions.push({
      actorId: solara.organizationId,
      kind: 'energy-price-adjustment',
      summary: utilization >= 0.9
        ? 'Solara Grid raised energy pricing amid tight regional capacity.'
        : 'Solara Grid adjusted energy pricing to current regional conditions.',
    });
  }

  const authority = actors.find((actor) => actor.organizationId === 'regional-infrastructure-authority');
  const utilization = regionalMarkets[0]
    ? regionalMarkets[0].committedPowerMW / Math.max(1, regionalMarkets[0].availablePowerMW)
    : 0;
  if (authority && utilization >= 0.92 && authority.hiddenMetrics.reviewActive !== 1) {
    const updatedAuthority = {
      ...authority,
      hiddenMetrics: { ...authority.hiddenMetrics, reviewActive: 1 },
    };
    const authorityIndex = actors.findIndex((actor) => actor.organizationId === authority.organizationId);
    if (authorityIndex >= 0) actors[authorityIndex] = updatedAuthority;
    actions.push({
      actorId: authority.organizationId,
      kind: 'regulatory-review',
      summary: 'The Infrastructure Authority opened a regional grid concentration review.',
    });
  }

  return { state: { ...state, actors, regionalMarkets }, actions };
}
