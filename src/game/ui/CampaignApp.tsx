import { useState, type ReactNode } from 'react';
import {
  Activity, ArrowUpRight, Banknote, Building2, Check, FolderOpen,
  ChevronRight, CircleAlert, Cpu, Gauge, Globe2, Landmark,
  LockKeyhole, Plus, Radar, ShieldCheck, Sparkles, Zap,
} from 'lucide-react';
import { CampaignSession, GUIDED_CAMPAIGN_QUARTERS } from '../campaign/session';
import { COMPUTE_BOTTLENECK_INITIATIVES, type StrategicInitiativeDefinition } from '../scenario/initiatives';
import type { GameState, ValidationIssue } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import { formatMillions, formatMoney, formatPercent, formatQuarter } from './format';
import { IndexedDbCampaignSaveRepository } from '../persistence/indexedDbRepository';
import type { CampaignSaveSummary } from '../persistence/repository';
import { exportCampaignSave, importCampaignSave } from '../persistence/transfer';
import { CAMPAIGN_SIMULATION_VERSION } from '../campaign/session';
import { COMPUTE_BOTTLENECK_SCENARIO_ID, COMPUTE_BOTTLENECK_SCENARIO_VERSION } from '../scenario/computeBottleneck';
import { CampaignStoragePanel } from './CampaignStoragePanel';
import { ContractPortfolioPanel } from './ContractPortfolioPanel';
import type { ContractRenewalDraft } from './ContractPortfolioPanel';
import { FinancePanel } from './FinancePanel';
import { RegionalCommandMap } from './RegionalCommandMap';
import { CommandCenterBriefing } from './CommandCenterBriefing';
import { CorporationOverview } from './CorporationOverview';

const money = (cents: number) => formatMillions(cents);
const campaignRepository = new IndexedDbCampaignSaveRepository();
const loadCompatibility = {
  isSimulationCompatible: (version: string) => version === CAMPAIGN_SIMULATION_VERSION,
  isScenarioCompatible: (scenarioId: string, scenarioVersion: string) =>
    scenarioId === COMPUTE_BOTTLENECK_SCENARIO_ID && scenarioVersion === COMPUTE_BOTTLENECK_SCENARIO_VERSION,
};
function getCash(state: GameState, id: string): number {
  return state.organizations.find((item) => item.id === id)?.cashCents ?? 0;
}
function getDebt(state: GameState, id: string): number {
  return state.debts.filter((item) => item.borrowerId === id)
    .reduce((sum, item) => sum + item.principalCents, 0);
}
function activeProjectIds(state: GameState): Set<string> {
  return new Set(state.projects.filter((item) => item.remainingQuarters > 0).map((item) => item.initiativeId));
}
function effectDetail(initiative: StrategicInitiativeDefinition): string {
  const effect = initiative.effect;
  if (effect.type === 'capacity-expansion') return `+${effect.installedITMW} MW installed · +${effect.operationalLimitMW} MW operational limit`;
  if (effect.type === 'equipment-reservation') return `+${effect.commissionedEquipmentMW} MW-equivalent reserved`;
  if (effect.type === 'firm-power') return `Up to +${effect.gridAllocationMW} MW grid allocation`;
  if (effect.type === 'resilience') return `+${(effect.reliabilityGain * 100).toFixed(2)} percentage points reliability`;
  return `+${Math.round(effect.confidenceGain * 100)} points intelligence confidence`;
}

function StatCard({ label, value, note, icon: Icon, tone = 'neutral' }: {
  label: string; value: string; note: string; icon: typeof Banknote; tone?: 'neutral' | 'good' | 'warn';
}) {
  return <div className="pop-stat">
    <div className="pop-stat-top"><span>{label}</span><Icon size={16} /></div>
    <strong className={tone === 'good' ? 'tone-good' : tone === 'warn' ? 'tone-warn' : ''}>{value}</strong>
    <small>{note}</small>
  </div>;
}

