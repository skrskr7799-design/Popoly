import {
  Activity, Clock3, Cpu, Factory,
  Gauge, Globe2, Network, RadioTower, ShieldCheck, Signal, Zap,
} from 'lucide-react';
import type { GameState, IntelligenceEstimate, KnowledgeClass } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import { formatMoney, formatPercent, formatQuarter } from './format';

type Props = { state: GameState; report: QuarterReport };

const SUBJECTS: Record<string, { role: string; description: string; mark: string }> = {
  'asterion-ai': { role: 'ANCHOR CUSTOMER', description: 'AI compute demand and supplier strategy', mark: 'AA' },
  'kestrel-compute': { role: 'DIRECT COMPETITOR', description: 'Regional capacity, utilization and service position', mark: 'KC' },
  'solara-grid': { role: 'ENERGY SUPPLIER', description: 'Firm power availability and grid conditions', mark: 'SG' },
  'silicon-vein': { role: 'EQUIPMENT SUPPLIER', description: 'Accelerator and infrastructure delivery capacity', mark: 'SV' },
  'regional-infrastructure-authority': { role: 'REGIONAL INSTITUTION', description: 'Permits, resilience and infrastructure policy', mark: 'RIA' },
};

function knowledgeLabel(value: KnowledgeClass) {
  return ({ known: 'Known', reported: 'Reported', estimated: 'Estimated', unknown: 'Unknown' })[value];
}

function freshnessLabel(age: number) {
  if (age === 0) return 'Current';
  if (age === 1) return 'One quarter old';
  return `${age} quarters old`;
}

function estimateValue(item: IntelligenceEstimate) {
  const metric = item.metric.toLowerCase();
  const precision = item.max % 1 === 0 ? 0 : 1;
  if (metric.includes('reliability')) return `${Math.round(item.min * 100)}–${Math.round(item.max * 100)}%`;
  if (metric.includes('price')) return `${formatMoney(item.min)}–${formatMoney(item.max)}`;
  if (metric.includes('risk')) return `${Math.round(item.min)}–${Math.round(item.max)} / 100`;
  return `${item.min.toFixed(precision)}–${item.max.toFixed(precision)} MW`;
}

function metricLabel(metric: string) {
  const labels: Record<string, string> = {
    effectiveCapacityMW: 'Effective capacity',
    deliveredWorkloadMW: 'Delivered workload',
    reliability: 'Service reliability',
    computeDemandMW: 'Compute demand',
    contractRenewalRisk: 'Contract renewal risk',
  };
  return labels[metric] ?? metric.replaceAll(/([A-Z])/g, ' $1').replaceAll('MW', ' MW').trim();
}

function IntelCard({ item, quarter }: { item: IntelligenceEstimate; quarter: number }) {
  const age = Math.max(0, quarter - item.observedQuarter);
  const subject = SUBJECTS[item.subjectId];
  return <article className="pop-market-intel-row">
    <div className="pop-market-intel-main">
      <div className="pop-market-intel-title">
        <strong>{metricLabel(item.metric)}</strong>
        <span className={`pop-knowledge-tag is-${item.knowledge}`}>{knowledgeLabel(item.knowledge)}</span>
      </div>
      <div className="pop-market-intel-range">{estimateValue(item)}</div>
      <div className="pop-market-intel-source">{item.source}</div>
      <div className="pop-market-confidence">
        <span>Confidence</span>
        <div><i style={{ width: `${Math.max(0, Math.min(100, item.confidence * 100))}%` }} /></div>
        <strong>{Math.round(item.confidence * 100)}%</strong>
      </div>
    </div>
    <div className="pop-market-intel-age"><Clock3 size={12} /><span>{freshnessLabel(age)}</span></div>
  </article>;
}

function ActorCard({ subjectId, estimates, quarter, organizations }: {
  subjectId: string; estimates: IntelligenceEstimate[]; quarter: number;
  organizations: GameState['organizations'];
}) {
  const meta = SUBJECTS[subjectId] ?? { role: 'MARKET PARTICIPANT', description: 'External market actor', mark: '—' };
  const name = organizations.find((item) => item.id === subjectId)?.name ?? subjectId;
  return <article className="pop-market-actor">
    <div className="pop-market-actor-head">
      <div className={`pop-market-actor-mark is-${subjectId}`}>{meta.mark}</div>
      <div><span>{meta.role}</span><h3>{name}</h3><small>{meta.description}</small></div>
      <div className="pop-market-actor-count">{estimates.length} <small>signals</small></div>
    </div>
    <div className="pop-market-intel-list">
      {estimates.length
        ? estimates.map((item) => <IntelCard key={`${item.subjectId}-${item.metric}`} item={item} quarter={quarter} />)
        : <p className="pop-market-no-intel">No verified or estimated signals are currently available. Absence of intelligence is not evidence of inactivity.</p>}
    </div>
  </article>;
}

