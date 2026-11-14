import { gameText } from '../../i18n/game';
import { ArrowRight, Check, Cpu, Gauge, LockKeyhole, Radar, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { GameState, ValidationIssue } from '../domain/types';
import { COMPUTE_BOTTLENECK_INITIATIVES, type StrategicInitiativeDefinition } from '../scenario/initiatives';
import { formatMillions, formatQuarter } from './format';

const cashOf = (state: GameState, id: string) =>
  state.organizations.find((item) => item.id === id)?.cashCents ?? 0;

function effectLabel(initiative: StrategicInitiativeDefinition): string {
  const effect = initiative.effect;
  if (effect.type === 'capacity-expansion') return `+${effect.installedITMW} MW installed capacity · +${effect.operationalLimitMW} MW operating limit`;
  if (effect.type === 'equipment-reservation') return `+${effect.commissionedEquipmentMW} MW-equivalent equipment allocation`;
  if (effect.type === 'firm-power') return `Up to +${effect.gridAllocationMW} MW firm grid capacity`;
  if (effect.type === 'resilience') return `+${(effect.reliabilityGain * 100).toFixed(2)} pp service reliability`;
  return `+${Math.round(effect.confidenceGain * 100)} points intelligence confidence`;
}

function InitiativeGlyph({ type }: { type: StrategicInitiativeDefinition['effect']['type'] }) {
  const Icon = type === 'capacity-expansion' ? Cpu
    : type === 'equipment-reservation' ? LockKeyhole
    : type === 'firm-power' ? Zap
    : type === 'resilience' ? ShieldCheck : Radar;
  return <Icon size={18} strokeWidth={1.7} />;
}

export function QuarterStrategyOverview({
  state, selected, active, issues, onToggle, onResolve,
}: {
  state: GameState;
  selected: string[];
  active: Set<string>;
  issues: ValidationIssue[];
  onToggle: (initiative: StrategicInitiativeDefinition) => void;
  onResolve: () => void;
}) {
  const definitions = COMPUTE_BOTTLENECK_INITIATIVES.filter((item) => selected.includes(item.id));
  const leadershipCapacity = state.holding.leadershipCapacityPerQuarter;
  const leadershipUsed = definitions.reduce((sum, item) => sum + item.leadershipCost, 0);
  const cashAvailable = cashOf(state, 'meridian-group');
  const capitalUsed = definitions.reduce((sum, item) => sum + item.upfrontCostCents, 0);
  const leadershipPct = leadershipCapacity ? Math.min(100, leadershipUsed / leadershipCapacity * 100) : 0;
  const capitalPct = cashAvailable ? Math.min(100, capitalUsed / cashAvailable * 100) : 0;
  const market = state.regionalMarkets[0];
  const company = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const projects = state.projects.filter((item) => item.remainingQuarters > 0);

  return <div className="pop-strategy">
    <section className="pop-strategy-hero">
      <div className="pop-strategy-hero-copy">
        <span className="pop-eyebrow"><i className="pop-eyebrow-pulse" /> EXECUTIVE PLANNING · {formatQuarter(state.quarter)}</span>
        <h2>{gameText("Shape the next")}<br /><em>{gameText("quarter of growth.")}</em></h2>
        <p>{gameText("Every initiative competes for capital, leadership attention and a narrow window of opportunity. Build a coherent portfolio before committing the group.")}</p>
        <div className="pop-strategy-hero-meta"><span><b /> {gameText("DECISION WINDOW OPEN")}</span><span>{gameText("MERIDIAN GROUP")}</span><span>NORTH REGION · 2035</span></div>
      </div>
      <div className="pop-strategy-hero-art" aria-hidden="true">
        <div className="pop-strategy-orbit orbit-a" /><div className="pop-strategy-orbit orbit-b" />
        <div className="pop-strategy-core"><Sparkles size={24} /><span>{gameText("STRATEGY")}</span></div>
        <div className="pop-strategy-node node-a">{gameText("CAPITAL")}</div><div className="pop-strategy-node node-b">{gameText("CAPACITY")}</div><div className="pop-strategy-node node-c">{gameText("INTEL")}</div>
        <svg viewBox="0 0 320 220" role="presentation"><path d="M160 110 L55 48 M160 110 L266 48 M160 110 L160 204" /><circle cx="160" cy="110" r="4" /><circle cx="55" cy="48" r="3" /><circle cx="266" cy="48" r="3" /><circle cx="160" cy="204" r="3" /></svg>
      </div>
      <div className="pop-strategy-quarter"><span>{gameText("CAMPAIGN POSITION")}</span><strong>Q{state.quarter}</strong><small>{gameText("Quarterly decision cycle")}</small><div><i style={{ width: `${Math.min(100, (state.quarter - 1) / 8 * 100)}%` }} /></div><small>{gameText("Guided opening · 8 quarters")}</small></div>
    </section>

    <section className="pop-strategy-resource-grid">
      <article className="pop-strategy-resource">
        <div className="pop-strategy-resource-head"><span>{gameText("LEADERSHIP CAPACITY")}</span><Gauge size={16} /></div>
        <strong>{Math.max(0, leadershipCapacity - leadershipUsed)} <small>/ {leadershipCapacity} units free</small></strong>
        <div className="pop-strategy-meter"><i style={{ width: `${leadershipPct}%` }} /></div>
        <p>{leadershipUsed} units assigned to selected initiatives</p>
      </article>
      <article className="pop-strategy-resource">
        <div className="pop-strategy-resource-head"><span>{gameText("CAPITAL ALLOCATION")}</span><span className="pop-strategy-currency">$</span></div>
        <strong>{formatMillions(Math.max(0, cashAvailable - capitalUsed))} <small>{gameText("available after plan")}</small></strong>
        <div className="pop-strategy-meter capital"><i style={{ width: `${capitalPct}%` }} /></div>
        <p>{formatMillions(capitalUsed)} committed · {formatMillions(cashAvailable)} holding cash</p>
      </article>
      <article className="pop-strategy-resource">
        <div className="pop-strategy-resource-head"><span>{gameText("OPERATING CONSTRAINT")}</span><Zap size={16} /></div>
        <strong>{(market?.immediateFirmPowerHeadroomMW ?? 0).toFixed(1)} <small>{gameText("MW firm headroom")}</small></strong>
        <div className="pop-strategy-mini-stats"><span>Grid {company?.capacity.gridAllocationMW.toFixed(1) ?? '—'} MW</span><span>Equipment {company?.capacity.commissionedEquipmentMW.toFixed(1) ?? '—'} MW</span></div>
      </article>
    </section>

    <div className="pop-strategy-workspace">
      <section className="pop-strategy-catalog">
        <div className="pop-strategy-section-head"><div><span className="pop-eyebrow">{gameText("PORTFOLIO DESIGN")}</span><h3>{gameText("Strategic initiatives")}</h3><p>{gameText("Select the moves that matter most this quarter.")}</p></div><span className="pop-strategy-count">{selected.length.toString().padStart(2, '0')} / {COMPUTE_BOTTLENECK_INITIATIVES.length.toString().padStart(2, '0')}</span></div>
        <div className="pop-strategy-cards">
          {COMPUTE_BOTTLENECK_INITIATIVES.map((initiative, index) => {
            const isSelected = selected.includes(initiative.id);
            const isActive = active.has(initiative.id);
            const otherLeadership = leadershipUsed - (isSelected ? initiative.leadershipCost : 0);
            const otherCapital = capitalUsed - (isSelected ? initiative.upfrontCostCents : 0);
            const canAfford = isSelected || (otherLeadership + initiative.leadershipCost <= leadershipCapacity && otherCapital + initiative.upfrontCostCents <= cashAvailable);
            return <button type="button" key={initiative.id} className={`pop-strategy-card ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
              onClick={() => onToggle(initiative)} disabled={isActive || !canAfford} aria-pressed={isSelected}>
              <div className="pop-strategy-card-top"><span className="pop-strategy-index">0{index + 1}</span><span className="pop-strategy-glyph"><InitiativeGlyph type={initiative.effect.type} /></span>{isActive ? <span className="pop-strategy-status">{gameText("IN PROGRESS")}</span> : isSelected ? <span className="pop-strategy-status selected"><Check size={11} /> {gameText("SELECTED")}</span> : <span className="pop-strategy-add">＋</span>}</div>
              <h4>{initiative.name}</h4><p>{initiative.description}</p>
              <div className="pop-strategy-effect"><span>{gameText("PROJECTED EFFECT")}</span><strong>{effectLabel(initiative)}</strong></div>
              <div className="pop-strategy-card-foot"><span>{initiative.leadershipCost} leadership</span><span>{formatMillions(initiative.upfrontCostCents)}</span><span>{initiative.durationQuarters} qtrs</span></div>
            </button>;
          })}
        </div>
      </section>

      <aside className="pop-strategy-plan">
        <div className="pop-strategy-section-head"><div><span className="pop-eyebrow">{gameText("COMMITMENT PREVIEW")}</span><h3>{gameText("Quarter plan")}</h3><p>{gameText("Review the portfolio before resolution.")}</p></div></div>
        {definitions.length === 0 ? <div className="pop-strategy-empty"><Radar size={22} /><strong>{gameText("No initiatives selected")}</strong><p>{gameText("Your capital and leadership capacity remain uncommitted. Choose a strategic move to build the plan.")}</p></div>
          : <div className="pop-strategy-plan-list">{definitions.map((item) => <div className="pop-strategy-plan-item" key={item.id}><span><Check size={13} /></span><div><strong>{item.name}</strong><small>{item.leadershipCost} leadership · {item.durationQuarters} quarters</small></div><b>{formatMillions(item.upfrontCostCents)}</b></div>)}</div>}
        <div className="pop-strategy-total"><span>{gameText("TOTAL CAPITAL")}</span><strong>{formatMillions(capitalUsed)}</strong></div>
        <div className="pop-strategy-total"><span>{gameText("LEADERSHIP USED")}</span><strong>{leadershipUsed} / {leadershipCapacity}</strong></div>
        <div className="pop-strategy-total remaining"><span>{gameText("REMAINING CAPITAL")}</span><strong>{formatMillions(Math.max(0, cashAvailable - capitalUsed))}</strong></div>
        {projects.length > 0 && <div className="pop-strategy-active"><span className="pop-eyebrow">{gameText("ONGOING PROJECTS")}</span>{projects.map((project) => <div key={project.id}><span>{COMPUTE_BOTTLENECK_INITIATIVES.find((item) => item.id === project.initiativeId)?.name ?? project.initiativeId}</span><b>{project.remainingQuarters} qtr left</b></div>)}</div>}
        <button type="button" className="pop-strategy-resolve" onClick={onResolve}>{gameText("Commit decisions")} <ArrowRight size={16} /></button>
        <p className="pop-strategy-disclaimer">{gameText("Decisions take effect only after the simulation validates and resolves the quarter.")}</p>
      </aside>
    </div>

    {issues.length > 0 && <section className="pop-strategy-issues"><strong>{gameText("Decision validation")}</strong>{issues.map((issue, index) => <p key={`${issue.code}-${index}`}>{issue.code} — {issue.message}</p>)}</section>}
  </div>;
}
