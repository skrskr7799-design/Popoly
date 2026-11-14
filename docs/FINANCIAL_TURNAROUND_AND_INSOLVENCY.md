# Financial Turnaround, Distress & Insolvency

Status: implementation design approved for the active game-foundation branch  
Scope: the Compute Bottleneck operating company and reusable legal-entity finance model

## Why this system is needed

The 48-quarter unattended stress run originally found a deterministic cash boundary at quarter 25. Phase B now allows the quarter to complete without negative cash by recording unpaid operating costs as trade payables. The economic failure is still visible: revenue has fallen below operating costs after customer allocation and energy-price changes, while the cost base remains too rigid. The new regression boundary is the first overdue NodeWorks trade payable before quarter 29.

The game already models contractual interest and principal service, arrears, overdue/default status, covenant grace and breach, cross-default, acceleration notices, refinancing, lender underwriting and creditor-approved debt restructuring. These systems should be extended, not duplicated.

The missing layer is the operating company's response to deteriorating unit economics, followed by a durable representation of unpaid obligations and a playable insolvency outcome. A negative cash balance must not be silently permitted or discarded.

## Design principles

1. No free bailout. Emergency finance must have a named provider, a limit, a price, repayment terms and explicit approval.
2. Legal entities remain separate. Holding-company cash cannot rescue a subsidiary unless an explicit, authorized transfer or capital injection is recorded.
3. A turnaround has trade-offs. Lower costs may reduce capacity, reliability, staff capability, customer satisfaction or future growth.
4. Distress is not insolvency. A weak quarter should create warning signals and options, not instantly end the campaign.
5. Unpaid obligations remain visible. If cash cannot cover a real expense, record the liability in a dedicated payable/arrears ledger; never create negative cash or erase the expense.
6. Creditor consequences are contractual. Payment priority, arrears, default, covenants and cross-default must remain consistent with existing debt instruments.
7. Deterministic and save-safe. Every transition is pure, validated, reproducible from the seed and covered by save/restore tests.

## Financial health model

Health should be derived from authoritative state and the latest resolved quarter report, with only the minimum persistent counters stored in GameState.

Suggested statuses:

- Stable — positive operating cash contribution, adequate liquidity and no material overdue obligations.
- Watch — negative operating contribution, thin liquidity, covenant grace or early arrears.
- Distressed — persistent negative operating cash flow, material arrears, covenant breach or restricted borrowing.
- Restructuring — a creditor-approved workout is active and its milestones are being tracked.
- Administration — the entity cannot meet due obligations and a formal insolvency process has started.
- Liquidated — operations and assets have been resolved; the entity is no longer an active operator.

Status must be explainable through contributing reasons, not a single opaque score. UI should distinguish operating profitability, cash runway, debt service coverage, arrears, covenant state and credit access.

## Turnaround toolkit

Turnaround decisions are submitted as quarter commands and resolved atomically. They should be scenario-defined actions rather than arbitrary player-entered percentages.

Initial action set:

| Action | Main effect | Cost / downside |
| --- | --- | --- |
| Workforce and shift redesign | Reduce operations/staffing expense | One-time severance; lower operational flexibility and possible reliability impact |
| Maintenance reset | Reduce near-term maintenance spend | Higher failure risk and reliability loss until catch-up maintenance |
| Network/vendor renegotiation | Reduce connectivity and supplier expense | Contract fee or longer commitment; possible service constraints |
| Facility consolidation | Reduce overhead and fixed facility cost | Lower operational limit and a one-time closure cost |
| Suspend discretionary investment | Prevent new nonessential project commitments | Delays capacity, resilience and competitive positioning |
| Commercial recovery plan | Prioritize profitable contracted workload and renewals | Customer negotiation risk; may sacrifice low-margin volume |
| Asset disposal | Generate one-time liquidity from eligible non-core assets | Permanently reduces capacity or future optionality |

