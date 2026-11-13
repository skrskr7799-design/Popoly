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

- Lenders are legal organizations with separate lending-capacity and risk-appetite records.
- Scenario-originated loan offers identify a single borrower and state principal, quarterly rate, maturity, expiry, and optional collateral description.
- Accepting an offer transfers cash from lender to borrower, consumes lender capacity, and creates debt against that exact borrower. Holding and subsidiary balances remain legally separate.
- Lender liquidity and remaining credit capacity are both checked; multiple acceptances are aggregated and the quarter rejects atomically if either limit is exceeded.
- New loan interest begins in the following quarter; maturity uses the existing balloon principal repayment mechanism. Unaccepted offers expire after their final valid quarter.
- Dynamic underwriting, borrower credit ratings, negotiated covenants, collateral enforcement, refinancing, and lender distress behavior are not implemented yet.

This is an initial simulation layer, not the final economic model. In particular, deeper contract negotiations and renewals, financing choices, project dependencies, regulatory consequences, and richer information-quality mechanics remain future work.
