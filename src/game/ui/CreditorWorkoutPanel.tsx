import { gameText } from '../../i18n/game';
import { useState } from 'react';
import type { GameState } from '../domain/types';
import type { CreditorWorkoutProposal } from '../systems/creditorWorkout';
import type { AdministrationTrigger } from '../systems/administration';
import { formatMoney, formatQuarter } from './format';

export function CreditorWorkoutPanel({ state, onPropose, onFileAdministration }: {
  state: GameState;
  onPropose: (proposal: CreditorWorkoutProposal) => void;
  onFileAdministration: (trigger?: AdministrationTrigger) => void;
}) {
  const company = state.operatingCompanies.find((item) => item.organizationId === 'nodeworks');
  const workouts = (state.creditorWorkouts ?? []).filter((item) => item.entityId === company?.organizationId)
    .sort((a, b) => b.openedQuarter - a.openedQuarter);
  const active = workouts.find((item) => item.status === 'active');
  const [draft, setDraft] = useState({
    standstill: '1', extension: '2', rate: '100', debtHaircut: '0', tradeHaircut: '0',
    deadline: '4', cashTarget: '0', payableCap: '5000000', arrearsCap: '1000000', waiver: false,
    conversion: '0', equityValuation: '100000000',
  });
  const update = (key: keyof typeof draft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = () => onPropose({
    entityId: company?.organizationId ?? 'nodeworks',
    standstillQuarters: Number(draft.standstill),
    maturityExtensionQuarters: Number(draft.extension),
    interestReductionBps: Number(draft.rate),
    principalWriteDownBps: Number(draft.debtHaircut),
    tradePayableWriteDownBps: Number(draft.tradeHaircut),
    covenantWaiver: draft.waiver,
    deadlineQuarters: Number(draft.deadline),
    minimumOperatingCashContributionCents: Math.round(Number(draft.cashTarget) * 100),
    maximumOperatingPayablesCents: Math.round(Number(draft.payableCap) * 100),
    maximumDebtArrearsCents: Math.round(Number(draft.arrearsCap) * 100),
    debtToEquityConversionBps: Number(draft.conversion),
    ...(Number(draft.conversion) > 0 ? { equityPreMoneyValuationCents: Math.round(Number(draft.equityValuation) * 100) } : {}),
  });

  return <section className="pop-finance-subsection pop-creditor-workout">
    <div className="pop-finance-subtitle"><strong>{gameText("Creditor workout")}</strong><small>{gameText("Company-wide recovery agreement")}</small></div>
    <p className="pop-muted">{gameText("Lenders vote independently by claim value. Secured creditors must consent to changes affecting their secured portion; write-downs apply only to unsecured deficiency. Trade creditors are represented by existing payable classes. No concessions apply unless the approval threshold is reached.")}</p>
    {workouts.slice(0, 2).map((workout) => <article className="pop-loan-offer" key={workout.id}>
      <div className="pop-loan-heading">
        <strong>{gameText(workout.status.toUpperCase())}</strong>
        <span className="pop-pill">{formatMoney(workout.acceptedClaimsCents, true)} / {formatMoney(workout.totalClaimsCents, true)} accepted</span>
      </div>
      <div className="pop-debt-metrics">
        <span><small>{gameText("Standstill")}</small><strong>{workout.terms.standstillQuarters} qtr</strong></span>
        <span><small>{gameText("Rate reduction")}</small><strong>{workout.terms.interestReductionBps} bps</strong></span>
        <span><small>{gameText("Debt haircut")}</small><strong>{workout.terms.principalWriteDownBps} bps</strong></span>
        <span><small>{gameText("Debt → equity")}</small><strong>{workout.terms.debtToEquityConversionBps} bps</strong></span>
        <span><small>{gameText("Review deadline")}</small><strong>{formatQuarter(Math.max(...workout.milestones.map((item) => item.dueQuarter)))}</strong></span>
      </div>
      {workout.debtConvertedCents !== undefined && <p className="pop-muted">{formatMoney(workout.debtConvertedCents, true)} converted into {workout.newSharesIssued?.toLocaleString()} new voting shares at a pre-money valuation of {formatMoney(workout.terms.equityPreMoneyValuationCents ?? 0, true)}.</p>}
      {workout.votes.map((vote) => <div className="pop-operating-payable" key={vote.creditorId}>
        <span>{vote.creditorId.replace('trade:', '').replaceAll('-', ' ')} · {formatMoney(vote.claimCents, true)}</span>
        <strong>{gameText(vote.vote)}</strong><small>{gameText(vote.reason)}</small>
        {vote.counterTerms && <>
          <small>Counter: {vote.counterTerms.principalWriteDownBps} bps unsecured haircut · {vote.counterTerms.tradePayableWriteDownBps ?? 0} bps trade write-down · {vote.counterTerms.debtToEquityConversionBps ?? 0} bps conversion · {vote.counterTerms.standstillQuarters} quarter standstill</small>
          <button type="button" className="pop-secondary-button" onClick={() => setDraft((current) => ({
            ...current,
            standstill: String(vote.counterTerms!.standstillQuarters),
            extension: String(vote.counterTerms!.maturityExtensionQuarters),
            rate: String(vote.counterTerms!.interestReductionBps),
            debtHaircut: String(vote.counterTerms!.principalWriteDownBps),
            tradeHaircut: String(vote.counterTerms!.tradePayableWriteDownBps ?? current.tradeHaircut),
            conversion: String(vote.counterTerms!.debtToEquityConversionBps ?? current.conversion),
            equityValuation: String((vote.counterTerms!.equityPreMoneyValuationCents ?? 0) / 100 || current.equityValuation),
          }))}>{gameText("Use this counter")}</button>
        </>}
      </div>)}
      {workout.milestones.map((milestone) => <div className="pop-operating-payable" key={milestone.id}>
        <span>{gameText(milestone.metric.replaceAll('-', ' '))}</span><strong>{gameText(milestone.status)}</strong>
        <small>{milestone.measuredCents === undefined ? 'Awaiting review' : formatMoney(milestone.measuredCents, true)}</small>
      </div>)}
      {workout.resolutionNote && <p className="pop-muted">{gameText(workout.resolutionNote)}</p>}
      {workout.status === 'breached' && company?.status !== 'administration' && company?.status !== 'liquidated' && <button type="button" className="pop-primary" onClick={() => onFileAdministration('creditor-workout-breach')}>{gameText("Escalate to administration")}</button>}
    </article>)}
    {!active && company?.status !== 'liquidated' && <div className="pop-credit-request">
      <label><span>{gameText("Payment standstill")}</span><select value={draft.standstill} onChange={(e) => update('standstill', e.target.value)}>{[0,1,2,3,4].map((n) => <option key={n} value={n}>{n} quarters</option>)}</select></label>
      <label><span>Maturity extension (existing dates only)</span><select value={draft.extension} onChange={(e) => update('extension', e.target.value)}>{[0,1,2,3,4,6,8,12].map((n) => <option key={n} value={n}>{n} quarters</option>)}</select></label>
      <label><span>{gameText("Interest reduction · bps")}</span><input type="number" min="0" max="500" step="25" value={draft.rate} onChange={(e) => update('rate', e.target.value)}/></label>
      <label><span>{gameText("Unsecured principal write-down · bps")}</span><input type="number" min="0" max="2500" step="100" value={draft.debtHaircut} onChange={(e) => update('debtHaircut', e.target.value)}/></label>
      <label><span>{gameText("Trade payable write-down · bps")}</span><input type="number" min="0" max="1500" step="100" value={draft.tradeHaircut} onChange={(e) => update('tradeHaircut', e.target.value)}/></label>
      <label><span>{gameText("Debt-to-equity conversion · bps")}</span><input type="number" min="0" max="5000" step="100" value={draft.conversion} onChange={(e) => update('conversion', e.target.value)}/></label>
      <label><span>{gameText("Pre-money equity valuation · USD")}</span><input type="number" min="1" step="1000000" value={draft.equityValuation} onChange={(e) => update('equityValuation', e.target.value)}/></label>
      <label><span>{gameText("Recovery deadline")}</span><select value={draft.deadline} onChange={(e) => update('deadline', e.target.value)}>{[1,2,3,4,6,8,12].map((n) => <option key={n} value={n}>{n} quarters</option>)}</select></label>
      <label><span>{gameText("Minimum operating cash contribution · USD")}</span><input type="number" step="100000" value={draft.cashTarget} onChange={(e) => update('cashTarget', e.target.value)}/></label>
      <label><span>{gameText("Maximum trade payables · USD")}</span><input type="number" min="0" step="100000" value={draft.payableCap} onChange={(e) => update('payableCap', e.target.value)}/></label>
      <label><span>{gameText("Maximum debt arrears · USD")}</span><input type="number" min="0" step="100000" value={draft.arrearsCap} onChange={(e) => update('arrearsCap', e.target.value)}/></label>
      <label><span><input type="checkbox" checked={draft.waiver} onChange={(e) => update('waiver', e.target.checked)}/> {gameText("Request covenant waiver")}</span></label>
      <button type="button" className="pop-primary" onClick={submit}>{gameText("Submit creditor proposal")}</button>
    </div>}
    {active && <p className="pop-finance-alert">{gameText("The active workout is monitored at each quarter close. Administration cannot be closed until its milestones are completed.")}</p>}
  </section>;
}
