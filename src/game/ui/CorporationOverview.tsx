import { gameText } from '../../i18n/game';
import {
  Activity, Building2, Cable, CircleDot, Cpu, Factory, Gauge, HardDrive, Network,
  ShieldCheck, Zap,
} from 'lucide-react';
import type { GameState, TurnaroundActionId } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import type { CreditorWorkoutProposal } from '../systems/creditorWorkout';
import type { AdministrationTrigger } from '../systems/administration';
import type { ContractRenewalDraft } from './ContractPortfolioPanel';
import { ContractPortfolioPanel } from './ContractPortfolioPanel';
import { FinancePanel } from './FinancePanel';
import { formatMoney, formatPercent, formatQuarter } from './format';

type CreditRequest = {
  borrowerId: string;
  amountDollars: string;
  termQuarters: string;
  collateral: string;
};

type Props = {
  state: GameState;
  report: QuarterReport;
  renewalDrafts: Record<string, ContractRenewalDraft>;
  onRenewalDraftChange: (contractId: string, draft: ContractRenewalDraft) => void;
  selectedLoanOffers: string[];
  onToggleLoanOffer: (offerId: string) => void;
  creditRequest: CreditRequest;
  onCreditRequestChange: (next: CreditRequest) => void;
  selectedTurnaroundActionIds: TurnaroundActionId[];
  onToggleTurnaroundAction: (actionId: TurnaroundActionId) => void;
  onFileAdministration: (trigger?: AdministrationTrigger) => void;
  onReorganizeAdministration: (caseId: string) => void;
  onLiquidateAdministration: (caseId: string) => void;
  onProposeWorkout: (proposal: CreditorWorkoutProposal) => void;
};

function EntityMark({ holding = false }: { holding?: boolean }) {
  return <div className={`pop-corp-entity-mark ${holding ? 'is-holding' : 'is-operating'}`}>
    {holding ? <Building2 size={21} /> : <Factory size={21} />}
  </div>;
}

function Metric({ label, value, detail, tone = 'neutral' }: {
  label: string; value: string; detail: string; tone?: 'good' | 'warn' | 'neutral';
}) {
  return <div className={`pop-corp-metric is-${tone}`}>
    <span>{label}</span><strong>{value}</strong><small>{detail}</small>
  </div>;
}

