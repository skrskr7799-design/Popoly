# Economy Model — Vertical Slice

**Status:** Proposed simulation contract; formulas and balance coefficients require calibration.  
**Scope:** Meridian Group, NodeWorks, regional compute demand, energy, equipment supply, and a small set of external actors.

## 1. Modeling principles

1. Every financial quantity has one defined meaning and unit.
2. Cash, profit, valuation, debt, and equity are distinct.
3. Realized production and delivery constrain revenue.
4. Scarce inputs constrain growth and can create strategic leverage.
5. Long lead times matter: investment does not create instant capacity.
6. Every material financial movement is recorded in a ledger.
7. The model should be simple enough to explain and rich enough to create trade-offs.

## 2. Units and precision

Use integer minor currency units as the authoritative accounting representation (for example, USD cents), with formatted USD millions in the UI. Do not store authoritative money as floating-point values.

Physical quantities use explicit units:
- compute capacity: MW of IT load or a clearly defined normalized compute unit; choose one canonical unit for the slice;
- power availability: MW;
- energy consumption: MWh per quarter;
- price: USD/MWh or USD per compute-service unit;
- utilization: basis points or integer percentage points;
- time: integer quarter index.

Never combine MW capacity with MWh energy consumption without an explicit duration conversion.

## 3. Actor and company financial state

Each operating company requires at minimum:
- cash;
- debt principal;
- debt facilities / borrowing limits where applicable;
- interest rate and scheduled debt service;
- issued equity and ownership ledger;
- fixed assets / installed capacity;
- projects and committed capital expenditure;
- quarterly revenue;
- operating expenses by category;
- operating profit;
- realized cash flow;
- receivables/payables or a deliberately simplified settlement model;
- contracts and delivery obligations.

Meridian Group additionally has:
- holding-company cash and debt;
- ownership positions in subsidiaries and external entities;
- intercompany loans or transfers, if supported;
- group-level commitments;
- consolidated reporting rules.

Do not count the same subsidiary cash twice in group consolidated cash. Distinguish cash legally held by the holding company from cash held by controlled subsidiaries.

## 4. Compute service and capacity

For each compute operator, effective deliverable capacity is constrained by:
- installed capacity;
- available power;
- equipment commissioning status;
- workforce/operational capability;
- reliability or outage state.

A first-pass model may calculate a single effective capacity value from these constraints. Keep the factors separately observable so the UI can explain the bottleneck.

Quarterly service delivery is bounded by effective capacity and demand. Contracted demand receives priority only according to explicit contract terms. Any shortfall must create a defined result: lost sales, service credits, penalties, reputational damage, or customer diversification.

Utilization is derived from delivered workload divided by effective capacity, with safe handling for zero capacity.

## 5. Revenue and operating costs

Revenue is generated from delivered service, not nominal capacity or signed demand alone.

Revenue sources for the slice:
- contracted compute service;
- uncontracted market service, if a regional spot/market abstraction is enabled;
- explicitly modeled ancillary services only if needed.

Operating cost categories:
- energy;
- staffing and operations;
- maintenance;
- network / connectivity;
- leases and overhead;
- compliance and insurance, where relevant.

Energy expense must be calculated from energy actually consumed and the applicable tariff/contract terms. Do not charge the company for unused reserved power unless the contract contains a take-or-pay or reservation fee.

Operating profit is revenue minus operating expenses. Capital expenditure is not an ordinary operating expense. Depreciation may be omitted from the first prototype's cash model, but if valuation or accounting profit uses it, define it explicitly and consistently.

## 6. Cash-flow model

A simplified quarterly cash bridge:

Opening cash  
+ customer cash receipts  
+ financing proceeds  
+ asset / equity sale proceeds  
+ other explicit inflows  
− supplier and operating payments  
− capital expenditure paid  
− interest paid  
− debt principal repaid  
− taxes and other explicit payments  
= closing cash

Revenue recognition and cash receipt may differ if receivables are modeled. If receivables are omitted, state that the slice uses immediate settlement and apply it consistently.

Debt principal repayment reduces cash and debt; interest reduces cash and profit. New borrowing increases cash and debt. Equity issuance increases cash and issued shares; it dilutes existing ownership according to explicit issuance rules.

A company cannot have negative cash unless it has an explicit overdraft, credit facility, or insolvency/arrears rule. Never silently clamp negative cash to zero.

## 7. Capital projects

