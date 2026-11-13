import { moneyFromCents } from '../domain/money';
import type { ActorState, GameState, RegionalMarketState, ServiceContract } from '../domain/types';
import { calculateEffectiveCapacityMW, calculateOperatingQuarter, type FulfilledContract } from './economy';
import { createRandomState, nextRandom } from '../engine/random';

export interface ActorAction {
  actorId: string;
  kind: 'demand-growth' | 'capacity-expansion-started' | 'capacity-expansion-completed' | 'capacity-expansion-delayed' | 'equipment-procurement-delayed' | 'equipment-delivery-delayed' | 'energy-price-adjustment' | 'regulatory-review' | 'customer-allocation' | 'competitor-commercial-terms' | 'contract-expired';
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

/**
 * Customer memory is private world state. It reacts to delivered service and
 * SLA outcomes, then shifts the customer's private renewal and pricing limits.
 */
function updateAsterionRelationship(
  state: GameState,
  actor: ActorState,
  serviceSnapshot?: { contracts: ServiceContract[]; fulfilledContracts: FulfilledContract[] },
): ActorState {
  const company = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const market = state.regionalMarkets[0];
  if (!company || !market) return actor;
  const fixedContracts = (serviceSnapshot?.contracts ?? company.contracts)
    .filter((contract) => contract.flexibility === 'contracted');
  if (fixedContracts.length === 0) return actor;
  const fulfilledContracts = serviceSnapshot?.fulfilledContracts ??
    calculateOperatingQuarter(company, market).fulfilledContracts;
  const fixedResults = fixedContracts.map((contract) => ({
    contract,
    result: fulfilledContracts.find((line) => line.contractId === contract.id),
  }));
  const breached = fixedResults.some(({ result }) => (result?.serviceCreditCents ?? 0) > 0);
  const materiallyUnderdelivered = fixedResults.some(({ contract, result }) =>
    contract.workloadMW - (result?.deliveredMW ?? 0) > 0.25);
  const previousScore = actor.hiddenMetrics.relationshipScore ?? 65;
  const relationshipScore = Math.max(0, Math.min(100,
    previousScore + (breached ? -6 : materiallyUnderdelivered ? -4 : 1.25)));
  const breachStreak = breached ? (actor.hiddenMetrics.slaBreachStreak ?? 0) + 1 : 0;
  const metrics: Record<string, number> = { ...actor.hiddenMetrics, relationshipScore, customerSatisfaction: relationshipScore, slaBreachStreak: breachStreak };

  for (const contract of fixedContracts) {
    const baseMax = metrics[`baseRenewalMaxPrice:${contract.id}`] ??
      metrics[`renewalMaxPrice:${contract.id}`] ?? contract.priceCentsPerMWQuarter;
    const baseMin = metrics[`baseRenewalMinVolume:${contract.id}`] ??
      metrics[`renewalMinVolume:${contract.id}`] ?? contract.minimumWorkloadMW ?? contract.workloadMW;
    metrics[`baseRenewalMaxPrice:${contract.id}`] = baseMax;
    metrics[`baseRenewalMinVolume:${contract.id}`] = baseMin;
    const relationshipFactor = Math.max(0.9, Math.min(1.06, 1 + (relationshipScore - 65) * 0.0015));
    metrics[`renewalMaxPrice:${contract.id}`] = Math.round(baseMax * relationshipFactor);
    metrics[`renewalMinVolume:${contract.id}`] = Math.max(
      Math.max(0, baseMin - 0.5),
      Math.min(contract.workloadMW, baseMin + (65 - relationshipScore) * 0.025),
    );
  }
  const baseFlexibleMax = metrics.baseMaxFlexiblePriceCentsPerMWQuarter ??
    metrics.maxFlexiblePriceCentsPerMWQuarter ?? 44_000_000;
  metrics.baseMaxFlexiblePriceCentsPerMWQuarter = baseFlexibleMax;
  metrics.maxFlexiblePriceCentsPerMWQuarter = Math.round(
    baseFlexibleMax * Math.max(0.9, Math.min(1.06, 1 + (relationshipScore - 65) * 0.0015)),
  );
  return { ...actor, hiddenMetrics: metrics };
}

function updateRenewalRiskIntelligence(state: GameState, actors: ActorState[]): GameState['playerIntelligence'] {
  const customer = actors.find((actor) => actor.organizationId === 'asterion-ai');
  const kestrel = actors.find((actor) => actor.organizationId === 'kestrel-compute');
  const nodeworks = state.operatingCompanies.find((company) => company.organizationId === 'nodeworks');
  if (!customer || !kestrel || !nodeworks) return state.playerIntelligence;
  const relationship = customer.hiddenMetrics.relationshipScore ?? 65;
  const capacity = kestrel.hiddenMetrics.effectiveCapacityMW ?? kestrel.hiddenMetrics.effectiveCapacityMinMW ?? 0;
  const workload = kestrel.hiddenMetrics.currentWorkloadMW ?? kestrel.hiddenMetrics.deliveredWorkloadMaxMW ?? 0;
  const activeContractIds = new Set(nodeworks.contracts.filter((item) => item.flexibility === 'contracted').map((item) => item.id));
  const updated = state.playerIntelligence.filter((item) =>
    !item.metric.startsWith('contractRenewalRisk:') || activeContractIds.has(item.metric.slice('contractRenewalRisk:'.length)));
  for (const contract of nodeworks.contracts.filter((item) => item.flexibility === 'contracted')) {
    const competitorCanServe = capacity - workload + 1e-9 >= contract.workloadMW;
    const risk = Math.max(0, Math.min(100,
      50 - (relationship - 60) * 1.1 +
      (competitorCanServe ? 12 : 0) +
      (customer.hiddenMetrics.slaBreachStreak ?? 0) * 5,
    ));
    const metric = `contractRenewalRisk:${contract.id}`;
    const estimate = {
      subjectId: contract.customerId,
      metric,
      min: Math.max(0, Math.round(risk - 12)),
      max: Math.min(100, Math.round(risk + 12)),
      knowledge: 'estimated' as const,
      confidence: 0.55,
      observedQuarter: state.quarter,
      source: 'procurement signals and service history',
    };
    const index = updated.findIndex((item) => item.metric === metric && item.subjectId === contract.customerId);
    if (index >= 0) updated[index] = estimate;
    else updated.push(estimate);
  }
  return updated;
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
    const nodeworks = state.operatingCompanies.find((company) => company.organizationId === 'nodeworks');
    const nodeworksPrice = nodeworks?.contracts.find((contract) => contract.flexibility === 'flexible')?.priceCentsPerMWQuarter;
    const capacity = metrics.effectiveCapacityMW ?? metrics.effectiveCapacityMinMW ?? 0;
    const workload = metrics.currentWorkloadMW ?? metrics.deliveredWorkloadMaxMW ?? 0;
    const utilization = capacity > 0 ? workload / capacity : 1;
    const currentPrice = metrics.priceCentsPerMWQuarter ?? 40_500_000;
    let revisedPrice = currentPrice;

    // Kestrel competes aggressively while it has room to sell, but protects
    // margin when its own fleet is close to full utilization.
    if (nodeworksPrice && utilization < 0.85 && capacity - workload >= 3) {
      const target = nodeworksPrice * (0.965 + roll * 0.015);
      revisedPrice = Math.round(Math.max(38_000_000, Math.min(46_000_000, target)));
    } else if (utilization >= 0.9) {
      revisedPrice = Math.round(Math.min(46_000_000, currentPrice * (1.005 + roll * 0.01)));
    }

    if (revisedPrice !== currentPrice) {
      metrics.priceCentsPerMWQuarter = revisedPrice;
      actions.push({
        actorId,
        kind: 'competitor-commercial-terms',
        summary: utilization >= 0.9
          ? 'Kestrel Compute revised its commercial terms as available capacity tightened.'
          : 'Kestrel Compute revised its commercial terms to compete for additional customer workload.',
      });
    }
  }