Each action needs explicit eligibility, one-time cash cost (if any), recurring cash impact, duration, affected metrics and cancellation/reversal rules. Do not allow repeated stacking of the same action unless the design explicitly supports it.

The first playable release should focus on three actions that map directly to the existing expense profile: workforce/shift redesign, maintenance reset and network/vendor renegotiation. Facility consolidation and asset disposal can follow once asset ownership and valuation are modeled.

## Operating payables and liquidity shortfall

The current finance.cash_negative invariant correctly rejects negative cash. Keep that invariant.

When an entity's cash bridge would close below zero, the engine should calculate the shortfall and identify which expense/payment category could not be met. The shortfall must be posted to a separate operating-payables ledger with:
- legal borrower/entity ID;
- creditor or payable class (payroll, energy, maintenance, network/vendor, tax/overhead);
- original and outstanding amount;
- due quarter and age;
- contractual or statutory priority;
- payment status and any late charge policy.

Do not represent trade payables as a bank loan unless the creditor and terms are actually modeled. Do not double-count unpaid debt service: the existing debt arrears fields remain authoritative for interest/principal.

The cash bridge shows cash remitted to operating creditors, newly accrued obligations, closing unpaid balances and final cash separately. Cash remains non-negative. Previously incurred trade creditors are reserved ahead of new bank debt service. Within the operating ledger, scenario-defined priority and age determine payment order; partial payments reduce the outstanding claim without erasing its history. The quarter can complete into a distressed state only if all unpaid obligations have been represented and the resulting state passes invariants.

Implemented in the active branch: legal-entity operating payable state, defensive save decoding, domain invariants, deterministic priority settlement, per-entity cash isolation, cash-bridge reconciliation, reversible energy-capacity and service-reliability restrictions from overdue essential suppliers, financial-health warnings, lender underwriting penalties for unpaid/overdue trade creditors, and a finance-panel creditor ledger. Save/restore round-trip and deterministic continuation tests cover outstanding payables. A scenario-owned corporate asset register now records book value, realizable value, ownership and secured-debt links. The first liquidation calculation applies administration costs, collateral-limited secured recovery, statutory-style operating-creditor tiers, pro-rata recovery within an underfunded tier, and unsecured debt recovery without pooling assets across legal entities. This is a calculation foundation only: formal administration entry, asset-sale decisions, creditor voting/workout and campaign continuation still remain future work.

## Asset register and liquidation waterfall

The scenario now carries a legal-entity asset register. Each asset has a book value, a conservative realizable value, and an optional secured-debt link. Disposed assets remain in history but are excluded from a later liquidation calculation. A subsidiary's assets are never available to settle a holding-company claim.

The initial waterfall is deliberately simplified and deterministic:
1. Administration costs are deducted from each realized asset at the scenario's configured basis-point rate.
2. A secured lender recovers only from assets pledged to its specific debt instrument.
3. Remaining estate proceeds pay operating creditors in statutory-style tiers: payroll, tax/overhead, energy, maintenance, then network/vendor.
4. Unsecured bank-debt balances, including any deficiency remaining after collateral realization, follow operating creditors.
5. Any residual after all claims is available to shareholders; unpaid claims remain visible as shortfalls.

Claims within an underfunded tier share recovery pro rata in integer cents, with deterministic remainder allocation. The calculation is pure and does not yet dispose assets or move cash; the administration transition will commit those outcomes atomically and record the resulting ownership loss.

## Distress escalation and creditor workout

Distress should escalate based on observable, testable conditions:
- one quarter of negative operating cash contribution: Watch;
- repeated negative contribution or material operating payables: Distressed;
- missed contractual debt service: existing Overdue / Defaulted state remains authoritative;
- sustained inability to pay priority obligations or a failed restructuring milestone: Administration.