A project definition includes:
- project type;
- sponsoring company;
- capital budget and payment schedule;
- expected completion quarter;
- prerequisites;
- required leadership sponsorship;
- required power, permits, equipment, and specialist capacity;
- progress state;
- delay and overrun risks;
- expected capacity, cost, or capability effect.

Project spending should be committed and paid according to explicit milestones. A project does not add operating capacity until commissioning criteria are met. Delays should identify the blocking dependency.

## 8. Energy market abstraction

Regional energy state includes:
- available capacity;
- demand from all modeled actors;
- spot/contract price;
- reliability;
- reserved capacity and reservation fees;
- expansion lead time;
- policy or allocation constraints.

The first slice does not need to simulate generators, transmission lines, and dispatch in detail. It does need to make regional scarcity and contractual priority legible.

Energy agreements may trade price stability or priority access for long-term commitments, take-or-pay exposure, counterparty risk, or reduced flexibility.

## 9. Equipment and semiconductor supply abstraction

Represent critical equipment as:
- available procurement capacity or allocation;
- price index / unit cost;
- delivery lead time;
- supplier concentration;
- reliability / quality;
- project-specific equipment requirements.

A planned expansion may be delayed even when capital and power are available. Supplier relationships and advance procurement can reduce uncertainty, but should carry cost or commitment.

Do not build a full semiconductor fabrication simulation in this slice.

## 10. Demand, customers, and contracts

A customer has:
- compute demand profile;
- growth expectation;
- price sensitivity;
- reliability requirement;
- supplier concentration preference;
- payment reliability / credit risk.

A contract defines:
- volume or capacity reservation;
- price and indexation;
- term;
- service-level / reliability requirements;
- service-credit rate and the conditions that trigger credits;
- delivery priority;
- penalties and service credits;
- termination / renegotiation conditions;
- exclusivity or concentration implications.

A customer may split demand across suppliers. Supplier selection should consider price, reliability, available capacity, concentration, and strategic relationships.

For the first negotiation slice, the player may propose a new price for an existing flexible customer contract. The customer evaluates it against a private reservation price and may accept, counteroffer, or reject. Accepted terms begin next quarter; current-quarter delivery and cash reporting are not rewritten retroactively. Counteroffers and rejections leave the existing contract unchanged.

## 11. Valuation and ownership

Do not use the old prototype's arbitrary share-price movement as the economy.

For this slice, company valuation may be a reporting estimate derived from a transparent combination of normalized operating performance, assets, debt, growth prospects, and risk. It is not a cash balance and does not automatically imply liquidity or a realizable sale price.

Ownership ledger invariants:
- total issued shares are explicit;
- all ownership positions sum to issued shares;
- transfers cannot create or destroy shares;
- issuance changes the denominator and dilutes existing holders;
- voting rights are calculated from valid voting shares and any explicitly modeled class rules;
- economic ownership, voting control, board control, and operational authority remain distinct.

Public exchange trading and market liquidity are out of scope for this slice.

## 12. Group consolidation

Group reporting must avoid double counting:
- subsidiary revenue and costs appear in consolidated operating results;
- intercompany transactions are eliminated in consolidated reporting;
- subsidiary cash is not automatically spendable by the holding company;
- dividends and intercompany loans are explicit transfers with legal/financial constraints;
- minority ownership is reflected where relevant in attributable results.

For the first playable build, consolidated reporting may be simplified, but the distinction between holding cash and subsidiary cash must remain.

## 13. Economic stress and insolvency

When cash is insufficient:
1. attempt valid available financing only if rules permit;
2. delay or stop discretionary project payments according to contracts;
3. apply arrears, supplier, lender, or customer consequences;
4. trigger restructuring or insolvency state only through explicit thresholds and rules.

Avoid immediate game over. Distress should create difficult strategic choices: asset sales, equity issuance, refinancing, cost reduction, restructuring, or loss of control.

## 14. Required accounting invariants

Automated tests must verify:
- opening cash + all ledger deltas = closing cash;
- debt principal changes only through borrowing, repayment, conversion, or write-off;
- interest is not treated as principal repayment;
- capex is not double-counted as operating expense;
- delivered service never exceeds effective capacity or demand;
- energy consumption is consistent with delivered service and efficiency assumptions;
- contract penalties correspond to actual shortfalls or breaches;
- ownership totals equal issued shares;
- cash cannot become negative without an explicit facility or distress state;
- consolidated totals eliminate intercompany duplication.

## 15. Calibration policy

