# Systems Design Outline

**Status:** System boundaries and intended interactions; detailed mechanics are not yet specified.

## Design rule

Every major system must create decisions for the player and affect at least one other system. A system that produces only a disconnected score, menu, or passive bonus needs to be reconsidered.

## 1. Corporate economy

Companies should have understandable economic identities and operate beyond the player's direct control.

Potential elements include assets, liabilities, cash flow, profitability, and financing; products or services, customers, and market position; workforce capability and leadership; research, intellectual property, and operational efficiency; ownership, voting rights, control, and governance; contracts, partnerships, acquisitions, restructuring, and insolvency.

Ownership percentage, practical control, contractual influence, and reputation must not be treated as interchangeable.

## 2. Markets and macroeconomy

Markets connect companies, regions, capital, resources, and expectations.

Potential layers include global macroeconomic conditions; regional economic conditions; sector-level supply, demand, and competition; company-level performance and expectations; and financial markets and access to capital.

Prices should have a defensible relationship to fundamentals, liquidity, information, and expectations. Avoid arbitrary price movement as the primary simulation model.

## 3. Technology and research

Technology should change what actors can do and what the world depends on.

Initial candidate domains: artificial intelligence and compute; semiconductors; energy; robotics and automation; biotechnology; cybersecurity; telecommunications; aerospace and advanced materials.

Potential mechanics include research capacity, talent, facilities, patents, licensing, standards, leaks, technology diffusion, and dependencies. The final technology tree and pacing remain open.

## 4. Politics, states, and institutions

States and institutions should have their own interests and constraints.

Potential tools and pressures include taxes and subsidies; public procurement and strategic contracts; regulation and antitrust; lobbying and political relationships; export controls and sanctions; investigations and compliance; legitimacy, public opinion, and institutional trust.

Political influence should create consequences and counter-reactions, not function as a universal spend-currency button.

## 5. Intelligence and information

Information is a strategic resource. The player may have incomplete, stale, misleading, or uncertain knowledge.

Potential activities include open-source intelligence and market research; network building and human intelligence; industrial espionage and technology theft; counterintelligence and defensive security; leaks, exposure, sabotage, and disinformation.

Operations should have preparation, capability requirements, risk, attribution, and consequences. Avoid making espionage a simple percentage roll detached from the world.

## 6. Infrastructure and strategic resources

Infrastructure can create power even without owning the companies that sell the final product.

Candidate dependencies include energy generation and grids; data centers and compute capacity; semiconductor fabrication; logistics and transport; telecommunications; critical minerals and advanced materials; industrial capacity and specialist facilities.

Scarcity, geographic concentration, resilience, and dependency should matter.

## 7. People and organization

Leadership and specialist teams should provide strategic capabilities without forcing the player to micromanage every employee.

Potential roles include CEO / operations; finance; technology and research; security and intelligence; legal and compliance; government and public relations.

Traits may include competence, experience, loyalty, ambition, networks, and risk tolerance. Personnel systems should create meaningful organizational choices, not an endless staffing spreadsheet.

## 8. Cross-system interactions

Examples of the intended systemic connections:

- A compute shortage constrains AI research, raises costs, and makes data-center infrastructure strategically valuable.
- A breakthrough increases company productivity, attracts investment, changes market expectations, and may trigger regulatory scrutiny.
- A supply-chain dependency creates leverage but also exposes the controlling actor to disruption and political pressure.
- An intelligence leak can change investor confidence, damage partnerships, invite investigations, and alter a rival's strategy.
- A public contract can accelerate growth while creating compliance obligations and dependence on government policy.
- A reputation crisis can make financing, hiring, acquisitions, and political access more difficult.

These are examples of design intent, not implemented mechanics.

## 9. Scope discipline

Start with a small number of systems that create a complete and interesting loop. Add depth only when playtests show that it improves decisions, emergent outcomes, or strategic variety.


## Implemented engine layer — current branch

The first playable engine slice now includes a transactional quarter resolver, a scenario-driven strategic initiative catalogue, project progression, and a deterministic autonomous-actor pass.

### Strategic initiatives and projects
- Initiative definitions own their leadership cost, initial cash commitment, duration, and completion effect.
- Quarter commands can launch multiple initiatives, subject to the holding's leadership capacity and opening cash.
- Active projects progress automatically; newly launched projects do not lose a quarter of duration on their launch turn.
- Completion effects currently cover physical capacity, equipment commissioning, firm power reservations, operational resilience, and market-study intelligence.
- Project costs are charged to the holding entity. Subsidiary operating cash remains legally separate.
- The quarter report records leadership usage, launches, completions, and project cash commitments.