A restructuring plan should be a negotiated, time-bounded agreement with:
- payment standstill or grace schedule;
- revised maturity and/or scheduled principal;
- possible rate adjustment or covenant waiver;
- required turnaround actions and milestones;
- lender approval and explicit consequences for failure.

Existing debt restructuring remains the debt-instrument negotiation path. A company-wide workout should coordinate multiple instruments and operating payables without bypassing lender-specific approval.

Emergency liquidity can come from a lender facility, shareholder capital injection, asset sale or a specifically modeled debtor-in-possession / rescue facility. Every source must debit a real provider and credit the borrower; no money appears from nowhere.

## Insolvency and administration

Administration is a game state, not an engine exception. The engine should not silently turn an insolvent company into a healthy one.

A formal insolvency transition should:
1. record the trigger, quarter, unpaid obligations and failed recovery conditions;
2. restrict ordinary new investment, borrowing and discretionary commitments;
3. preserve essential operations only where the scenario permits;
4. run an administration process with creditor claims and asset valuation;
5. resolve secured and unsecured claims according to an explicit simplified priority waterfall;
6. sell, transfer or liquidate assets with matching cash and liability entries;
7. resolve ownership value and any residual shareholder loss;
8. mark the entity Liquidated or Reorganized, and define whether the wider campaign continues.

The first scenario can use a simplified, deterministic administration model. It must still show who is paid, who takes a haircut and what happens to the holding company. Insolvency should be a meaningful consequence, not a generic Game Over popup.

## Save compatibility and migration

Any persistent distress/payables fields require:
- defensive shape validation in persistence/decode.ts;
- domain invariants for IDs, amounts, due quarters and entity references;
- canonical serialization/checksum coverage;
- backward-compatible defaults for older saves where safe, or an explicit simulation-version incompatibility message;
- round-trip save/restore tests at Watch, Distressed, Restructuring and Administration stages.

Avoid changing the game-state schema version until the exact migration/defaulting behavior is implemented and tested. Simulation version must be bumped when old saves cannot be safely continued under changed economic rules.

## Implementation sequence

### Phase A — Operating turnaround
- Add scenario-defined turnaround actions and command validation.
- Apply persistent cost-profile changes and temporary operational trade-offs.
- Include one-time costs and recurring savings in the same entity cash bridge.
- Add UI controls with before/after projections, eligibility and warnings.
- Test no duplicate stacking, affordability, legal-entity separation and deterministic effects.

### Phase B — Financial distress and operating payables
- Add derived health assessment and persistent escalation counters.
- Add a dedicated operating-payables ledger; preserve non-negative cash.
- Integrate payables into finance reporting, cash runway and credit assessment.
- Add creditor workout milestones and save/restore coverage.

### Phase C — Administration and insolvency
- Add formal administration/liquidation state and trigger rules.
- Implement claims, asset realization and priority waterfall.
- Define campaign continuation after subsidiary failure.
- Test solvency recovery, successful restructuring, failed workout and liquidation.

### Phase D — Validation
- Keep the unattended seed-2035 distress boundary as a regression case: unpaid trade creditors must appear before quarter 29, with no negative cash or invalid state.
- Add a managed 48-quarter scenario in which the player responds to warnings.
- Run multiple seeds, save/restore at distress boundaries, and validate every quarter.
- Confirm the economy can recover, remain distressed, restructure or fail for explainable reasons.
- Perform browser smoke tests and tablet/phone visual checks after the UI lands.

## Acceptance criteria

- No unexplained negative cash, silent debt forgiveness or unbacked rescue money.
- A player can see why the company is deteriorating and which decisions can help.
- Turnaround actions create measurable savings and meaningful side effects.
- Operating payables and bank-debt arrears are separate, reported independently and never double-counted.
- Restructuring changes future debt service only after creditor approval.
- Administration and liquidation are persistent, auditable and deterministic.
- Managed long-horizon runs complete with valid state, or reach a documented and explainable insolvency outcome.
- Existing game UI and save/restore flows remain valid.