  if (actorId === 'kestrel-compute') {
    const pipeline = metrics.expansionPipelineQuarters ?? 0;
    if (pipeline > 1) {
      metrics.expansionPipelineQuarters = pipeline - 1;
    } else if (pipeline === 1) {
      const orderPlacedQuarter = metrics.expansionOrderPlacedQuarter;
      const equipmentDelivered = Number.isFinite(orderPlacedQuarter) && state.equipmentOrders.some((order) =>
        order.buyerId === actorId && order.placedQuarter === orderPlacedQuarter && order.status === 'delivered');
      if (immediateFirmPowerHeadroomMW >= 2 && equipmentDelivered) {
        metrics.expansionPipelineQuarters = 0;
        metrics.effectiveCapacityMinMW = (metrics.effectiveCapacityMinMW ?? 0) + 2;
        metrics.effectiveCapacityMaxMW = (metrics.effectiveCapacityMaxMW ?? 0) + 2;
        metrics.effectiveCapacityMW = (metrics.effectiveCapacityMW ?? metrics.effectiveCapacityMinMW - 2) + 2;
        actions.push({
          actorId,
          kind: 'capacity-expansion-completed',
          summary: 'Kestrel Compute brought additional capacity online after securing 2 MW of firm grid capacity.',
        });
      } else {
        metrics.expansionPipelineQuarters = 1;
        const kind = !equipmentDelivered ? 'equipment-delivery-delayed' : 'capacity-expansion-delayed';
        actions.push({
          actorId,
          kind,
          summary: !equipmentDelivered
            ? 'Kestrel Compute has completed construction but its equipment delivery is not ready.'
            : 'Kestrel Compute completed construction but its expansion is waiting for firm grid capacity.',
        });
      }
    } else if (roll < 0.3) {
      const market = state.regionalMarkets[0];
      const deliveryQuarter = state.quarter + 2;
      const reserved = state.equipmentOrders
        .filter((order) => order.status === 'reserved' && order.deliveryQuarter === deliveryQuarter)
        .reduce((sum, order) => sum + order.quantityMWEquivalent, 0);
      const available = (market?.equipmentDeliveryPoolMWEquivalentPerQuarter ?? 0) - 2 - reserved;
      if (available >= 2) {
        metrics.expansionPipelineQuarters = 2;
        metrics.expansionOrderPlacedQuarter = state.quarter;
        state.equipmentOrders.push({
          id: `kestrel-equipment-q${state.quarter}`,
          buyerId: actorId,
          quantityMWEquivalent: 2,
          placedQuarter: state.quarter,
          deliveryQuarter,
          status: 'reserved',
        });
        actions.push({
          actorId,
          kind: 'capacity-expansion-started',
          summary: 'Kestrel Compute secured equipment allocation and began a capacity expansion programme.',
        });
      } else {
        actions.push({
          actorId,
          kind: 'equipment-procurement-delayed',
          summary: 'Kestrel Compute could not secure a place in Silicon Vein’s constrained delivery window.',
        });
      }
    }
  }