### Autonomous actor pass
- Asterion's true compute demand grows within the scenario's forecast band. Fixed contracted volumes remain protected; only flexible demand is reallocated between NodeWorks, Kestrel, and other regional providers.
- Asterion's flexible allocation weighs provider price, reliability, available capacity, and supplier concentration. Kestrel autonomously reprices its offer against NodeWorks when it has spare capacity, while protecting price as its own utilization approaches the operational ceiling. Its commercial action is reported without exposing the rival's exact offer. The revised hidden offer is applied before Asterion reallocates flexible demand, so price competition affects the next-quarter workload and revenue path. Capacity limits are enforced, while rival allocation quantities remain hidden from the player unless separately researched.
- Changes to NodeWorks' flexible allocation update its contract volume and next-quarter workload. The public event log reports that the customer rebalanced providers without exposing rival operating data.
- The player can submit a price offer for NodeWorks' flexible Asterion contract. Asterion accepts, counters, or rejects against a private reservation price; accepted rates take effect in the next quarter and negotiation outcomes are recorded in the quarter report.
- Fixed customer contracts carry an end quarter, a renewal-notice window, and a minimum guaranteed workload. The quarter report identifies contracts entering that window. Renewal proposals negotiate price, guaranteed volume, and duration against private customer thresholds; accepted terms take effect next quarter. Asterion also tracks a private relationship/satisfaction score from NodeWorks' delivered workload and SLA history. This history shifts its private renewal price ceiling, minimum volume, and flexible-service reservation price; it is not exposed as an exact player-facing value. SLA breaches and material fixed-contract underdelivery reduce NodeWorks reputation. Player intelligence receives a bounded, low-confidence renewal-risk estimate for each fixed contract, never the customer's true thresholds. A contract remains in force through its end quarter and expires only after that quarter's service has been reported if no renewal was accepted. Expired NodeWorks volume is removed from its revenue base and Asterion reallocates the uncovered commitment to Kestrel where capacity permits, with the remainder returning to flexible sourcing.
- Kestrel can independently initiate a capacity expansion pipeline only after reserving 2 MW-equivalent from Silicon Vein's delivery pool. NodeWorks' equipment initiative reserves 6 MW-equivalent two quarters ahead; the regional pool is capped at 10 MW-equivalent per delivery quarter after NodeWorks' standing 2 MW allocation. Kestrel's project also requires 2 MW of immediate firm power at commissioning.
- Solara adjusts regional energy pricing in response to grid utilization.
- The Infrastructure Authority can open a concentration review when the regional grid crosses its review threshold.
- Actor truth remains in hidden world state. The quarter report exposes concise action summaries, not hidden metric values.
- Silicon Vein orders are tracked by buyer, quantity, placement quarter, delivery quarter, and status. Reservations cannot exceed the quarterly pool; player and rival orders compete for the same delivery windows.
- Actor outcomes are deterministic for the same world seed and quarter.


### Integration validation
- A seeded twelve-quarter unattended run validates the world state after every quarter, including actor metrics, entity cash/debt integer safety, customer demand growth, contract expiries, and intelligence cleanup.
- An end-to-end renewal scenario renews NodeWorks' larger anchor contract, loses the smaller contract to Kestrel's confidential competing bid, serves the final contracted quarter, expires the agreement, and verifies the 5 MW guaranteed-volume transfer and next-quarter contract/revenue ledger.
- Customer relationship changes consume the resolved quarter's actual service snapshot. Renewal terms accepted after the report cannot rewrite the service history for the quarter that has already elapsed. Relationship scores stop drifting upward when no fixed customer agreement remains, and renewal-risk estimates are removed when their contracts expire.

### Credit market foundation