export function CorporationOverview({
  state, report, renewalDrafts, onRenewalDraftChange,
  selectedLoanOffers, onToggleLoanOffer, creditRequest, onCreditRequestChange,
  selectedTurnaroundActionIds, onToggleTurnaroundAction, onFileAdministration, onReorganizeAdministration, onLiquidateAdministration, onProposeWorkout,
}: Props) {
  const holdingId = state.holding.organizationId;
  const operating = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const operatingId = operating?.organizationId ?? 'nodeworks';
  const holding = state.organizations.find((item) => item.id === holdingId);
  const subsidiary = state.organizations.find((item) => item.id === operatingId);
  const operations = report.companies.find((item) => item.companyId === operatingId)?.operations;
  const holdingDebt = state.debts.filter((item) => item.borrowerId === holdingId && item.paymentStatus !== 'settled');
  const subsidiaryDebt = state.debts.filter((item) => item.borrowerId === operatingId && item.paymentStatus !== 'settled');
  const debtTotal = (items: typeof state.debts) => items.reduce((sum, item) => sum + item.principalCents, 0);
  const holdingStake = state.ownership.find((item) => item.ownerId === holdingId && item.companyId === operatingId);
  const ownershipPercent = operating && holdingStake
    ? holdingStake.shares / Math.max(1, operating.issuedShares) * 100
    : 0;
  const votingPercent = operating && holdingStake
    ? holdingStake.votingShares / Math.max(1, operating.issuedShares) * 100
    : 0;
  const capacity = operating?.capacity;
  const effective = operations?.effectiveCapacityMW ?? 0;
  const delivered = operations?.deliveredWorkloadMW ?? operating?.deliveredWorkloadMW ?? 0;
  const utilization = effective > 0 ? delivered / effective : 0;
  const capacityRows = [
    { label: 'Installed IT', value: capacity?.installedITMW ?? 0, icon: Cpu, color: 'it' },
    { label: 'Grid allocation', value: capacity?.gridAllocationMW ?? 0, icon: Zap, color: 'grid' },
    { label: 'Commissioned equipment', value: capacity?.commissionedEquipmentMW ?? 0, icon: HardDrive, color: 'equipment' },
    { label: 'Operational limit', value: capacity?.operationalLimitMW ?? 0, icon: Gauge, color: 'limit' },
  ];
  const bottleneck = capacityRows.reduce((lowest, item) => item.value < lowest.value ? item : lowest, capacityRows[0]);
  const reservedOrders = state.equipmentOrders.filter((item) => item.buyerId === operatingId && item.status === 'reserved');
  const deliveredOrders = state.equipmentOrders.filter((item) => item.buyerId === operatingId && item.status === 'delivered');
  const reservedMW = reservedOrders.reduce((sum, item) => sum + item.quantityMWEquivalent, 0);
  const activeContracts = operating?.contracts ?? [];
  const contractedMW = activeContracts.filter((item) => item.flexibility === 'contracted')
    .reduce((sum, item) => sum + item.workloadMW, 0);
  const flexibleMW = activeContracts.filter((item) => item.flexibility === 'flexible')
    .reduce((sum, item) => sum + item.workloadMW, 0);

  return <div className="pop-corporation">
    <section className="pop-corp-intro">
      <div className="pop-corp-intro-copy">
        <span className="pop-eyebrow"><i className="pop-eyebrow-pulse" /> CORPORATE STRUCTURE · {formatQuarter(state.quarter)}</span>
        <h2>{gameText("One group.")}<br /><em>{gameText("Distinct engines.")}</em></h2>
        <p>{gameText("Meridian sets direction and allocates strategic capital. NodeWorks converts infrastructure, power and equipment into contracted compute services.")}</p>
        <div className="pop-corp-intro-tags">
          <span><CircleDot size={13} /> 2 legal entities</span>
          <span><Network size={13} /> 1 operating subsidiary</span>
          <span><ShieldCheck size={13} /> {gameText("Separate balance sheets")}</span>
        </div>
      </div>
      <div className="pop-corp-intro-visual" aria-label={gameText("Meridian Group owns and directs NodeWorks")}>
        <div className="pop-corp-orbit orbit-one" /><div className="pop-corp-orbit orbit-two" />
        <div className="pop-corp-orbit-core"><span>{gameText("MG")}</span><small>{gameText("GROUP")}</small></div>
        <div className="pop-corp-orbit-node"><Factory size={18} /><small>{gameText("NODEWORKS")}</small></div>
        <svg viewBox="0 0 340 210" aria-hidden="true"><path d="M170 82 C170 112 170 120 170 143" /><path d="M164 136 L170 145 L176 136" /></svg>
      </div>
    </section>

    <section className="pop-corp-section">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">{gameText("GROUP ARCHITECTURE")}</span><h2>{gameText("Holding & subsidiary")}</h2></div>
        <span className="pop-pill pop-pill-green">{gameText("Structure active")}</span>
      </div>
      <div className="pop-corp-hierarchy">
        <article className="pop-corp-entity-card is-parent">
          <div className="pop-corp-entity-head"><EntityMark holding /><div><span>{gameText("HOLDING COMPANY")}</span><h3>{holding?.name ?? 'Meridian Group'}</h3><small>{gameText("Group strategy · Capital allocation · Executive control")}</small></div><span className="pop-corp-entity-code">MG / 01</span></div>
          <div className="pop-corp-entity-finance">
            <div><span>{gameText("Available cash")}</span><strong>{formatMoney(holding?.cashCents ?? 0, true)}</strong></div>
            <div><span>{gameText("Outstanding debt")}</span><strong>{formatMoney(debtTotal(holdingDebt), true)}</strong></div>
            <div><span>{gameText("Strategic bandwidth")}</span><strong>{state.holding.leadershipCapacityPerQuarter} <small>{gameText("units / quarter")}</small></strong></div>
          </div>
        </article>
        <div className="pop-corp-ownership-link"><i /><span><strong>{ownershipPercent.toFixed(0)}%</strong> equity stake · <strong>{votingPercent.toFixed(0)}%</strong> {gameText("voting rights")}</span><i /></div>
        <article className="pop-corp-entity-card is-child">
          <div className="pop-corp-entity-head"><EntityMark /><div><span>{gameText("OPERATING SUBSIDIARY")}</span><h3>{subsidiary?.name ?? 'NodeWorks'}</h3><small>{gameText("Compute infrastructure · Customer delivery · Operations")}</small></div><span className="pop-corp-entity-code">NW / 01</span></div>
          <div className="pop-corp-entity-finance">
            <div><span>{gameText("Available cash")}</span><strong>{formatMoney(subsidiary?.cashCents ?? 0, true)}</strong></div>
            <div><span>{gameText("Outstanding debt")}</span><strong>{formatMoney(debtTotal(subsidiaryDebt), true)}</strong></div>
            <div><span>{gameText("Reputation")}</span><strong>{subsidiary?.reputation ?? 0} <small>/ 100</small></strong></div>
          </div>
        </article>
      </div>
      <p className="pop-corp-footnote">{gameText("Cash and liabilities remain attached to their legal borrower. Group ownership does not automatically pool subsidiary liquidity.")}</p>
    </section>

    <section className="pop-corp-section">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">{gameText("OPERATING ASSETS")}</span><h2>{gameText("Infrastructure & capacity")}</h2></div>
        <span className="pop-pill">{capacity ? formatPercent(capacity.reliability, 1) + ' ' + gameText('reliability') : gameText('No capacity data')}</span>
      </div>
      <div className="pop-corp-asset-overview">
        <div className="pop-corp-capacity-primary">
          <div className="pop-corp-capacity-top"><span>{gameText("RELIABILITY-ADJUSTED CAPACITY")}</span><Gauge size={17} /></div>
          <strong>{effective.toFixed(1)} <small>{gameText("MW")}</small></strong>
          <div className="pop-corp-utilization"><i style={{ width: `${Math.min(100, Math.max(0, utilization * 100))}%` }} /></div>
          <div className="pop-corp-capacity-bottom"><span>{delivered.toFixed(1)} MW {gameText('delivered')}</span><span>{formatPercent(utilization)} {gameText('utilized')}</span></div>
        </div>
        <div className="pop-corp-bottleneck">
          <span>{gameText("ACTIVE CONSTRAINT")}</span><strong>{gameText(bottleneck.label)}</strong><small>{bottleneck.value.toFixed(1)} MW {gameText('currently sets the lowest physical ceiling')}</small>
          <div className="pop-corp-bottleneck-icon"><Activity size={20} /></div>
        </div>
      </div>
      <div className="pop-corp-capacity-grid">
        {capacityRows.map((item) => {
          const Icon = item.icon;
          const max = Math.max(1, ...capacityRows.map((row) => row.value));
          return <article className="pop-corp-capacity-card" key={gameText(item.label)}>
            <div><Icon size={16} /><span>{gameText(item.label)}</span></div>
            <strong>{item.value.toFixed(1)} <small>{gameText("MW")}</small></strong>
            <div className="pop-corp-capacity-track"><i className={`tone-${item.color}`} style={{ width: `${Math.min(100, item.value / max * 100)}%` }} /></div>
          </article>;
        })}
      </div>
      <div className="pop-corp-asset-footer">
        <div><HardDrive size={16} /><span>{gameText("Equipment pipeline")}</span><strong>{reservedMW.toFixed(1)} MW-eq {gameText('reserved')}</strong><small>{reservedOrders.length} {gameText('pending order(s)')} · {deliveredOrders.length} {gameText('delivered')}</small></div>
        <div><Cable size={16} /><span>{gameText("Regional power access")}</span><strong>{state.regionalMarkets[0]?.name ?? 'North Region'}</strong><small>{state.regionalMarkets[0]?.immediateFirmPowerHeadroomMW.toFixed(1) ?? '—'} {gameText('MW firm headroom')}</small></div>
      </div>
    </section>

    <section className="pop-corp-section">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">{gameText("COMMERCIAL ENGINE")}</span><h2>{gameText("Customer exposure")}</h2></div>
        <span className="pop-pill">{activeContracts.length} {gameText('active agreements')}</span>
      </div>
      <div className="pop-corp-commercial">
        <Metric label={gameText("Contracted workload")} value={contractedMW.toFixed(1) + ' MW'} detail={gameText('Firm customer commitments')} tone="good" />
        <Metric label={gameText("Flexible workload")} value={flexibleMW.toFixed(1) + ' MW'} detail={gameText('Demand with flexible terms')} />
        <Metric label={gameText("Quarter revenue")} value={formatMoney(operations?.revenueCents ?? 0, true)} detail={gameText('Latest resolved quarter')} tone="good" />
        <Metric label={gameText("Operating contribution")} value={formatMoney(operations?.operatingCashContributionCents ?? 0, true)} detail={gameText('After operating expenses')} tone={(operations?.operatingCashContributionCents ?? 0) >= 0 ? 'good' : 'warn'} />
      </div>
    </section>

    <ContractPortfolioPanel company={operating} organizations={state.organizations} report={report}
      drafts={renewalDrafts} onDraftChange={onRenewalDraftChange} />

    <section className="pop-corp-section pop-corp-finance">
      <div className="pop-section-title">
        <div><span className="pop-eyebrow">{gameText("GROUP TREASURY")}</span><h2>{gameText("Financial position")}</h2></div>
        <span className="pop-pill">{gameText("Entity-level accounting")}</span>
      </div>
      <div className="pop-corp-finance-summary">
        <Metric label={gameText("Group cash")} value={formatMoney((holding?.cashCents ?? 0) + (subsidiary?.cashCents ?? 0), true)} detail={gameText('Combined view · not pooled')} />
        <Metric label={gameText("Group debt")} value={formatMoney(debtTotal([...holdingDebt, ...subsidiaryDebt]), true)} detail={gameText('Across both legal entities')} tone="warn" />
        <Metric label={gameText("Quarter interest")} value={formatMoney(report.totalInterestExpenseCents, true)} detail={gameText('Latest resolved quarter')} />
      </div>
      <FinancePanel state={state} report={report} selectedOfferIds={selectedLoanOffers}
        onToggleOffer={onToggleLoanOffer} creditRequest={creditRequest}
        onCreditRequestChange={onCreditRequestChange}
        selectedTurnaroundActionIds={selectedTurnaroundActionIds}
        onToggleTurnaroundAction={onToggleTurnaroundAction}
        onFileAdministration={onFileAdministration}
        onReorganizeAdministration={onReorganizeAdministration}
        onLiquidateAdministration={onLiquidateAdministration}
        onProposeWorkout={onProposeWorkout} />
    </section>
  </div>;
}
