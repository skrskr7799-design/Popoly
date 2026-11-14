import { gameText } from '../../i18n/game';
import {
  Activity, AlertTriangle, ArrowRight, Banknote, CalendarDays,
  Cpu, Gauge, RadioTower, ShieldCheck, Zap,
} from 'lucide-react';
import type { GameState } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import { formatMoney, formatQuarter } from './format';

const OPENING_QUARTERS = 8;

function Signal({
  icon: Icon, label, value, detail, tone = 'neutral',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'critical';
}) {
  return (
    <article className={`pop-command-signal is-${tone}`}>
      <div className="pop-command-signal-icon"><Icon size={16} /></div>
      <div className="pop-command-signal-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function CommandCenterBriefing({
  state, report, completedQuarters, onOpenStrategy, onOpenMarkets,
}: {
  state: GameState;
  report: QuarterReport;
  completedQuarters: number;
  onOpenStrategy: () => void;
  onOpenMarkets: () => void;
}) {
  const company = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const market = state.regionalMarkets[0];
  const operations = report.companies.find((item) => item.companyId === 'nodeworks')?.operations;
  const capacity = company?.capacity;
  const ceilings = capacity ? [
    { label: 'Installed IT', value: capacity.installedITMW },
    { label: gameText('Grid allocation'), value: capacity.gridAllocationMW },
    { label: gameText('Equipment'), value: capacity.commissionedEquipmentMW },
    { label: gameText('Operational limit'), value: capacity.operationalLimitMW },
  ].concat(operations ? [{ label: gameText('Reliability-adjusted capacity'), value: operations.effectiveCapacityMW }] : [])
    .sort((a, b) => a.value - b.value) : [];
  const bottleneck = ceilings[0];
  const utilization = operations && operations.effectiveCapacityMW > 0
    ? operations.deliveredWorkloadMW / operations.effectiveCapacityMW
    : 0;
  const arrears = state.debts.reduce((sum, debt) =>
    sum + (debt.arrearsPrincipalCents ?? 0) + (debt.arrearsInterestCents ?? 0), 0);
  const defaultedDebts = state.debts.filter((debt) => debt.paymentStatus === 'defaulted').length;
  const reservedOrders = state.equipmentOrders.filter((order) => order.status === 'reserved');
  const reservedMW = reservedOrders.reduce((sum, order) => sum + order.quantityMWEquivalent, 0);
  const staleIntel = state.playerIntelligence.filter((estimate) =>
    state.quarter - estimate.observedQuarter > 1).length;
  const activeProjects = state.projects.filter((project) => project.remainingQuarters > 0).length;
  const actorActions = report.actorActions ?? [];
  const timelineQuarter = Math.min(OPENING_QUARTERS, Math.max(1, state.quarter));

  const situationTitle = defaultedDebts > 0
    ? 'Credit conditions need executive attention'
    : arrears > 0
      ? 'Outstanding obligations are under pressure'
      : bottleneck
        ? `${bottleneck.label} sets the current capacity ceiling`
        : 'The group is ready for its next strategic move';
  const situationDetail = defaultedDebts > 0
    ? `${defaultedDebts} debt instrument(s) are in default. Review the financial position before committing more capital.`
    : arrears > 0
      ? `${formatMoney(arrears)} in principal and interest arrears is recorded across the group.`
      : bottleneck
        ? `NodeWorks is constrained by ${bottleneck.value.toFixed(1)} MW of ${bottleneck.label.toLowerCase()}. Expansion elsewhere may not increase deliverable capacity until this ceiling moves.`
        : 'Review the regional signals and choose where Meridian should commit its limited leadership bandwidth.';

  return (
    <section className="pop-command-briefing" aria-label={gameText("Executive situation briefing")}>
      <div className="pop-command-briefing-heading">
        <div>
          <span className="pop-eyebrow"><i className="pop-eyebrow-pulse" /> {gameText("EXECUTIVE SITUATION ROOM")}</span>
          <h2>{gameText("What matters this quarter")}</h2>
        </div>
        <span className="pop-command-quarter"><CalendarDays size={14} /> {formatQuarter(state.quarter)}</span>
      </div>

      <div className="pop-command-briefing-grid">
        <article className={`pop-command-situation ${defaultedDebts > 0 ? 'is-critical' : arrears > 0 ? 'is-warning' : ''}`}>
          <div className="pop-command-situation-top">
            <span className="pop-command-kicker">{gameText("STRATEGIC READOUT")}</span>
            <span className="pop-command-live"><i /> {gameText("LIVE POSITION")}</span>
          </div>
          <div className="pop-command-situation-body">
            <div className="pop-command-situation-mark"><RadioTower size={22} /></div>
            <div>
              <h3>{gameText(situationTitle)}</h3>
              <p>{gameText(situationDetail)}</p>
            </div>
          </div>
          <div className="pop-command-situation-footer">
            <span>{activeProjects} strategic project(s) in progress</span>
            <button type="button" onClick={onOpenStrategy}>{gameText("Review priorities")} <ArrowRight size={14} /></button>
          </div>
        </article>

        <div className="pop-command-signals">
          <Signal
            icon={Zap}
            label={gameText("Firm power headroom")}
            value={market ? `${market.immediateFirmPowerHeadroomMW.toFixed(1)} MW` : '—'}
            detail={market ? `${gameText(market.name)} · {gameText('available for new allocation')}` : 'Regional data unavailable'}
            tone={market && market.immediateFirmPowerHeadroomMW <= 1 ? 'warn' : 'neutral'}
          />
          <Signal
            icon={Gauge}
            label={gameText("NodeWorks utilization")}
            value={operations ? `${Math.round(utilization * 100)}%` : '—'}
            detail={operations ? `${operations.deliveredWorkloadMW.toFixed(1)} of ${operations.effectiveCapacityMW.toFixed(1)} MW effective capacity` : 'Operating report unavailable'}
            tone={!operations ? 'neutral' : utilization >= 0.9 ? 'warn' : 'good'}
          />
          <Signal
            icon={Cpu}
            label={gameText("Equipment pipeline")}
            value={reservedOrders.length ? `${reservedMW.toFixed(1)} MW-eq` : 'No reservations'}
            detail={reservedOrders.length ? `${reservedOrders.length} reserved order(s) awaiting delivery` : 'No reserved deliveries in the pipeline'}
          />
          <Signal
            icon={arrears > 0 ? AlertTriangle : Banknote}
            label={gameText("Financial pressure")}
            value={arrears > 0 ? formatMoney(arrears) : 'No arrears'}
            detail={defaultedDebts > 0 ? `${defaultedDebts} defaulted instrument(s)` : arrears > 0 ? 'Recorded principal and interest arrears' : 'No overdue principal or interest'}
            tone={defaultedDebts > 0 ? 'critical' : arrears > 0 ? 'warn' : 'good'}
          />
        </div>
      </div>

      <div className="pop-command-lower">
        <div className="pop-command-timeline">
          <div className="pop-command-lower-heading">
            <div><span className="pop-command-kicker">{gameText("CAMPAIGN ARC")}</span><strong>{gameText("The first eight quarters")}</strong></div>
            <span>{Math.min(completedQuarters, OPENING_QUARTERS)} / {OPENING_QUARTERS} complete</span>
          </div>
          <div className="pop-quarter-track" aria-label={`${Math.min(completedQuarters, OPENING_QUARTERS)} of eight opening quarters complete`}>
            {Array.from({ length: OPENING_QUARTERS }, (_, index) => {
              const quarter = index + 1;
              const status = quarter <= completedQuarters ? 'complete' : quarter === timelineQuarter && completedQuarters < OPENING_QUARTERS ? 'current' : 'upcoming';
              return (
                <div className={`pop-quarter-step is-${status}`} key={quarter}>
                  <span className="pop-quarter-step-node">{status === 'complete' ? '✓' : String(quarter).padStart(2, '0')}</span>
                  <small>Q{quarter}</small>
                </div>
              );
            })}
          </div>
          <div className="pop-command-timeline-foot">
            <span>{completedQuarters >= OPENING_QUARTERS ? 'Opening scenario complete · sandbox continues' : `${OPENING_QUARTERS - completedQuarters} quarter(s) until the opening scenario concludes`}</span>
            <span><ShieldCheck size={13} /> {gameText("Simulation state preserved")}</span>
          </div>
        </div>

        <div className="pop-command-world">
          <div className="pop-command-lower-heading">
            <div><span className="pop-command-kicker">{gameText("WORLD INTELLIGENCE")}</span><strong>{gameText("Signals beyond the group")}</strong></div>
            <button type="button" onClick={onOpenMarkets}>{gameText("Open intelligence")} <ArrowRight size={13} /></button>
          </div>
          <div className="pop-command-world-stats">
            <div><strong>{state.playerIntelligence.length}</strong><span>{gameText("known estimates")}</span></div>
            <div><strong>{staleIntel}</strong><span>{gameText("stale signals")}</span></div>
            <div><strong>{actorActions.length}</strong><span>{gameText("reported actor actions")}</span></div>
          </div>
          <div className="pop-command-world-note">
            <Activity size={14} />
            <span>{actorActions.length ? gameText(actorActions[0].summary) : gameText('No new external actor activity is recorded in this quarter’s report.')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