export function MarketsOverview({ state, report }: Props) {
  const market = state.regionalMarkets[0];
  const powerUtilization = market && market.availablePowerMW > 0
    ? market.committedPowerMW / market.availablePowerMW : 0;
  const powerHeadroom = market?.immediateFirmPowerHeadroomMW ?? 0;
  const equipmentReserved = state.equipmentOrders
    .filter((item) => item.status === 'reserved')
    .reduce((sum, item) => sum + item.quantityMWEquivalent, 0);
  const estimatesByActor = state.playerIntelligence.reduce<Record<string, IntelligenceEstimate[]>>((groups, item) => {
    (groups[item.subjectId] ??= []).push(item);
    return groups;
  }, {});
  const actorOrder = ['asterion-ai', 'kestrel-compute', 'solara-grid', 'silicon-vein', 'regional-infrastructure-authority'];
  const actorActions = report.actorActions ?? [];
  const activeContracts = state.operatingCompanies.flatMap((company) => company.contracts);
  const contractedDemand = activeContracts.filter((item) => item.flexibility === 'contracted')
    .reduce((sum, item) => sum + item.workloadMW, 0);
  const flexibleDemand = activeContracts.filter((item) => item.flexibility === 'flexible')
    .reduce((sum, item) => sum + item.workloadMW, 0);
  const staleSignals = state.playerIntelligence.filter((item) => state.quarter - item.observedQuarter > 1).length;
  const estimatedSignals = state.playerIntelligence.filter((item) => item.knowledge === 'estimated').length;

  return <div className="pop-markets">
    <section className="pop-markets-hero">
      <div className="pop-markets-hero-copy">
        <span className="pop-eyebrow"><i className="pop-eyebrow-pulse" /> REGIONAL MARKET INTELLIGENCE · {formatQuarter(state.quarter)}</span>
        <h2>Power is scarce.<br /><em>Position is everything.</em></h2>
        <p>The North Region’s compute economy is shaped by constrained energy, finite equipment throughput and a small number of consequential buyers and operators. Read the market as a network of dependencies—not a price ticker.</p>
        <div className="pop-markets-hero-tags">
          <span><Globe2 size={13} /> NORTH REGION</span>
          <span><Network size={13} /> INTERDEPENDENT SUPPLY</span>
          <span><Signal size={13} /> {state.playerIntelligence.length} INTELLIGENCE SIGNALS</span>
        </div>
      </div>
      <div className="pop-markets-hero-visual" aria-label="Regional compute market supply network">
        <div className="pop-market-network-ring ring-a" /><div className="pop-market-network-ring ring-b" />
        <svg viewBox="0 0 360 230" aria-hidden="true">
          <path d="M180 44 L180 104 M180 104 L72 164 M180 104 L180 164 M180 104 L288 164" />
          <path d="M72 164 L180 164 L288 164" />
          <circle cx="180" cy="104" r="5" /><circle cx="72" cy="164" r="4" /><circle cx="180" cy="164" r="4" /><circle cx="288" cy="164" r="4" />
        </svg>
        <div className="pop-market-network-core"><Zap size={19} /><strong>NORTH</strong><small>POWER GRID</small></div>
        <div className="pop-market-network-node node-a"><Factory size={17} /><span>NODEWORKS</span></div>
        <div className="pop-market-network-node node-b"><Cpu size={17} /><span>KESTREL</span></div>
        <div className="pop-market-network-node node-c"><RadioTower size={17} /><span>ASTERION</span></div>
        <span className="pop-market-network-caption">SCHEMATIC · NOT TO SCALE</span>
      </div>
    </section>

    <section className="pop-market-condition">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">REGIONAL CONDITIONS</span><h2>Infrastructure pressure</h2></div>
        <span className="pop-pill">{market?.name ?? 'Market data unavailable'}</span>
      </div>
      <div className="pop-market-condition-grid">
        <article className="pop-market-power-card">
          <div className="pop-market-card-label"><Zap size={15} /> GRID CAPACITY</div>
          <div className="pop-market-power-value">{market?.committedPowerMW.toFixed(0) ?? '—'} <small>/ {market?.availablePowerMW.toFixed(0) ?? '—'} MW</small></div>
          <div className="pop-market-power-track"><i style={{ width: `${Math.min(100, Math.max(0, powerUtilization * 100))}%` }} /></div>
          <div className="pop-market-power-foot"><span>{formatPercent(powerUtilization)} committed</span><strong>{powerHeadroom.toFixed(1)} MW firm headroom</strong></div>
        </article>
        <article className="pop-market-condition-stat">
          <div className="pop-market-card-label"><Gauge size={15} /> ENERGY REFERENCE</div>
          <strong>{formatMoney(market?.referenceEnergyPriceCentsPerMWh ?? 0)}</strong>
          <small>Per MWh · regional reference price</small>
        </article>
        <article className="pop-market-condition-stat">
          <div className="pop-market-card-label"><Cpu size={15} /> EQUIPMENT THROUGHPUT</div>
          <strong>{market?.equipmentDeliveryPoolMWEquivalentPerQuarter.toFixed(1) ?? '—'} MW-eq</strong>
          <small>Available delivery pool per quarter</small>
          <span className="pop-market-stat-note">{equipmentReserved.toFixed(1)} MW-eq currently reserved</span>
        </article>
        <article className="pop-market-condition-stat">
          <div className="pop-market-card-label"><Factory size={15} /> CONTRACTED WORKLOAD</div>
          <strong>{contractedDemand.toFixed(1)} MW</strong>
          <small>Firm customer commitments</small>
          <span className="pop-market-stat-note">{flexibleDemand.toFixed(1)} MW flexible workload</span>
        </article>
      </div>
      <div className="pop-market-pressure-note">
        <div className="pop-market-pressure-icon"><Activity size={17} /></div>
        <div><strong>{powerHeadroom <= 2 ? 'Power is the immediate regional constraint' : 'Regional power capacity remains available'}</strong>
          <p>{powerHeadroom <= 2
            ? 'Only a narrow firm-power buffer remains. New compute capacity may be physically stranded unless additional grid allocation is secured.'
            : 'The current firm-power buffer leaves room for carefully staged expansion, subject to equipment and operational constraints.'}</p></div>
      </div>
    </section>

    <section className="pop-market-actors">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">MARKET PARTICIPANTS</span><h2>Who shapes the region</h2></div>
        <span className="pop-pill">{actorOrder.length} tracked entities</span>
      </div>
      <div className="pop-market-actor-grid">
        {actorOrder.map((id) => <ActorCard key={id} subjectId={id} estimates={estimatesByActor[id] ?? []}
          quarter={state.quarter} organizations={state.organizations} />)}
      </div>
    </section>

    <section className="pop-market-intelligence">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">INFORMATION QUALITY</span><h2>Intelligence desk</h2></div>
        <span className="pop-pill">{staleSignals} stale signals</span>
      </div>
      <div className="pop-market-intel-summary">
        <div><strong>{state.playerIntelligence.length}</strong><span>Active signals</span></div>
        <div><strong>{estimatedSignals}</strong><span>Estimated values</span></div>
        <div><strong>{staleSignals}</strong><span>Older than one quarter</span></div>
      </div>
      <div className="pop-market-knowledge-key">
        <span><i className="is-known" /> Known · direct group records</span>
        <span><i className="is-reported" /> Reported · external publication</span>
        <span><i className="is-estimated" /> Estimated · uncertain range</span>
        <span><i className="is-unknown" /> Unknown · no reliable signal</span>
      </div>
      <p className="pop-market-intel-disclaimer"><ShieldCheck size={14} /> External intelligence is deliberately incomplete. Ranges, confidence and observation age are part of the information—not decorative metadata.</p>
    </section>

    <section className="pop-market-activity">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">WORLD ACTIVITY</span><h2>Recent market developments</h2></div>
        <span className="pop-pill">{actorActions.length} reported actions</span>
      </div>
      {actorActions.length ? <div className="pop-market-event-list">{actorActions.map((item, index) => {
        const actor = state.organizations.find((org) => org.id === item.actorId);
        return <article className="pop-market-event" key={`${item.actorId}-${index}`}>
          <div className="pop-market-event-marker"><Activity size={14} /></div>
          <div><span>{actor?.name ?? item.actorId} · {item.kind.replaceAll('-', ' ')}</span><p>{item.summary}</p></div>
          <small>{formatQuarter(report.quarter)}</small>
        </article>;
      })}</div> : <div className="pop-market-empty"><RadioTower size={19} /><div><strong>No new developments recorded</strong><p>Market actors have not produced a reportable action in the latest resolved quarter. Existing constraints and estimates remain in effect.</p></div></div>}
    </section>
  </div>;
}