function SectionTitle({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return <div className="pop-section-title">
    <div><span className="pop-eyebrow">{eyebrow}</span><h2>{title}</h2></div>
    {right}
  </div>;
}

function InitiativeCard({ initiative, selected, active, affordable, onToggle }: {
  initiative: StrategicInitiativeDefinition; selected: boolean; active: boolean; affordable: boolean; onToggle: () => void;
}) {
  const Icon = initiative.effect.type === 'capacity-expansion' ? Cpu
    : initiative.effect.type === 'equipment-reservation' ? LockKeyhole
    : initiative.effect.type === 'firm-power' ? Zap
    : initiative.effect.type === 'resilience' ? ShieldCheck : Radar;
  return <button type="button" className={`pop-initiative ${selected ? 'is-selected' : ''} `}
    onClick={onToggle} disabled={active || !affordable}>
    <div className="pop-initiative-icon"><Icon size={18} /></div>
    <div className="pop-initiative-copy">
      <div className="pop-initiative-heading"><strong>{initiative.name}</strong>
        {active ? <span className="pop-pill">In progress</span> : selected ? <span className="pop-selected"><Check size={13} /> Selected</span> : null}
      </div>
      <p>{initiative.description}</p>
      <small>{effectDetail(initiative)}</small>
      <div className="pop-initiative-meta"><span>{initiative.leadershipCost} leadership</span><span>{money(initiative.upfrontCostCents)}</span><span>{initiative.durationQuarters} quarters</span></div>
    </div>
    <span className="pop-select-indicator">{selected ? <Check size={16} /> : <Plus size={16} />}</span>
  </button>;
}

function OpeningScreen({ onStart, onOpenArchive }: { onStart: () => void; onOpenArchive: () => void }) {
  return <main className="pop-opening">
    <div className="pop-opening-mark"><Building2 size={28} /></div>
    <span className="pop-eyebrow">POPOLY · STRATEGIC SIMULATION</span>
    <h1>The Compute<br /><em>Bottleneck</em></h1>
    <p>Lead Meridian Group through eight decisive quarters. Control the dependencies that shape the future of regional compute infrastructure.</p>
    <div className="pop-opening-facts">
      <span><Landmark size={16} /> Meridian Group</span><span><Cpu size={16} /> NodeWorks</span><span><Globe2 size={16} /> North Region · 2035</span>
    </div>
    <button className="pop-primary pop-start" onClick={onStart}>Establish command <ChevronRight size={17} /></button>
    <button className="pop-opening-archive" onClick={onOpenArchive}><FolderOpen size={15} /> Resume a saved campaign</button>
    <small className="pop-muted">New campaign · Seed 2035 · Eight-quarter opening</small>
  </main>;
}

function QuarterReportPanel({ report, state }: { report: QuarterReport; state: GameState }) {
  const holdingBridge = report.entityCashBridges.find((item) => item.organizationId === 'meridian-group');
  const company = report.companies.find((item) => item.companyId === 'nodeworks');
  const companyBridge = company?.cashBridge;
  const principalRepaid = (report.debtRepayments ?? [])
    .filter((item) => item.borrowerId === 'nodeworks')
    .reduce((sum, item) => sum + item.principalCents, 0);
  const actions = report.actorActions ?? [];
  const launched = report.projectsLaunched ?? [];
  const completed = report.projectsCompleted ?? [];
  const initiativeName = (id: string) =>
    COMPUTE_BOTTLENECK_INITIATIVES.find((item) => item.id === id)?.name ?? id.replaceAll('-', ' ');
  return <section className="pop-panel pop-report">
    <SectionTitle eyebrow="RESOLUTION" title={`${formatQuarter(report.quarter)} · Quarter review`} right={<span className="pop-pill pop-pill-green">Resolved</span>} />
    <div className="pop-report-grid">
      <div><small>NodeWorks revenue</small><strong>{money(company?.operations.revenueCents ?? 0)}</strong></div>
      <div><small>Operating contribution</small><strong className={(company?.operations.operatingCashContributionCents ?? 0) >= 0 ? 'tone-good' : 'tone-warn'}>{money(company?.operations.operatingCashContributionCents ?? 0)}</strong></div>
      <div><small>Energy expense</small><strong>{money(company?.operations.energyCostCents ?? 0)}</strong></div>
      <div><small>NodeWorks closing cash</small><strong>{money(companyBridge?.closingCashCents ?? getCash(state, 'nodeworks'))}</strong></div>
      <div><small>Meridian closing cash</small><strong>{money(holdingBridge?.closingCashCents ?? getCash(state, 'meridian-group'))}</strong></div>
      <div><small>NodeWorks interest paid</small><strong>{money(companyBridge?.interestPaidCents ?? 0)}</strong></div>
      <div><small>NodeWorks principal repaid</small><strong>{money(principalRepaid)}</strong></div>
    </div>
    {launched.length > 0 && <div className="pop-report-line"><Check size={15} /> Initiatives launched: {launched.map(initiativeName).join(', ')}</div>}
    {completed.length > 0 && <div className="pop-report-line"><Sparkles size={15} /> Projects completed: {completed.map(initiativeName).join(', ')}</div>}
    {(report.projectCashCommitmentCents ?? 0) > 0 && <div className="pop-report-line"><Banknote size={15} /> Project capital committed: {money(report.projectCashCommitmentCents ?? 0)}</div>}
    {report.contractRenewals?.map((item) => <div className="pop-report-line" key={item.contractId}><Activity size={15} /> Contract {item.contractId}: {item.status} — {item.message}</div>)}
    {report.contractNegotiations?.map((item) => <div className="pop-report-line" key={item.contractId}><Activity size={15} /> Contract offer {item.contractId}: {item.status} — {item.message}</div>)}
    {report.creditDecisions?.map((item, index) => <div className="pop-report-line" key={`${item.lenderId}-${index}`}><Banknote size={15} /> Credit decision: {item.status} — {item.reason}</div>)}
    {report.debtArrears?.map((item) => <div className="pop-report-line" key={item.debtId}><CircleAlert size={15} /> Debt arrears {item.debtId}: {money(item.totalArrearsCents)} · {item.status}</div>)}
    {report.covenantUpdates?.map((item) => <div className="pop-report-line" key={item.debtId}><ShieldCheck size={15} /> Covenant {item.debtId}: {item.status} · DSCR {item.debtServiceCoverage.toFixed(2)}×{item.reasons.length ? ` · ${item.reasons.join('; ')}` : ''}</div>)}
    {report.debtRestructurings?.map((item, index) => <div className="pop-report-line" key={`${item.debtId}-restructure-${index}`}><Banknote size={15} /> Restructuring {item.debtId}: {item.status} — {item.reason}</div>)}
    {report.debtRefinancings?.map((item) => <div className="pop-report-line" key={item.oldDebtId}><Banknote size={15} /> Refinanced {item.oldDebtId}: {money(item.refinancedPrincipalCents)} · fee {money(item.feeCents)}</div>)}
    {actions.length > 0 ? <div className="pop-event-list"><span className="pop-eyebrow">WORLD ACTIVITY</span>{actions.map((action, index) =>
      <div className="pop-event" key={`${action.actorId}-${index}`}><span>{action.actorId.replaceAll('-', ' ')}</span><p>{action.summary}</p></div>)}</div>
      : <p className="pop-muted pop-report-empty">No major external events were recorded this quarter.</p>}
  </section>;
}

export default function CampaignApp() {
  const [session, setSession] = useState<CampaignSession | null>(null);
  const [activeView, setActiveView] = useState<'command' | 'corporation' | 'markets' | 'strategy'>('command');
  const [selected, setSelected] = useState<string[]>([]);
  const [renewalDrafts, setRenewalDrafts] = useState<Record<string, ContractRenewalDraft>>({});
  const [selectedLoanOffers, setSelectedLoanOffers] = useState<string[]>([]);
  const [creditRequest, setCreditRequest] = useState({
    borrowerId: 'nodeworks', amountDollars: '', termQuarters: '4', collateral: '',
  });
  const [report, setReport] = useState<QuarterReport | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [revision, setRevision] = useState(0);
  const [showStorage, setShowStorage] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignSaveSummary[]>([]);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  const startCampaign = () => {
    const next = CampaignSession.start({ seed: 2035, repository: campaignRepository });
    setSession(next);
    setActiveView('command');
    setSelected([]);
    setRenewalDrafts({});
    setSelectedLoanOffers([]);
    setCreditRequest({ borrowerId: 'nodeworks', amountDollars: '', termQuarters: '4', collateral: '' });
    setReport(null);
    setIssues([]);
    setStorageMessage(null);
    setShowStorage(false);
    setRevision((value) => value + 1);
  };

  const refreshCampaigns = async (showBusy = true) => {
    if (showBusy) setStorageBusy(true);
    try {
      const result = await campaignRepository.list();
      if (result.ok) setCampaigns(result.value);
      else setStorageMessage(result.error.message);
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : 'Could not refresh the campaign archive.');
    } finally {
      if (showBusy) setStorageBusy(false);
    }
  };

  const openArchive = () => {
    setShowStorage(true);
    setStorageMessage(null);
    void refreshCampaigns();
  };

  const saveCurrentCampaign = async () => {
    if (!session) return;
    setStorageBusy(true);
    try {
      const result = await session.save();
      if (!result.ok) setStorageMessage(result.error.message);
      else {
        setStorageMessage('Campaign snapshot saved locally.');
        await refreshCampaigns(false);
      }
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : 'Could not save the current campaign.');
    } finally {
      setStorageBusy(false);
    }
  };

  const loadCampaign = async (campaignId: string) => {
    setStorageBusy(true);
    try {
      const result = await CampaignSession.restore(campaignId, campaignRepository);
      if (!result.ok) setStorageMessage(result.error.message);
      else {
        setSession(result.value.session);
        setActiveView('command');
        setSelected([]);
        setRenewalDrafts({});
        setSelectedLoanOffers([]);
        setCreditRequest({ borrowerId: 'nodeworks', amountDollars: '', termQuarters: '4', collateral: '' });
        setReport(null);
        setIssues([]);
        setStorageMessage(result.value.recoveredFromPrevious
          ? 'The current revision was unavailable. Restored the previous valid snapshot.'
          : 'Campaign loaded and validated successfully.');
        setShowStorage(false);
        setRevision((value) => value + 1);
      }
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : 'Could not load the selected campaign.');
    } finally {
      setStorageBusy(false);
    }
  };

  const exportCampaign = async (campaignId: string) => {
    setStorageBusy(true);
    let objectUrl: string | null = null;
    try {
      const result = await exportCampaignSave(campaignRepository, campaignId, loadCompatibility);
      if (!result.ok) setStorageMessage(result.error.message);
      else {
        const blob = new Blob([result.value], { type: 'application/json' });
        objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `popoly-${campaignId}.json`;
        anchor.click();
        setStorageMessage('Validated campaign JSON exported.');
      }
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : 'Could not export the selected campaign.');
    } finally {
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 1_000);
      setStorageBusy(false);
    }
  };

  const importCampaign = async (file: File | null) => {
    if (!file) return;
    setStorageBusy(true);
    try {
      const serialized = await file.text();
      const imported = await importCampaignSave(campaignRepository, serialized, loadCompatibility);
      if (!imported.ok) {
        setStorageMessage(imported.error.message);
        return;
      }

      const restored = await CampaignSession.restore(imported.value.save.campaignId, campaignRepository);
      if (!restored.ok) {
        setStorageMessage(restored.error.message);
      } else {
        setSession(restored.value.session);
        setActiveView('command');
        setSelected([]);
        setRenewalDrafts({});
        setSelectedLoanOffers([]);
        setCreditRequest({ borrowerId: 'nodeworks', amountDollars: '', termQuarters: '4', collateral: '' });
        setReport(null);
        setIssues([]);
        setShowStorage(false);
        setStorageMessage('Campaign imported, validated, and opened.');
        setRevision((value) => value + 1);
      }
      await refreshCampaigns(false);
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : 'Could not import the selected campaign file.');
    } finally {
      setStorageBusy(false);
    }
  };

  const storagePanel = <CampaignStoragePanel campaigns={campaigns} activeCampaignId={session?.campaignId ?? ''}
    busy={storageBusy} onLoad={(id) => void loadCampaign(id)} onExport={(id) => void exportCampaign(id)}
    onImport={(file) => void importCampaign(file)} onRefresh={() => void refreshCampaigns()} />;

  if (!session) return <div className="pop-opening-shell"><OpeningScreen onStart={startCampaign} onOpenArchive={openArchive} />
    {showStorage && <div className="pop-opening-storage">{storagePanel}</div>}
  </div>;

  const state = session.state;
  const currentReport = session.currentReport;
  const holdingCash = getCash(state, 'meridian-group');
  const nodeworksCash = getCash(state, 'nodeworks');
  const holdingDebt = getDebt(state, 'meridian-group');
  const nodeworksDebt = getDebt(state, 'nodeworks');
  const company = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const market = state.regionalMarkets[0];
  const operating = currentReport.companies.find((item) => item.companyId === 'nodeworks')?.operations;
  const active = activeProjectIds(state);
  const selectedDefinitions = COMPUTE_BOTTLENECK_INITIATIVES.filter((item) => selected.includes(item.id));
  const leadershipSelected = selectedDefinitions.reduce((sum, item) => sum + item.leadershipCost, 0);
  const cashSelected = selectedDefinitions.reduce((sum, item) => sum + item.upfrontCostCents, 0);
  const leadershipAvailable = state.holding.leadershipCapacityPerQuarter;
  const remainingLeadership = Math.max(0, leadershipAvailable - leadershipSelected);
  const remainingCash = Math.max(0, holdingCash - cashSelected);
  const toggle = (initiative: StrategicInitiativeDefinition) => {
    setIssues([]);
    setSelected((current) => current.includes(initiative.id)
      ? current.filter((id) => id !== initiative.id)
      : [...current, initiative.id]);
  };
  const restartCampaign = () => {
    if (window.confirm('Start a new campaign? Unsaved progress in the current session will be lost.')) {
      startCampaign();
    }
  };
  const renewalCommands = (company?.contracts ?? []).flatMap((contract) => {
    if (!(currentReport.contractsInRenewalWindow ?? []).includes(contract.id)) return [];
    const draft = renewalDrafts[contract.id];
    if (!draft?.enabled) return [];
    return [{
      contractId: contract.id,
      offeredPriceCentsPerMWQuarter: Math.round(Number(draft.priceDollars) * 100),
      offeredWorkloadMW: Number(draft.workloadMW),
      termQuarters: Number(draft.termQuarters),
    }];
  });
  const requestedAmountCents = Math.round(Number(creditRequest.amountDollars) * 100);
  const creditRequests = creditRequest.amountDollars.trim() && Number.isFinite(requestedAmountCents) &&
    requestedAmountCents > 0 && Number.isInteger(Number(creditRequest.termQuarters))
    ? [{
      borrowerId: creditRequest.borrowerId,
      requestedPrincipalCents: requestedAmountCents,
      termQuarters: Number(creditRequest.termQuarters),
      ...(creditRequest.collateral.trim() ? { collateralDescription: creditRequest.collateral.trim() } : {}),
    }]
    : [];
  const resolveQuarter = () => {
    const result = session.advance({
      launchInitiatives: selected,
      contractRenewals: renewalCommands,
      acceptLoanOffers: selectedLoanOffers.map((offerId) => ({ offerId })),
      requestCredit: creditRequests,
    });
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    setReport(result.report);
    setSelected([]);
    setRenewalDrafts({});
    setSelectedLoanOffers([]);
    setCreditRequest({ borrowerId: 'nodeworks', amountDollars: '', termQuarters: '4', collateral: '' });
    setIssues([]);
    setRevision((value) => value + 1);
  };

  return <div className="pop-app" data-revision={revision} data-view={activeView}>
    <aside className="pop-sidebar">
      <div className="pop-brand"><div className="pop-brand-mark">P</div><div><strong>POPOLY</strong><small>TECH DOMINION</small></div></div>
      <div className="pop-campaign-tag"><span className="pop-live-dot" /> LIVE CAMPAIGN</div>
      <div className="pop-side-nav">
        <span className="pop-nav-label">STRATEGIC OFFICE</span>
        <button type="button" className={`pop-nav-item ${activeView === 'command' ? 'active' : ''}`} onClick={() => setActiveView('command')}><Activity size={17} /> Command center</button>
        <button type="button" className={`pop-nav-item ${activeView === 'corporation' ? 'active' : ''}`} onClick={() => setActiveView('corporation')}><Building2 size={17} /> Corporation</button>
        <button type="button" className={`pop-nav-item ${activeView === 'markets' ? 'active' : ''}`} onClick={() => setActiveView('markets')}><Globe2 size={17} /> Markets & intel</button>
        <button type="button" className={`pop-nav-item ${activeView === 'strategy' ? 'active' : ''}`} onClick={() => setActiveView('strategy')}><Radar size={17} /> Quarter strategy</button>
      </div>
      <div className="pop-sidebar-bottom"><span>THE COMPUTE BOTTLENECK</span><small>Scenario v0.1.0</small><small>Campaign {session.campaignId.slice(0, 8)}</small></div>
    </aside>

    <main className="pop-main">
      <header className="pop-topbar"><div><span className="pop-eyebrow">MERIDIAN GROUP / EXECUTIVE OFFICE</span><h1>{({ command: 'Command center', corporation: 'Corporate group', markets: 'Markets & intelligence', strategy: 'Quarter strategy' } as const)[activeView]}</h1></div>
        <div className="pop-topbar-right"><span className="pop-quarter-chip">{formatQuarter(state.quarter)}</span><span className="pop-status"><i /> {session.stage === 'guided' ? 'Guided campaign' : 'Sandbox mode'}</span><button className="pop-secondary-button" onClick={() => void saveCurrentCampaign()} disabled={storageBusy}><Banknote size={14} /> Save</button><button className="pop-quiet-button" onClick={() => showStorage ? setShowStorage(false) : openArchive()}><FolderOpen size={14} /> Archive</button></div>
      </header>
      <nav className="pop-mobile-nav" aria-label="Game navigation">
        <button className={activeView === 'command' ? 'active' : ''} onClick={() => setActiveView('command')}><Activity size={16} /><span>Command</span></button>
        <button className={activeView === 'corporation' ? 'active' : ''} onClick={() => setActiveView('corporation')}><Building2 size={16} /><span>Group</span></button>
        <button className={activeView === 'markets' ? 'active' : ''} onClick={() => setActiveView('markets')}><Globe2 size={16} /><span>Markets</span></button>
        <button className={activeView === 'strategy' ? 'active' : ''} onClick={() => setActiveView('strategy')}><Radar size={16} /><span>Strategy</span></button>
      </nav>

      {activeView === 'corporation' ? <CorporationOverview
        state={state}
        report={currentReport}
        renewalDrafts={renewalDrafts}
        onRenewalDraftChange={(contractId, draft) => setRenewalDrafts((current) => ({ ...current, [contractId]: draft }))}
        selectedLoanOffers={selectedLoanOffers}
        onToggleLoanOffer={(offerId) => setSelectedLoanOffers((current) =>
          current.includes(offerId) ? current.filter((id) => id !== offerId) : [...current, offerId])}
        creditRequest={creditRequest}
        onCreditRequestChange={setCreditRequest}
      /> : <>
      <section className="pop-hero pop-command-hero">
        <div className="pop-hero-copy"><span className="pop-eyebrow"><i className="pop-eyebrow-pulse" /> STRATEGIC POSITION · NORTH REGION · 2035</span><h2>The future is<br /><em>under construction.</em></h2>
          <p>Meridian Group is building the infrastructure behind the next compute economy. Power, equipment, capacity and demand are converging into one strategic contest.</p>
          <div className="pop-hero-meta"><span><b className="pop-live-dot" /> LIVE CAMPAIGN</span><span>MERIDIAN GROUP</span><span>THE COMPUTE BOTTLENECK</span></div>
        </div>
        <div className="pop-hero-visual"><RegionalCommandMap market={market} company={company} /><div className="pop-map-caption"><span>NORTH REGION / INFRASTRUCTURE NETWORK</span><span>SCHEMATIC VIEW · NOT TO SCALE</span></div></div>
        <div className="pop-hero-progress"><span>CAMPAIGN PROGRESS</span><strong>{Math.min(session.completedQuarters, GUIDED_CAMPAIGN_QUARTERS)} <small>/ {GUIDED_CAMPAIGN_QUARTERS}</small></strong><div className="pop-progress"><i style={{ width: `${Math.min(100, session.completedQuarters / GUIDED_CAMPAIGN_QUARTERS * 100)}%` }} /></div><small>{session.stage === 'sandbox' ? 'Opening complete · Continue freely' : `${GUIDED_CAMPAIGN_QUARTERS - session.completedQuarters} quarters remaining`}</small></div>
      </section>

      {storageMessage && <div className="pop-storage-message">{storageMessage}<button onClick={() => setStorageMessage(null)}>Dismiss</button></div>}
      {showStorage && storagePanel}

      <CommandCenterBriefing state={state} report={currentReport} completedQuarters={session.completedQuarters}
        onOpenStrategy={() => setActiveView('strategy')} onOpenMarkets={() => setActiveView('markets')} />

      <section id="group-overview" className="pop-stat-grid">
        <StatCard label="MERIDIAN · CASH" value={money(holdingCash)} note={`Debt ${money(holdingDebt)}`} icon={Banknote} tone="good" />
        <StatCard label="NODEWORKS · CASH" value={money(nodeworksCash)} note={`Debt ${money(nodeworksDebt)}`} icon={Building2} />
        <StatCard label="EFFECTIVE CAPACITY" value={`${operating?.effectiveCapacityMW.toFixed(1) ?? '—'} MW`} note={`Delivered ${company?.deliveredWorkloadMW.toFixed(1) ?? '—'} MW`} icon={Gauge} />
        <StatCard label="RELIABILITY" value={company ? formatPercent(company.capacity.reliability, 2) : '—'} note={`Utilization ${operating && operating.effectiveCapacityMW > 0 ? formatPercent(operating.deliveredWorkloadMW / operating.effectiveCapacityMW) : '—'}`} icon={ShieldCheck} tone="good" />
      </section>

      <div className="pop-content-grid">
        <div className="pop-column">
          <section id="quarter-agenda" className="pop-panel pop-agenda-panel">
            <SectionTitle eyebrow="EXECUTIVE AGENDA" title="Choose this quarter's priorities" right={<span className="pop-pill">{selected.length} selected</span>} />
            <p className="pop-panel-intro">Sponsor initiatives using Meridian's cash and limited leadership bandwidth. Routine operations continue automatically.</p>
            <div className="pop-budget">
              <div><span>Leadership bandwidth</span><strong>{remainingLeadership} <small>/ {leadershipAvailable} units left</small></strong><div className="pop-budget-track"><i style={{ width: `${leadershipAvailable ? leadershipSelected / leadershipAvailable * 100 : 0}%` }} /></div></div>
              <div><span>Capital commitment</span><strong>{money(cashSelected)} <small>committed · {money(remainingCash)} remaining</small></strong><div className="pop-budget-track cash"><i style={{ width: `${holdingCash ? cashSelected / holdingCash * 100 : 0}%` }} /></div></div>
            </div>
            <div className="pop-initiative-list">
              {COMPUTE_BOTTLENECK_INITIATIVES.map((initiative) => {
                const isSelected = selected.includes(initiative.id);
                const canFit = isSelected || (!active.has(initiative.id) &&
                  leadershipSelected + initiative.leadershipCost <= leadershipAvailable &&
                  cashSelected + initiative.upfrontCostCents <= holdingCash);
                return <InitiativeCard key={initiative.id} initiative={initiative} selected={isSelected}
                  active={active.has(initiative.id)} affordable={canFit} onToggle={() => toggle(initiative)} />;
              })}
            </div>
            <div className="pop-agenda-footer"><span>{selected.length ? `${selected.length} initiative(s) queued for resolution` : 'No strategic commitments selected'}</span>
              <button className="pop-primary" onClick={resolveQuarter}>Resolve quarter <ArrowUpRight size={16} /></button>
            </div>
            {issues.length > 0 && <div className="pop-issues"><div><CircleAlert size={16} /> Engine validation</div>{issues.map((item, index) => <p key={`${item.code}-${index}`}><strong>{item.code}</strong> — {item.message}</p>)}</div>}
          </section>

          {report && <QuarterReportPanel report={report} state={state} />}
          <section id="nodeworks" className="pop-panel">
            <SectionTitle eyebrow="OPERATING COMPANY" title="NodeWorks" right={<span className="pop-pill pop-pill-green">Controlled subsidiary</span>} />
            <div className="pop-operating-summary">
              <div><span>Installed IT</span><strong>{company?.capacity.installedITMW.toFixed(1)} MW</strong></div>
              <div><span>Grid allocation</span><strong>{company?.capacity.gridAllocationMW.toFixed(1)} MW</strong></div>
              <div><span>Equipment</span><strong>{company?.capacity.commissionedEquipmentMW.toFixed(1)} MW</strong></div>
              <div><span>Operational limit</span><strong>{company?.capacity.operationalLimitMW.toFixed(1)} MW</strong></div>
            </div>
            <div className="pop-capacity-track"><i style={{ width: `${Math.min(100, (operating?.deliveredWorkloadMW ?? 0) / Math.max(1, operating?.effectiveCapacityMW ?? 1) * 100)}%` }} /></div>
            <small className="pop-muted">Delivered workload is constrained by the lowest of installed, grid, equipment and operational capacity, adjusted for reliability.</small>
          </section>
          <ContractPortfolioPanel
            company={company}
            organizations={state.organizations}
            report={currentReport}
            drafts={renewalDrafts}
            onDraftChange={(contractId, draft) => setRenewalDrafts((current) => ({ ...current, [contractId]: draft }))}
          />
          <FinancePanel
            state={state}
            report={currentReport}
            selectedOfferIds={selectedLoanOffers}
            onToggleOffer={(offerId) => setSelectedLoanOffers((current) =>
              current.includes(offerId) ? current.filter((id) => id !== offerId) : [...current, offerId])}
            creditRequest={creditRequest}
            onCreditRequestChange={setCreditRequest}
          />
        </div>

        <div className="pop-column">
          <section id="regional-market" className="pop-panel">
            <SectionTitle eyebrow="MARKET CONDITIONS" title="North Region" />
            <div className="pop-market-metrics">
              <div><Zap size={16} /><span>Regional power</span><strong>{market?.availablePowerMW.toFixed(0)} MW</strong></div>
              <div><Activity size={16} /><span>Committed load</span><strong>{market?.committedPowerMW.toFixed(0)} MW</strong></div>
              <div><ArrowUpRight size={16} /><span>Immediate firm headroom</span><strong>{market?.immediateFirmPowerHeadroomMW.toFixed(0)} MW</strong></div>
              <div><Cpu size={16} /><span>Equipment delivery pool</span><strong>{market?.equipmentDeliveryPoolMWEquivalentPerQuarter.toFixed(0)} MW-eq / qtr</strong></div>
            </div>
            <div className="pop-energy-price"><span>Reference energy price</span><strong>{formatMoney(market?.referenceEnergyPriceCentsPerMWh ?? 0)} <small>/ MWh</small></strong></div>
          </section>

          <section id="intelligence" className="pop-panel">
            <SectionTitle eyebrow="EXTERNAL INTELLIGENCE" title="Market signals" />
            {state.playerIntelligence.map((estimate, index) => {
              const age = Math.max(0, state.quarter - estimate.observedQuarter);
              const freshness = age === 0 ? 'current' : age <= 1 ? 'recent' : 'stale';
              return <div className="pop-intel" key={`${estimate.subjectId}-${estimate.metric}-${index}`}>
                <div><strong>{estimate.subjectId.replaceAll('-', ' ')}</strong><span>{estimate.metric.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}</span><small>{estimate.source}</small></div>
                <div className="pop-intel-value"><strong>{estimate.metric.toLowerCase().includes('reliability') ? `${(estimate.min * 100).toFixed(0)}–${(estimate.max * 100).toFixed(0)}%` : `${estimate.min.toFixed(estimate.max % 1 ? 1 : 0)}–${estimate.max.toFixed(estimate.max % 1 ? 1 : 0)}`}</strong><small>{estimate.knowledge} · {Math.round(estimate.confidence * 100)}% confidence · {freshness}</small></div>
              </div>;
            })}
          </section>

          <section className="pop-panel">
            <SectionTitle eyebrow="PROJECT PIPELINE" title="Active initiatives" />
            {state.projects.filter((project) => project.remainingQuarters > 0).length === 0
              ? <p className="pop-muted">No active strategic projects. Your executive bandwidth is available for new priorities.</p>
              : state.projects.filter((project) => project.remainingQuarters > 0).map((project) => {
                const definition = COMPUTE_BOTTLENECK_INITIATIVES.find((item) => item.id === project.initiativeId);
                return <div className="pop-project" key={project.id}><div><strong>{definition?.name ?? project.initiativeId}</strong><span>{project.remainingQuarters} quarters remaining</span></div><span className="pop-project-status">IN PROGRESS</span></div>;
              })}
          </section>
        </div>
      </div>

      <footer className="pop-footer"><span>POPOLY / THE COMPUTE BOTTLENECK</span><span>SIMULATION BUILD 0.1.0</span><button onClick={restartCampaign}>Restart campaign</button></footer>
      </>}
    </main>
  </div>;
}