All balance coefficients belong in scenario or tuning data, not scattered constants. Initial values are hypotheses. Use deterministic scenario runs and sensitivity tests to identify:
- whether expansion pays back on a plausible horizon;
- whether efficiency competes credibly with expansion;
- whether energy/equipment bottlenecks can alter strategy;
- whether customer concentration creates meaningful risk;
- whether financing enables recovery without removing consequences.


## 16. Service-level agreements and credits

Fixed-term compute agreements may define a minimum provider reliability and a service-credit rate. Reliability below the contractual threshold triggers a credit against that contract's delivered quarterly revenue; the credit is not applied to unrelated customer contracts. Gross revenue, service credits, and net recognized revenue are reported separately. The first implementation uses a deterministic threshold breach rather than outage-duration simulation; contract-level thresholds and credit rates are scenario data. SLA credits reduce the operating cash contribution in the same quarter and do not retroactively alter prior reports.


## 17. Competitive fixed-term renewals

When a fixed-term agreement enters its renewal window, capable competitors may submit confidential alternative bids. A bid is only available when the rival has enough current spare capacity to serve the entire proposed contract volume. The customer compares the player's renewal price with the credible rival offer; the rival's exact price remains hidden from the player. If the rival wins, the incumbent agreement remains unchanged until its contractual expiry, when the existing expiry and reallocation rules apply. Rival bids are deterministic for a given world seed, quarter, and contract, and never create capacity that the rival does not possess.


## 18. Explicit debt principal repayment

Debt repayment is an explicit quarter command against a named debt instrument. The command reduces both that instrument's outstanding principal and the borrower's debt balance, and is recorded as a financing cash outflow in the borrower's cash bridge. Interest for the current quarter is calculated on opening principal; a repayment therefore changes the next quarter's interest base, not the interest already accrued for the quarter being resolved.

Repayment is funded only from the legal borrower's opening cash. Multiple repayments by one borrower are aggregated for affordability checks, and the total cannot exceed either opening cash or outstanding principal. A holding company cannot repay a subsidiary's debt, and subsidiary cash cannot fund holding debt, unless a separate, explicit intercompany transaction is introduced in a later financial-system increment. Invalid repayment commands reject the entire quarter atomically.


## 19. Contractual amortization and maturity

A debt instrument may define a fixed quarterly principal installment and a final maturity quarter. Scheduled installments are paid automatically during the quarter from the borrower's own cash and are reported separately from voluntary prepayments. In the maturity quarter, all remaining principal becomes due as a balloon repayment, replacing the ordinary installment for that instrument. Voluntary repayment can be added to a scheduled installment only when the combined amount does not exceed outstanding principal.

The quarter is rejected atomically if mandatory scheduled or maturity principal cannot be funded from the borrower's opening cash after the quarter's modeled operating and interest flows are accounted for. Arrears, collateral enforcement, default, and insolvency remain future systems. Interest continues to accrue on opening principal for the quarter, and principal paid during the quarter reduces the following quarter's interest base.


## 22. Independent lender underwriting

A borrower may submit one credit request per quarter, specifying a legal entity, requested principal, term (2–12 quarters), and optional collateral description. Every lender evaluates the request independently using the borrower's own quarterly operating cash contribution, opening cash, outstanding debt service, leverage, and reputation. A holding company with cash but no operating cash flow is not treated as financially identical to its operating subsidiary.

The first credit score is a transparent deterministic 300–850 model. It combines debt-service coverage, cash-to-debt liquidity, debt relative to an annualized cash-flow proxy, and borrower reputation, then maps the result to a coarse rating band. This is an initial game-balance model, not a real-world credit bureau score or a complete underwriting methodology.

Each lender has its own minimum score, base quarterly rate, risk appetite, and maximum loan-to-annual-cash-flow multiple. Eligible lenders independently size the offer against the request, borrower limit, their remaining lending capacity, and their cash liquidity. The quoted quarterly rate adds a score-sensitive risk spread and a lender-policy adjustment. A lender may reject the request or offer less than requested; the report records the decision and reason. Offers become available for acceptance in a later quarter, preserving the distinction between underwriting and funding.

The score, rating, requested amount, offered amount, and quoted rate are recorded in the quarter report. No lender's hidden policy thresholds are exposed through the decision text. Collateral is currently descriptive only: collateral valuation, priority, enforcement, and guarantees remain future work.

## 23. Debt covenants and distress triggers

