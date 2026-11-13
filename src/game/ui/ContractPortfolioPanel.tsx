import type { OperatingCompanyState, Organization } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import { formatMoney, formatQuarter } from './format';

export function ContractPortfolioPanel({
  company, organizations, report,
}: {
  company: OperatingCompanyState | undefined;
  organizations: Organization[];
  report: QuarterReport;
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
      <div><span className="pop-eyebrow">COMMERCIAL PORTFOLIO</span><h2>Customer contracts</h2></div>
      <span className="pop-pill">{company.contracts.length} active agreements</span>
    </div>
    <p className="pop-panel-intro">
      Contracted demand is fulfilled before flexible workload when capacity is scarce. Renewal windows are calculated from each agreement's notice period.
    </p>
    <div className="pop-contract-summary">
      <div><span>Contracted demand</span><strong>{contractedMW.toFixed(1)} MW</strong></div>
      <div><span>Flexible workload</span><strong>{flexibleMW.toFixed(1)} MW</strong></div>
      <div><span>Delivered this quarter</span><strong>{report.companies.find((item) => item.companyId === company.organizationId)?.operations.deliveredWorkloadMW.toFixed(1) ?? '0.0'} MW</strong></div>
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
              {renewalDue && <span className="pop-pill pop-pill-warn">Renewal window</span>}
            </div>
          </div>
          <div className="pop-contract-metrics">
            <span><small>Workload</small><strong>{contract.workloadMW.toFixed(1)} MW</strong></span>
            <span><small>Delivered</small><strong>{deliveredMW.toFixed(1)} MW</strong></span>
            <span><small>Price / MW-quarter</small><strong>{formatMoney(contract.priceCentsPerMWQuarter)}</strong></span>
            <span><small>Term end</small><strong>{contract.termEndQuarter === undefined ? 'Rolling' : formatQuarter(contract.termEndQuarter)}</strong></span>
          </div>
          <div className="pop-contract-track"><i style={{ width: `${fill}%` }} /></div>
          {delivery && delivery.serviceCreditCents > 0 && <small className="pop-contract-credit">Service credits: {formatMoney(delivery.serviceCreditCents)}</small>}
        </article>;
      })}
      {company.contracts.length === 0 && <p className="pop-muted">No active customer contracts.</p>}
    </div>
  </section>;
}