- Lenders are legal organizations with separate liquidity, remaining lending capacity, base rates, minimum credit scores, risk appetite, and cash-flow lending limits.
- A borrower may request credit once per quarter. Every lender independently assesses the exact legal borrower using operating cash flow, debt service, leverage, liquidity, and reputation.
- The initial deterministic credit score maps to a 300–850 score and rating band. Lender policy then determines eligibility, maximum offer size, and a score-sensitive quarterly interest rate.
- Decisions may be offers, reduced offers, or rejections with an auditable reason. Offers are created after the current quarter report and cannot be accepted until a later quarter.
- Accepting an offer transfers cash from lender to the named borrower, consumes lender capacity, and creates debt against that borrower. Holding and subsidiary balances remain legally separate.
- Lender liquidity and remaining credit capacity are both checked; multiple acceptances are aggregated and the quarter rejects atomically if either limit is exceeded.
- New loan interest begins in the following quarter; maturity uses the existing balloon principal repayment mechanism. Unaccepted offers expire after their final valid quarter.
- Newly originated loans can carry DSCR and leverage covenants, grace periods, a borrowing restriction, and a one-time contractual rate step-up after an uncured breach.
- Covenant monitoring starts in the quarter after origination. The engine records compliant/grace/breached state, consecutive breach streaks, measured ratios, and breach reasons in the quarter report.
- A cure resets the breach streak and restores compliance. An active borrowing restriction blocks new credit requests, acceptance of other offers, and revolving drawdowns for the same legal borrower.
- Borrowers can refinance an existing instrument using an available offer for the same legal entity. The replacement loan must cover old principal plus an explicit fee; the old creditor is repaid, the new lender funds the replacement, and the net cash release/debt-ledger changes commit atomically.
- Newly originated debt stores its lender identity. A borrower can ask that creditor to extend maturity, reduce the rate or scheduled principal, or waive covenants. The lender accepts/rejects deterministically from its risk appetite and the borrower's distress/credit condition; approved terms apply after the current quarter report.
- Refinancing and restructuring outcomes are exposed in quarter-report lines.
- Scheduled and maturity principal shortfalls are recorded per debt instrument as arrears without double-counting principal. Interest is serviced before principal within each instrument; borrower liquidity follows deterministic debt-ledger order and unpaid higher-priority installments cannot be leapfrogged. Principal repayments are credited to the named lender and restore its available lending capacity.
- One consecutive missed contractual interest or principal-service quarter produces overdue status; two produce payment default. Paying all currently due contractual service cures arrears and resets the overdue counter. Defaulted borrowers are blocked from additional credit requests, loan acceptances, and revolving drawdowns.
- The quarter report exposes accrued interest, opening and closing interest arrears, actual interest paid, creditor identity, missed contractual service, unpaid principal due, overdue duration, and payment status. Interest expense is accrued separately from cash paid; lenders receive only actual cash remittances. Interest arrears are tracked separately from principal and included in contractual debt-service status; interest-on-interest is not charged. Acceleration, cross-default, creditor collection, collateral enforcement, insolvency, and asset transfers remain future work.

- Lenders are legal organizations with separate lending-capacity and risk-appetite records.
- Scenario-originated loan offers identify a single borrower and state principal, quarterly rate, maturity, expiry, and optional collateral description.
- Accepting an offer transfers cash from lender to borrower, consumes lender capacity, and creates debt against that exact borrower. Holding and subsidiary balances remain legally separate.
- Lender liquidity and remaining credit capacity are both checked; multiple acceptances are aggregated and the quarter rejects atomically if either limit is exceeded.
- New loan interest begins in the following quarter; maturity uses the existing balloon principal repayment mechanism. Unaccepted offers expire after their final valid quarter.
- Dynamic underwriting, borrower credit ratings, covenant monitoring, refinancing, basic creditor-approved restructuring, principal/interest arrears, and payment default are implemented. Collateral enforcement, lender relationship history, acceleration, cross-default, and insolvency remain future systems.

This is an initial simulation layer, not the final economic model. In particular, deeper contract negotiations and renewals, financing choices, project dependencies, regulatory consequences, and richer information-quality mechanics remain future work.


### Contractual cross-default

Cross-default is instrument-specific and opt-in through the contract. It is scoped to debts of the same legal borrower; it does not propagate through ownership or corporate groups. The affected instrument retains its own payment status and arrears, while a separate source-debt reference records the contractual cross-default. Cure of the triggering default releases the derived status when no other qualifying trigger remains. Acceleration is a distinct creditor action and is not automatic.


### Creditor acceleration

A lender may elect to accelerate only its own outstanding debt after payment default or a contractual cross-default. The creditor issues a notice in the current quarter; the full outstanding principal becomes due in the next quarter. The obligation uses the existing interest-first, deterministic debt-service waterfall and principal-arrears accounting. Acceleration is reported separately and does not itself create a second debt balance. Ordinary refinancing is blocked for defaulted or accelerated instruments, and restructuring is blocked once notice has been issued.