  return { ...actor, hiddenMetrics: metrics };
}


export interface RivalRenewalBid {
  providerId: string;
  offeredPriceCentsPerMWQuarter: number;
  offeredWorkloadMW: number;
}

/**
 * Returns a confidential, deterministic rival bid for a fixed-term renewal.
 * A rival cannot bid for volume it cannot actually serve with current spare capacity.
 */
export function getRivalRenewalBid(state: GameState, contract: GameState['operatingCompanies'][number]['contracts'][number]): RivalRenewalBid | undefined {
  if (contract.flexibility !== 'contracted' || contract.customerId !== 'asterion-ai') return undefined;
  const kestrel = state.actors.find((actor) => actor.organizationId === 'kestrel-compute');
  if (!kestrel) return undefined;
  const capacity = kestrel.hiddenMetrics.effectiveCapacityMW ?? kestrel.hiddenMetrics.effectiveCapacityMinMW ?? 0;
  const workload = kestrel.hiddenMetrics.currentWorkloadMW ?? kestrel.hiddenMetrics.deliveredWorkloadMaxMW ?? 0;
  if (capacity - workload + 1e-9 < contract.workloadMW) return undefined;
  const roll = actorRandom(state, `kestrel-renewal-${contract.id}`);
  const discount = 0.04 + roll * 0.025;
  return {
    providerId: 'kestrel-compute',
    offeredPriceCentsPerMWQuarter: Math.round(contract.priceCentsPerMWQuarter * (1 - discount)),
    offeredWorkloadMW: contract.workloadMW,
  };
}

