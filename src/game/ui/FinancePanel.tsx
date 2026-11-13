import type { GameState } from '../domain/types';
import type { QuarterReport } from '../systems/quarterReport';
import { calculateDebtServiceObligation } from '../systems/finance';
import { formatMoney, formatPercent, formatQuarter } from './format';

const statusLabel = (status: string | undefined) => {
  if (!status || status === 'current' || status === 'compliant') return 'Current';
  if (status === 'grace') return 'Covenant grace';
  if (status === 'breached') return 'Covenant breached';
  if (status === 'overdue') return 'Overdue';
  if (status === 'defaulted') return 'Default';
  return status.replaceAll('-', ' ');
};

export function FinancePanel({
  state, report, selectedOfferIds, onToggleOffer,
  creditRequest, onCreditRequestChange,
}: {
  state: GameState;
  report: QuarterReport;
  selectedOfferIds: string[];
  onToggleOffer: (offerId: string) => void;
  creditRequest: { borrowerId: string; amountDollars: string; termQuarters: string; collateral: string };
  onCreditRequestChange: (next: { borrowerId: string; amountDollars: string; termQuarters: string; collateral: string }) => void;
}) {
  const organizations = state.organizations;
  const organizationName = (id: string) => organizations.find((item) => item.id === id)?.name ?? id;
  const activeDebts = state.debts.filter((debt) => debt.principalCents > 0 && debt.paymentStatus !== 'settled');
  const totalDebt = activeDebts.reduce((sum, debt) => sum + debt.principalCents, 0);
  const totalInterest = report.totalInterestExpenseCents;
  const scheduledService = activeDebts.reduce((sum, debt) => sum + calculateDebtServiceObligation(debt, state.quarter), 0);
  const operatingCompany = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const borrowerIds = [state.holding.organizationId, ...(operatingCompany ? [operatingCompany.organizationId] : [])];
  const selectedBorrower = organizations.find((item) => item.id === creditRequest.borrowerId);
  const requestAllowed = !!selectedBorrower && !state.debts.some((debt) =>
    debt.borrowerId === selectedBorrower.id && (
      (debt.covenantTerms?.restrictAdditionalBorrowing === true && debt.covenantStatus === 'breached') ||
      debt.paymentStatus === 'defaulted' || debt.crossDefaultedByDebtId !== undefined
    ));
  const requestAmount = Number(creditRequest.amountDollars);
  const validRequest = Number.isFinite(requestAmount) && Number.isSafeInteger(Math.round(requestAmount * 100)) &&
    requestAmount > 0 && Number.isInteger(Number(creditRequest.termQuarters)) &&
    Number(creditRequest.termQuarters) >= 2 && Number(creditRequest.termQuarters) <= 12;
  const availableOffers = state.loanOffers.filter((offer) =>
    offer.status === 'available' && state.quarter <= offer.expiresAfterQuarter);
  const totalCash = borrowerIds.reduce((sum, id) =>
    sum + (organizations.find((item) => item.id === id)?.cashCents ?? 0), 0);
  const undrawnFacilities = state.debts.filter((debt) =>
    debt.facilityLimitCents !== undefined && debt.principalCents < debt.facilityLimitCents);
  const drawableCapacity = undrawnFacilities.reduce((sum, debt) => {
    const lender = state.lenders.find((item) => item.organizationId === debt.lenderId);
    const lenderOrg = organizations.find((item) => item.id === debt.lenderId);
    if (!lender || !lenderOrg || !debt.lenderId) return sum;
    return sum + Math.max(0, Math.min(
      debt.facilityLimitCents! - debt.principalCents,
      lender.availableCapacityCents,
      lenderOrg.cashCents,
    ));
  }, 0);

  return <section id="finance" className="pop-panel pop-finance-panel">
    <div className="pop-section-title">
      <div><span className="pop-eyebrow">GROUP TREASURY & CREDIT</span><h2>Financial position</h2></div>
      <span className="pop-pill">Legal-entity cash kept separate</span>
    </div>
    <p className="pop-panel-intro">Debt belongs to the named borrower. Meridian's cash is not automatically available to NodeWorks, and subsidiary cash is not pooled at holding level.</p>

    <div className="pop-finance-summary">
      <div><span>Outstanding principal</span><strong>{formatMoney(totalDebt, true)}</strong></div>
      <div><span>Quarterly interest expense</span><strong>{formatMoney(totalInterest, true)}</strong></div>
      <div><span>Contractual debt service due</span><strong>{formatMoney(scheduledService, true)}</strong></div>
      <div><span>Undrawn revolving capacity</span><strong>{formatMoney(drawableCapacity, true)}</strong></div>
    </div>

    <div className="pop-finance-subsection">
      <div className="pop-finance-subtitle"><strong>Liquidity by legal entity</strong><small>Opening cash · current quarter</small></div>
      {[state.holding.organizationId, ...(operatingCompany ? [operatingCompany.organizationId] : [])].map((id) => {
        const organization = organizations.find((item) => item.id === id);
        if (!organization) return null;
        const debt = activeDebts.filter((item) => item.borrowerId === id)
          .reduce((sum, item) => sum + item.principalCents, 0);
        return <div className="pop-finance-entity" key={id}>
          <div><strong>{organization.name}</strong><span>Debt {formatMoney(debt, true)}</span></div>
          <strong>{formatMoney(organization.cashCents, true)}</strong>
        </div>;
      })}
    </div>

    <div className="pop-finance-subsection">
      <div className="pop-finance-subtitle"><strong>Debt portfolio</strong><small>{activeDebts.length} outstanding instrument(s)</small></div>
      {activeDebts.map((debt) => {
        const arrears = (debt.arrearsPrincipalCents ?? 0) + (debt.arrearsInterestCents ?? 0);
        const service = calculateDebtServiceObligation(debt, state.quarter);
        const covenant = debt.covenantStatus ?? 'compliant';
        const dueNow = debt.maturityQuarter !== undefined && debt.maturityQuarter <= state.quarter ||
          debt.acceleratedAtQuarter !== undefined && debt.acceleratedAtQuarter <= state.quarter;
        return <article className="pop-debt-card" key={debt.id}>
          <div className="pop-debt-heading">
            <div><strong>{organizationName(debt.borrowerId)}</strong><small>{debt.id}</small></div>
            <span className={debt.paymentStatus === 'defaulted' || covenant === 'breached' ? 'pop-pill pop-pill-warn' : 'pop-pill'}>{statusLabel(debt.paymentStatus === 'defaulted' ? 'defaulted' : covenant)}</span>
          </div>
          <div className="pop-debt-metrics">
            <span><small>Principal</small><strong>{formatMoney(debt.principalCents, true)}</strong></span>
            <span><small>Creditor</small><strong>{debt.lenderId ? organizationName(debt.lenderId) : 'Unassigned'}</strong></span>
            <span><small>Quarterly rate</small><strong>{formatPercent(debt.quarterlyInterestRate, 2)}</strong></span>
            <span><small>Maturity</small><strong>{debt.maturityQuarter === undefined ? (debt.facilityLimitCents ? 'Revolving' : 'Open') : formatQuarter(debt.maturityQuarter)}</strong></span>
            <span><small>Debt service due</small><strong>{formatMoney(service, true)}</strong></span>
            <span><small>Scheduled principal</small><strong>{formatMoney(debt.scheduledPrincipalCentsPerQuarter ?? 0, true)}</strong></span>
          </div>
          {debt.facilityLimitCents !== undefined && <div className="pop-facility-line"><span>Facility limit {formatMoney(debt.facilityLimitCents, true)}</span><strong>Undrawn {formatMoney(Math.max(0, debt.facilityLimitCents - debt.principalCents), true)}</strong></div>}
          {debt.covenantTerms && <div className="pop-covenant-line">
            <span>DSCR minimum {debt.covenantTerms.minimumDebtServiceCoverage?.toFixed(2) ?? '—'}×</span>
            <span>Leverage maximum {debt.covenantTerms.maximumDebtToAnnualCashFlow?.toFixed(2) ?? '—'}×</span>
            <span>{debt.covenantTerms.restrictAdditionalBorrowing ? 'Borrowing restriction applies' : 'No borrowing restriction'}</span>
          </div>}
          {(arrears > 0 || dueNow || debt.crossDefaultedByDebtId) && <div className="pop-debt-warning">
            {arrears > 0 ? `Arrears ${formatMoney(arrears, true)} · ${debt.overdueQuarters ?? 0} overdue quarter(s)` : dueNow ? 'Principal maturity / acceleration is due this quarter.' : `Cross-default linked to ${debt.crossDefaultedByDebtId}`}
          </div>}
        </article>;
      })}
      {activeDebts.length === 0 && <p className="pop-muted">No outstanding debt instruments.</p>}
    </div>

    <div className="pop-finance-subsection">
      <div className="pop-finance-subtitle"><strong>Lender capacity</strong><small>Liquidity and underwriting policy</small></div>
      {state.lenders.map((lender) => {
        const organization = organizations.find((item) => item.id === lender.organizationId);
        return <div className="pop-lender-row" key={lender.organizationId}>
          <div><strong>{organization?.name ?? lender.organizationId}</strong><small>{lender.riskAppetite} · minimum score {lender.minimumCreditScore} · max leverage {lender.maxLoanToAnnualCashFlow.toFixed(1)}×</small></div>
          <div><strong>{formatMoney(lender.availableCapacityCents, true)}</strong><small>capacity available</small></div>
        </div>;
      })}
    </div>

    <div className="pop-finance-subsection">
      <div className="pop-finance-subtitle"><strong>Available loan offers</strong><small>Acceptance is a binding financing decision</small></div>
      {availableOffers.map((offer) => {
        const blocked = state.debts.some((debt) => debt.borrowerId === offer.borrowerId && (
          (debt.covenantTerms?.restrictAdditionalBorrowing === true && debt.covenantStatus === 'breached') ||
          debt.paymentStatus === 'defaulted' || debt.crossDefaultedByDebtId !== undefined
        ));
        const selected = selectedOfferIds.includes(offer.id);
        return <article className="pop-loan-offer" key={offer.id}>
          <div className="pop-loan-heading">
            <div><strong>{organizationName(offer.lenderId)} → {organizationName(offer.borrowerId)}</strong><small>{offer.id}</small></div>
            <span className="pop-pill">{offer.creditRating} · {offer.creditScore}</span>
          </div>
          <div className="pop-debt-metrics">
            <span><small>Principal offered</small><strong>{formatMoney(offer.principalCents, true)}</strong></span>
            <span><small>Quarterly interest</small><strong>{formatPercent(offer.quarterlyInterestRate, 2)}</strong></span>
            <span><small>Maturity</small><strong>{formatQuarter(offer.maturityQuarter)}</strong></span>
            <span><small>Expires after</small><strong>{formatQuarter(offer.expiresAfterQuarter)}</strong></span>
          </div>
          <div className="pop-offer-terms">
            <span>DSCR ≥ {offer.covenantTerms?.minimumDebtServiceCoverage?.toFixed(2) ?? '—'}×</span>
            <span>Leverage ≤ {offer.covenantTerms?.maximumDebtToAnnualCashFlow?.toFixed(1) ?? '—'}×</span>
            <span>{offer.crossDefaultClause ? 'Cross-default clause' : 'No cross-default clause'}</span>
            {offer.collateralDescription && <span>Security: {offer.collateralDescription}</span>}
          </div>
          <label className={`pop-offer-accept ${blocked ? 'is-blocked' : ''}`}>
            <input type="checkbox" checked={selected} disabled={blocked} onChange={() => onToggleOffer(offer.id)} />
            {blocked ? 'Borrowing restricted by existing debt conditions' : selected ? 'Included in this quarter’s decisions' : 'Accept this loan offer'}
          </label>
        </article>;
      })}
      {availableOffers.length === 0 && <p className="pop-muted">No unexpired loan offers are currently available.</p>}
    </div>

    <div className="pop-finance-subsection">
      <div className="pop-finance-subtitle"><strong>Request new credit</strong><small>Lenders underwrite independently at quarter close</small></div>
      <div className="pop-credit-request">
        <label><span>Borrowing entity</span>
          <select value={creditRequest.borrowerId} onChange={(event) => onCreditRequestChange({ ...creditRequest, borrowerId: event.target.value })}>
            {borrowerIds.map((id) => <option key={id} value={id}>{organizationName(id)}</option>)}
          </select>
        </label>
        <label><span>Requested principal · USD</span>
          <input type="number" min="1" step="100000" value={creditRequest.amountDollars}
            onChange={(event) => onCreditRequestChange({ ...creditRequest, amountDollars: event.target.value })} placeholder="e.g. 1500000" />
        </label>
        <label><span>Term</span>
          <select value={creditRequest.termQuarters} onChange={(event) => onCreditRequestChange({ ...creditRequest, termQuarters: event.target.value })}>
            {Array.from({ length: 11 }, (_, index) => index + 2).map((term) => <option key={term} value={term}>{term} quarters</option>)}
          </select>
        </label>
        <label className="pop-credit-collateral"><span>Collateral description · optional</span>
          <input type="text" maxLength={160} value={creditRequest.collateral}
            onChange={(event) => onCreditRequestChange({ ...creditRequest, collateral: event.target.value })} placeholder="Equipment, receivables…" />
        </label>
      </div>
      {!requestAllowed && <p className="pop-finance-alert">This borrower is currently restricted from requesting additional credit by an uncured default or covenant breach.</p>}
      {requestAllowed && creditRequest.amountDollars && !validRequest && <p className="pop-finance-alert">Enter a positive amount and a term from 2 to 12 quarters.</p>}
      <p className="pop-muted">A request does not create cash or debt immediately. Each lender returns its own offer or rejection after the quarter resolves. An accepted offer can be taken up in a later quarter.</p>
      <div className="pop-finance-request-state">
        <span>Cash held by selected group entities</span><strong>{formatMoney(totalCash, true)}</strong>
      </div>
    </div>
  </section>;
}
