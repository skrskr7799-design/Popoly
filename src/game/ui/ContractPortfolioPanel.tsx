import { gameText } from '../../i18n/game';
import type { OperatingCompanyState, Organization } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import { formatMoney, formatQuarter } from './format';

export interface ContractRenewalDraft {
  enabled: boolean;
  priceDollars: string;
  workloadMW: string;
  termQuarters: string;
}

function createRenewalDraft(companyContract: OperatingCompanyState['contracts'][number]): ContractRenewalDraft {
  return {
    enabled: false,
    priceDollars: String(companyContract.priceCentsPerMWQuarter / 100),
    workloadMW: String(companyContract.workloadMW),
    termQuarters: '4',
  };
}

export function ContractPortfolioPanel({
  company, organizations, report, drafts, onDraftChange,
}: {
  company: OperatingCompanyState | undefined;
  organizations: Organization[];
  report: QuarterReport;
  drafts: Record<string, ContractRenewalDraft>;
  onDraftChange: (contractId: string, draft: ContractRenewalDraft) => void;
}) {
  if (!company) return null;

  const fulfilled = report.companies.find((item) => item.companyId === company.organizationId)
    ?.operations.fulfilledContracts ?? [];
  const renewalWindow = new Set(report.contractsInRenewalWindow ?? []);
  const contractedMW = company.contracts
    .filter((contract) => contract.flexibility === 'contracted')
    .reduce((sum, contract) => sum + contract.workloadMW, 0);
  const flexibleMW = company.contracts
    .filter((contract) => contract.flexibility === 'flexible')
    .reduce((sum, contract) => sum + contract.workloadMW, 0);

  return <section className="pop-panel pop-contract-panel">
    <div className="pop-section-title">
      <div><span className="pop-eyebrow">{gameText("COMMERCIAL PORTFOLIO")}</span><h2>{gameText("Customer contracts")}</h2></div>
      <span className="pop-pill">{company.contracts.length} active agreements</span>
    </div>
    <p className="pop-panel-intro">
      Contracted demand is fulfilled before flexible workload when capacity is scarce. Renewal windows are calculated from each agreement's notice period.
    </p>
    <div className="pop-contract-summary">
      <div><span>{gameText("Contracted demand")}</span><strong>{contractedMW.toFixed(1)} MW</strong></div>
      <div><span>{gameText("Flexible workload")}</span><strong>{flexibleMW.toFixed(1)} MW</strong></div>
      <div><span>{gameText("Delivered this quarter")}</span><strong>{report.companies.find((item) => item.companyId === company.organizationId)?.operations.deliveredWorkloadMW.toFixed(1) ?? '0.0'} MW</strong></div>
    </div>
    <div className="pop-contract-list">
      {company.contracts.map((contract) => {
        const customer = organizations.find((item) => item.id === contract.customerId);
        const delivery = fulfilled.find((item) => item.contractId === contract.id);
        const deliveredMW = delivery?.deliveredMW ?? 0;
        const fill = contract.workloadMW > 0
          ? Math.min(100, Math.max(0, deliveredMW / contract.workloadMW * 100))
          : 0;
        const renewalDue = renewalWindow.has(contract.id);
        return <article className="pop-contract" key={contract.id}>
          <div className="pop-contract-heading">
            <div><strong>{customer?.name ?? contract.customerId}</strong><small>{contract.id}</small></div>
            <div className="pop-contract-tags">
              <span className="pop-pill">{contract.flexibility === 'contracted' ? 'Contracted' : 'Flexible'}</span>
              {renewalDue && <span className="pop-pill pop-pill-warn">{gameText("Renewal window")}</span>}
            </div>
          </div>
          <div className="pop-contract-metrics">
            <span><small>{gameText("Workload")}</small><strong>{contract.workloadMW.toFixed(1)} MW</strong></span>
            <span><small>{gameText("Delivered")}</small><strong>{deliveredMW.toFixed(1)} MW</strong></span>
            <span><small>{gameText("Price / MW-quarter")}</small><strong>{formatMoney(contract.priceCentsPerMWQuarter)}</strong></span>
            <span><small>{gameText("Term end")}</small><strong>{contract.termEndQuarter === undefined ? 'Rolling' : formatQuarter(contract.termEndQuarter)}</strong></span>
          </div>
          <div className="pop-contract-track"><i style={{ width: `${fill}%` }} /></div>
          {delivery && delivery.serviceCreditCents > 0 && <small className="pop-contract-credit">Service credits: {formatMoney(delivery.serviceCreditCents)}</small>}
          {renewalDue && (() => {
            const draft = drafts[contract.id] ?? createRenewalDraft(contract);
            return <div className="pop-renewal-editor">
              <label className="pop-renewal-enable">
                <input type="checkbox" checked={draft.enabled}
                  onChange={(event) => onDraftChange(contract.id, { ...draft, enabled: event.currentTarget.checked })} />
                Prepare renewal proposal
              </label>
              <div className="pop-renewal-fields">
                <label><span>{gameText("Offered price · USD / MW-quarter")}</span>
                  <input type="number" min="1" step="1000" value={draft.priceDollars} disabled={!draft.enabled}
                    onChange={(event) => onDraftChange(contract.id, { ...draft, priceDollars: event.currentTarget.value })} />
                </label>
                <label><span>{gameText("Guaranteed workload · MW")}</span>
                  <input type="number" min="0.1" max={contract.workloadMW} step="0.1" value={draft.workloadMW} disabled={!draft.enabled}
                    onChange={(event) => onDraftChange(contract.id, { ...draft, workloadMW: event.currentTarget.value })} />
                </label>
                <label><span>{gameText("New term")}</span>
                  <select value={draft.termQuarters} disabled={!draft.enabled}
                    onChange={(event) => onDraftChange(contract.id, { ...draft, termQuarters: event.currentTarget.value })}>
                    {Array.from({ length: 7 }, (_, index) => index + 2).map((term) =>
                      <option key={term} value={term}>{term} quarters</option>)}
                  </select>
                </label>
              </div>
              <small className="pop-renewal-note">{gameText("The customer may accept, counter, or reject the offer. A competing provider may win the renewal.")}</small>
            </div>;
          })()}
        </article>;
      })}
      {company.contracts.length === 0 && <p className="pop-muted">{gameText("No active customer contracts.")}</p>}
    </div>
  </section>;
}