interface FlexibleAllocation { nodeworksMW: number; kestrelMW: number; otherMW: number; }

/** Allocate uncommitted customer demand without changing fixed contracts. */
function allocateAsterionFlexibleDemand(state: GameState, demandMW: number): FlexibleAllocation {
  const customer = state.actors.find((actor) => actor.organizationId === 'asterion-ai');
  const kestrel = state.actors.find((actor) => actor.organizationId === 'kestrel-compute');
  const nodeworks = state.operatingCompanies.find((company) => company.organizationId === 'nodeworks');
  if (!customer || !kestrel || !nodeworks) return { nodeworksMW: 0, kestrelMW: 0, otherMW: 0 };
  const nodeworksFixedMW = customer.hiddenMetrics.nodeworksContractMW ?? 0;
  const kestrelFixedMW = customer.hiddenMetrics.kestrelContractMW ?? 0;
  const flexibleMW = Math.max(0, demandMW - nodeworksFixedMW - kestrelFixedMW);
  const nodeworksCapacityMW = Math.max(0, calculateEffectiveCapacityMW(nodeworks) - nodeworksFixedMW);
  const kestrelCapacityMW = Math.max(0, (kestrel.hiddenMetrics.effectiveCapacityMW ?? kestrel.hiddenMetrics.effectiveCapacityMinMW ?? 0) - (kestrel.hiddenMetrics.currentWorkloadMW ?? kestrel.hiddenMetrics.deliveredWorkloadMaxMW ?? 0));
  const otherCapacityMW = Math.max(0, customer.hiddenMetrics.otherProviderCapacityMW ?? 0);
  const suppliers = [
    { id: 'nodeworks', capacity: nodeworksCapacityMW, reliability: nodeworks.capacity.reliability, price: nodeworks.contracts.find((contract) => contract.flexibility === 'flexible')?.priceCentsPerMWQuarter ?? 41_500_000, fixed: nodeworksFixedMW },
    { id: 'kestrel', capacity: kestrelCapacityMW, reliability: kestrel.hiddenMetrics.reliability ?? 0.97, price: kestrel.hiddenMetrics.priceCentsPerMWQuarter ?? 40_500_000, fixed: kestrelFixedMW },
    { id: 'other', capacity: otherCapacityMW, reliability: customer.hiddenMetrics.otherProviderReliability ?? 0.965, price: customer.hiddenMetrics.otherProviderPriceCentsPerMWQuarter ?? 43_000_000, fixed: 0 },
  ].map((supplier) => {
    const concentration = supplier.fixed / Math.max(1, demandMW);
    const concentrationFactor = concentration >= 0.45 ? 0.72 : concentration >= 0.35 ? 0.88 : 1;
    const priceAttractiveness = 41_500_000 / Math.max(1, supplier.price);
    return { ...supplier, score: (supplier.reliability * 0.65 + priceAttractiveness * 0.35) * concentrationFactor, allocation: 0 };
  });
  let remaining = flexibleMW;
  let active = suppliers.filter((supplier) => supplier.capacity > 0);
  while (remaining > 1e-9 && active.length > 0) {
    const totalScore = active.reduce((sum, supplier) => sum + supplier.score, 0);
    if (totalScore <= 0) break;
    const round = remaining;
    const capped = active.filter((supplier) => round * supplier.score / totalScore >= supplier.capacity - supplier.allocation);
    if (capped.length === 0) {
      for (const supplier of active) supplier.allocation += round * supplier.score / totalScore;
      remaining = 0;
    } else {
      for (const supplier of capped) {
        const room = Math.max(0, supplier.capacity - supplier.allocation);
        supplier.allocation += room;
        remaining -= room;
      }
      const cappedIds = new Set(capped.map((supplier) => supplier.id));
      active = active.filter((supplier) => !cappedIds.has(supplier.id));
    }
  }
  const get = (id: string) => suppliers.find((supplier) => supplier.id === id)?.allocation ?? 0;
  return { nodeworksMW: get('nodeworks'), kestrelMW: get('kestrel'), otherMW: get('other') };
}
/**
 * Advances independent actors after the current quarter's operating report.
 * Decisions are deterministic for a given world seed and quarter, while true
 * actor metrics remain separate from the player's intelligence estimates.
 */