Newly originated bank loans may carry borrower-level debt-service coverage and debt-to-annual-cash-flow covenants, a grace period, a restriction on additional borrowing, and a contractual rate premium after an uncured breach. Covenant monitoring begins in the quarter after origination, so a newly accepted loan does not retroactively affect the operating period in which it was funded.

At each quarter close, the engine evaluates covenant-bearing debt against the named legal borrower's operating cash contribution, total debt service, and leverage proxy. Each instrument records its consecutive breach streak and current state: compliant, grace, or breached. A cure resets the streak and restores compliant status. If the breach persists beyond the contract's grace period, the rate premium is applied once and any contractual restriction on new borrowing becomes active. That restriction blocks new credit requests, acceptance of outstanding loan offers, and revolving-facility drawdowns for that borrower.

Covenant results are included in the quarter report with the measured coverage and leverage ratios and plain-language breach reasons. A borrower may ask its represented creditor to restructure a loan or waive covenants; the lender evaluates the request using its risk appetite and the borrower's current distress and cash-flow position. Collateral seizure, default declaration, cross-default, arrears, and formal insolvency remain future systems.

The credit market distinguishes committed revolving facilities from new term-loan offers. A lender is represented by a legal organization plus a lending policy record containing remaining lending capacity and a broad risk-appetite profile. A loan offer names one lender, one legal borrower, a principal amount, quarterly interest rate, maturity quarter, expiry quarter, and optional collateral description.

Accepting an available offer creates a new debt instrument for the named borrower and transfers the proceeds from the lender's cash to that borrower's cash. The lender's remaining lending capacity falls by the accepted principal. The financing flow is recorded in the quarter cash bridges; the new loan's interest begins in the following quarter because the current quarter's interest report is calculated before origination. The loan's maturity is enforced by the existing balloon-repayment rule.

Offers may be accepted only once, while available, and no later than their expiry quarter. Acceptance is rejected atomically if the lender lacks either remaining credit capacity or cash liquidity. Multiple acceptances from one lender are aggregated for both checks. An offer is marked expired after its final valid quarter. No subsidiary/holding cash pooling occurs: the loan proceeds, debt balance, and future debt service all belong to the exact named borrower.

The opening scenario includes two illustrative lender offers with different pricing, borrower, collateral language, and risk appetite. Dynamic lender underwriting can also generate additional offers from borrower-specific credit assessments and each bank's own risk policy. Negotiated covenants, refinancing, and creditor-approved restructuring are implemented; collateral enforcement, arrears, default, and lender competition remain subsequent increments.

A debt instrument with a committed facility limit may be drawn in an explicit quarter command. The drawdown increases the facility principal and the legal borrower's cash and debt balances by the same amount. Aggregate outstanding principal may never exceed the committed limit. Term loans without a facility limit cannot be redrawn.

Drawdown proceeds are recorded as a financing cash inflow in the borrower's cash bridge. They are applied after the current quarter's interest report is calculated, so new borrowing affects interest from the following quarter. A drawdown cannot fund another command in the same quarter: affordability checks for projects and principal repayments use opening cash. This avoids implicit ordering and makes financing decisions auditable. The facility's undrawn commitment is the difference between its limit and outstanding principal.


## 24. Debt refinancing

A borrower may replace one outstanding debt instrument with an available lender offer for the same legal entity. The replacement offer must cover the old principal plus a one-time refinancing fee (default 100 basis points; configurable from 0 to 1,000 basis points). The old instrument is settled in full and retained in the ledger with zero principal; the new instrument records its lender, principal, rate, maturity, and covenant package.

Refinancing is one atomic quarter action. The offer is consumed, the new lender's cash and capacity are debited, and the old creditor receives the payoff when it is represented in the lender system. The old lender's available capacity is restored by the principal returned. The borrower receives only the net proceeds after payoff and fee. The debt ledger and legal borrower's debt balance are reconciled in the same transaction. Refinancing replaces an existing liability rather than counting as a separate ordinary loan acceptance, so an active covenant restriction does not by itself prevent a genuine replacement transaction. A new covenant package begins monitoring in the quarter after refinancing; the current quarter's interest remains based on opening debt.

The quarter report records the old and new instrument IDs, principal settled, fee, and net cash released. The current implementation does not yet model early-termination penalties beyond the explicit refinancing fee, collateral release/re-registration, or a lender's right to block a payoff.

## 25. Creditor-approved restructuring

