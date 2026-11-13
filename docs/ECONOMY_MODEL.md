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

The quarter is rejected atomically if mandatory scheduled or maturity principal cannot be funded from the borrower's opening cash after the quarter's modeled operating and interest flows are accounted for. The first implementation does not yet model arrears, covenant breaches, lender grace periods, or refinancing; those belong to the subsequent credit-facility and distress systems. Interest continues to accrue on opening principal for the quarter, and principal paid during the quarter reduces the following quarter's interest base.