export function advanceAutonomousActors(
  state: GameState,
  serviceSnapshot?: { companyId: string; contracts: ServiceContract[]; fulfilledContracts: FulfilledContract[] },
): {
  state: GameState;
  actions: ActorAction[];
} {
  const actions: ActorAction[] = [];
  let regionalMarkets: RegionalMarketState[] = state.regionalMarkets.map((market) => ({ ...market }));
  const initialFirmHeadroom = regionalMarkets[0]?.immediateFirmPowerHeadroomMW ?? 0;
  const actorState = { ...state, equipmentOrders: state.equipmentOrders.map((order) => ({ ...order })) };
  const relationshipUpdatedActors = actorState.actors.map((actor) => actor.organizationId === 'asterion-ai'
    ? updateAsterionRelationship(actorState, actor, serviceSnapshot?.companyId === 'nodeworks' ? serviceSnapshot : undefined) : actor);
  const actors = relationshipUpdatedActors.map((actor) => updateActor(actor, actorState, actions, initialFirmHeadroom));

  actorState.actors = actors;
  // Agreements are served through their stated end quarter. If no renewal
  // was accepted after that quarter's report, the contract expires now.
  const expired = actorState.operatingCompanies.flatMap((company) => company.contracts
    .filter((contract) => contract.flexibility === 'contracted' && contract.termEndQuarter !== undefined && contract.termEndQuarter <= state.quarter)
    .map((contract) => ({ companyId: company.organizationId, contract })));
  if (expired.length > 0) {
    const expiredNodeWorksMW = expired.filter((item) => item.companyId === 'nodeworks')
      .reduce((sum, item) => sum + item.contract.workloadMW, 0);
    actorState.operatingCompanies = actorState.operatingCompanies.map((company) => {
      const remainingContracts = company.contracts.filter((contract) => !expired.some((item) => item.contract.id === contract.id));
      // Preserve the operating target until the customer's post-expiry
      // allocation pass has assigned replacement flexible workload.
      return { ...company, contracts: remainingContracts, deliveredWorkloadMW: company.deliveredWorkloadMW };
    });
    const customerIndex = actors.findIndex((actor) => actor.organizationId === 'asterion-ai');
    const kestrelIndex = actors.findIndex((actor) => actor.organizationId === 'kestrel-compute');
    if (customerIndex >= 0 && expiredNodeWorksMW > 0) {
      const customer = actors[customerIndex]!;
      const nodeworksFixed = Math.max(0, (customer.hiddenMetrics.nodeworksContractMW ?? 0) - expiredNodeWorksMW);
      const kestrel = kestrelIndex >= 0 ? actors[kestrelIndex]! : undefined;
      const kestrelCapacity = kestrel?.hiddenMetrics.effectiveCapacityMW ?? kestrel?.hiddenMetrics.effectiveCapacityMinMW ?? 0;
      const kestrelWorkload = kestrel?.hiddenMetrics.currentWorkloadMW ?? 0;
      const transferred = Math.min(expiredNodeWorksMW, Math.max(0, kestrelCapacity - kestrelWorkload));
      actors[customerIndex] = { ...customer, hiddenMetrics: {
        ...customer.hiddenMetrics, nodeworksContractMW: nodeworksFixed,
        kestrelContractMW: (customer.hiddenMetrics.kestrelContractMW ?? 0) + transferred,
      } };
      if (kestrel && kestrelIndex >= 0) actors[kestrelIndex] = { ...kestrel, hiddenMetrics: {
        ...kestrel.hiddenMetrics, currentWorkloadMW: kestrelWorkload + transferred,
      } };
    }
    for (const item of expired) actions.push({
      actorId: item.contract.customerId, kind: 'contract-expired',
      summary: 'A fixed-term compute agreement expired without a completed renewal; the customer began reallocating the uncovered workload.',
    });
  }

  const asterion = actors.find((actor) => actor.organizationId === 'asterion-ai');
  if (asterion && Number.isFinite(asterion.hiddenMetrics.demandMW)) {
    const allocation = allocateAsterionFlexibleDemand(actorState, asterion.hiddenMetrics.demandMW);
    const customerIndex = actors.findIndex((actor) => actor.organizationId === 'asterion-ai');
    if (customerIndex >= 0) {
      const current = actors[customerIndex]!;
      actors[customerIndex] = { ...current, hiddenMetrics: {
        ...current.hiddenMetrics,
        flexibleDemandMW: Math.max(0, asterion.hiddenMetrics.demandMW - (asterion.hiddenMetrics.nodeworksContractMW ?? 0) - (asterion.hiddenMetrics.kestrelContractMW ?? 0)),
        nodeworksFlexibleMW: allocation.nodeworksMW,
        kestrelFlexibleMW: allocation.kestrelMW,
        otherFlexibleMW: allocation.otherMW,
      } };
    }
    const kestrelIndex = actors.findIndex((actor) => actor.organizationId === 'kestrel-compute');
    if (kestrelIndex >= 0) {
      const kestrel = actors[kestrelIndex]!;
      const previousFlexibleMW = asterion.hiddenMetrics.kestrelFlexibleMW ?? 0;
      const currentWorkloadMW = kestrel.hiddenMetrics.currentWorkloadMW ?? kestrel.hiddenMetrics.deliveredWorkloadMaxMW ?? 0;
      actors[kestrelIndex] = { ...kestrel, hiddenMetrics: {
        ...kestrel.hiddenMetrics,
        currentWorkloadMW: Math.max(0, currentWorkloadMW - previousFlexibleMW + allocation.kestrelMW),
      } };
    }
    const companies = actorState.operatingCompanies.map((company) => {
      if (company.organizationId !== 'nodeworks') return company;
      const contracts = company.contracts.map((contract) => contract.id === 'flexible-workload' ? { ...contract, workloadMW: allocation.nodeworksMW } : contract);
      return { ...company, contracts, deliveredWorkloadMW: Math.min(company.deliveredWorkloadMW, contracts.reduce((sum, contract) => sum + contract.workloadMW, 0)) };
    });
    actorState.operatingCompanies = companies;
    actions.push({ actorId: 'asterion-ai', kind: 'customer-allocation', summary: 'Asterion AI reviewed provider pricing, reliability and available capacity, then reallocated flexible compute demand.' });
  }

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

  const resolvedWorld = { ...state, actors, regionalMarkets, operatingCompanies: actorState.operatingCompanies, equipmentOrders: actorState.equipmentOrders };
  return { state: { ...resolvedWorld, playerIntelligence: updateRenewalRiskIntelligence(resolvedWorld, actors) }, actions };
}