A borrower with debt originated by a represented lender may submit one restructuring proposal per instrument in a quarter. It may request a later maturity, a lower quarterly interest rate, a lower existing scheduled principal installment (including a temporary zero-principal period), and/or a covenant waiver. A proposal cannot increase principal, raise the rate, accelerate maturity, or increase scheduled amortization.

The creditor evaluates the proposal after the current quarter's operating and covenant report. Growth lenders are most willing to restructure distressed or weak-credit borrowers; balanced lenders require a covenant breach or materially weak credit; conservative lenders require an active covenant breach and either positive operating cash contribution or a package that both extends maturity and reduces the rate. Rejected proposals leave the instrument unchanged. Accepted terms begin after the current quarter report, preserving the original quarter's interest and scheduled-payment calculation.

A covenant waiver removes the instrument's covenant terms and clears its breach streak/status. Any contractual rate premium already applied remains part of the loan rate unless the approved restructuring explicitly reduces that rate. The report records the lender's decision, previous and revised terms, waiver outcome, and reason. Restructuring does not erase principal or silently move cash between the holding company and a subsidiary.

These are initial deterministic negotiation rules for gameplay, not a full legal workout model. Lender-specific negotiation history, collateral enforcement, guarantees, cross-default, arrears, insolvency, and asset seizure remain future work.


## 26. Scheduled principal arrears and payment default

Scheduled and maturity principal obligations no longer abort an otherwise valid quarter merely because the legal borrower lacks opening cash. The engine records the unpaid amount as principal arrears while keeping it inside the existing principal balance; arrears are not double-counted as new debt. The borrower is tested independently, so holding-company liquidity cannot silently cover a subsidiary obligation.

Mandatory payments are allocated in deterministic debt-ledger order using the borrower's remaining opening cash after voluntary repayments and holding project reserves. Each instrument's installment is all-or-nothing, but an unaffordable installment does not prevent a later, smaller obligation from being paid if funds remain. A missed contractual principal payment increments the instrument's consecutive overdue-quarter counter. One missed quarter produces an overdue status; two consecutive missed quarters produce a defaulted status. Paying the scheduled obligation cures the arrears and resets the counter. The quarter report exposes the unpaid due amount, cumulative arrears, duration, and resulting status. Voluntary principal repayments remain strict: an explicitly requested repayment that the borrower cannot fund still rejects the command atomically.

This is the first distress layer, not enforcement. Interest arrears, acceleration, cross-default, creditor collection actions, collateral valuation/enforcement, insolvency proceedings, and asset transfers are intentionally deferred to subsequent increments. The two-quarter default threshold is a provisional gameplay rule, not a claim about real loan documentation.


## 27. Interest accrual, payment, and arrears

Interest is calculated on each instrument's opening-quarter principal at its contractual quarterly rate. Existing interest arrears are tracked separately from principal and do not compound: no interest is charged on unpaid interest in this first implementation.

For each instrument, the quarter's interest obligation is the sum of opening interest arrears and newly accrued interest. Cash servicing follows the deterministic debt-ledger order. Within each instrument, interest is paid before scheduled or maturity principal. Available liquidity is drawn only from the exact legal borrower's cash after holding-company project reserves and explicitly committed voluntary principal repayments. Cash is not pooled between a holding company and its subsidiaries.

Any unpaid interest is carried in `arrearsInterestCents`; it does not increase principal or the organization's reported principal debt balance. A debt instrument is overdue when either contractual principal or interest remains unpaid. The existing consecutive-missed-quarter rule applies to the combined contractual debt-service obligation: one consecutive missed quarter is overdue, two are payment default. A quarter in which all currently due interest and principal are paid cures the instrument's payment arrears and resets its overdue counter.

Interest expense remains an accrual measure in the quarter report, while interest cash paid is a separate cash-flow measure. The borrower's cash bridge must deduct only the amount actually paid, not the full accrued amount. The lender receives the same paid amount as cash income; unpaid interest creates no lender cash receipt. This keeps both sides of the transaction balanced and prevents the engine from creating liquidity by recording unpaid interest as paid.

The quarter report exposes accrued interest, opening interest arrears, interest paid, closing interest arrears, and any missed contractual service. All amounts use integer cents and deterministic rounding. Refinancing or restructuring must explicitly preserve or settle accrued interest arrears; a new instrument must not silently erase them. Interest arrears are not capitalized into principal in this increment.

This increment does not yet implement interest-on-interest, late fees, acceleration, cross-default, collection actions, collateral enforcement, or insolvency.
