# Vertical Slice — First Playable Scenario

**Status:** Proposed design for review; not yet a locked implementation specification  
**Date:** 2026-11-13  
**Purpose:** Define the smallest playable Popoly experience that can test whether its central strategic loop is engaging.

## 1. What this slice must prove

The first playable version must prove five things:

1. The player feels like the leader of a corporate group, not a stock-market trader.
2. Companies have understandable operating economics and can succeed or fail for identifiable reasons.
3. At least one rival makes independent decisions that create pressure and opportunity.
4. A bottleneck or dependency connects companies and turns business choices into strategic trade-offs.
5. The consequences of one decision persist and change the next decision.

This is a deliberately narrow experiment. It is not a miniature implementation of every planned Popoly system.

## 2. Scenario premise

**Working title:** The Compute Bottleneck  
**Setting:** An alternative near-future region in 2035.  
**Campaign length for the prototype:** Eight quarterly periods, with an option to continue in sandbox mode after the evaluation window.

Demand for AI computing is growing faster than regional infrastructure can expand. Data-center operators compete for customers, power capacity, financing, skilled staff, and permits. A major customer is preparing to expand, while the regional authority is concerned about energy resilience and concentration of critical infrastructure.

The player leads a small corporate group that controls a regional data-center operator. The group has enough capital and credibility to pursue a few different strategies, but not enough resources to do everything.

The central question is not simply "How do I make the most money?" It is: **Which dependency should I control, reduce, or turn into leverage before my competitors do?**

## 3. Initial world

Keep the first scenario to a single region and a small number of consequential actors.

### Player organization

**Meridian Group** — a small holding company with a controlling stake in **NodeWorks**, a regional data-center operator.

The player can allocate holding-company capital, set strategic priorities for NodeWorks, negotiate or pursue partnerships, and decide whether to prioritize capacity, efficiency, customer relationships, resilience, or expansion.

The player does not directly control every external company or institution.

### Independent companies

**Kestrel Compute** — a rival data-center operator. It competes for customers, power allocation, talent, and financing. Its strategy should respond to market conditions and the player's visible moves.

**Asterion AI** — a fast-growing AI company and a major potential customer of regional compute capacity. It can sign contracts, diversify suppliers, delay expansion, or invest in its own infrastructure.

### External constraints and institutions

**Regional power network** — a scarce infrastructure input. Available capacity, price, reliability, and expansion lead times constrain data-center growth.

**Regional Infrastructure Authority** — an institutional actor responsible for permits, resilience requirements, and a limited public procurement or strategic infrastructure program. It has its own objectives and can reject or condition proposals.

These may initially be modeled with compact rules rather than full organization simulations.

## 4. The first strategic loop

Each quarter follows a readable sequence:

1. **Situation report:** review company performance, demand, capacity, cash, debt, power constraints, contracts, rival moves, and known risks.
2. **Choose priorities:** decide where the holding company should commit capital and leadership attention.
3. **Issue strategic directives:** invest, expand, improve efficiency, negotiate, pursue a contract, strengthen resilience, or gather information.
4. **Resolve the world:** companies and institutions act; contracts, capacity, demand, operating results, and risks update.
5. **Review consequences:** see what changed, why it changed, what is uncertain, and which new choices are available.

The exact interface and turn-resolution order can evolve, but the player must be able to understand cause and effect.

## 5. Candidate player decisions

The initial action set should be small. Each option must compete for scarce capital, time, capacity, or political goodwill.

- **Expand compute capacity:** invest in additional data-center capacity. This may increase future revenue, but requires capital, power, permits, staff, and construction time.
- **Secure an energy agreement:** negotiate a long-term power contract or reserve capacity. This may reduce cost volatility or unlock expansion, but creates commitments and dependence.
- **Improve operational efficiency:** invest in cooling, automation, utilization, or energy efficiency. This may improve margins or free scarce power capacity, but competes with growth investment.
- **Win or renew a major customer contract:** pursue Asterion AI's demand. A large contract can stabilize revenue but may create customer concentration and service obligations.
- **Build resilience:** invest in backup power, cybersecurity, or operational redundancy. This may reduce disruption risk and improve institutional confidence, but may not produce immediate revenue.
- **Acquire or partner:** negotiate a stake, joint venture, or commercial partnership with another actor. The deal must have a clear cost, strategic benefit, and risk.
- **Develop intelligence:** pay for market research or investigate a rival's capacity, finances, or plans. Information may be incomplete, delayed, or wrong.

Do not expose every option as an equally available button every quarter. Availability should depend on money, relationships, capabilities, timing, and the state of the world.

## 6. Economic model for the slice

Use a consistent unit system. Recommended presentation unit: **USD millions (M)** for company-level financial reporting. Internal calculations may use integer base currency units to avoid floating-point accounting drift.

At minimum, each operating company needs:

- cash and debt;
- quarterly revenue;
- operating costs, with energy as a visible component;
- capital expenditure and committed projects;
- compute capacity and utilization;
- contracted and uncontracted demand;
- service reliability;
- workforce or specialist capacity as an abstract constraint;
- ownership and voting rights.

A simple first-pass operating model can be:

- delivered service is limited by both installed capacity and available power;
- revenue comes from delivered service and realized contract / market prices;
- operating costs include power, staffing, maintenance, and overhead;
- operating result is revenue minus operating costs;
- cash changes through operating result, capital expenditure, financing, debt service, and transactions;
- projects take time to complete and may be delayed by permits, equipment, power, or staffing.

This is an initial model, not a commitment to a detailed real-world data-center simulator. Every financial flow must have a defined meaning and consistent units.

### Accounting invariants

- A company cannot spend cash it does not have unless it has an explicit financing facility or approved borrowing.
- Debt principal and interest are distinct.
- Revenue, operating profit, cash flow, and company valuation are not interchangeable.
- Capital expenditure affects cash when paid; it should not be treated as an ordinary operating expense.
- Contracted demand cannot exceed what the company can deliver without penalties, shortages, or customer loss.
- Ownership and voting rights cannot exceed issued shares or validly defined rights.
- Every significant cash movement should have an explainable source and destination.

## 7. Ownership and corporate control

The slice should introduce a proper ownership ledger, but it does not need a full public stock exchange.

Represent issued equity and the holdings of owners explicitly. Separate:

- economic ownership;
- voting rights;
- board or governance control;
- contractual influence;
- operational authority.

A controlling stake should confer defined governance rights, not magical direct control over every outcome. Minority owners, management, debt covenants, and regulators can constrain decisions.

Do not carry over the prototype's share-price impact formula or its current control calculation.

Public-market trading, order books, market liquidity, IPOs, hostile takeovers, complex dilution, and derivatives are outside the first slice unless a specific playtest need justifies one.

## 8. Rival and institutional behavior

The rival does not need human-level general intelligence. It does need a coherent goal and a small decision policy.

Kestrel Compute should:
- evaluate demand, its available capacity, cash, and debt;
- choose between expansion, efficiency, customer acquisition, or conserving capital;
- respond to major player moves when relevant;
- sometimes make mistakes or take risks;
- produce outcomes that can be explained from its incentives and information.

Asterion AI should:
- value price, reliability, available capacity, and supplier concentration;
- consider signing with one provider or splitting demand;
- change plans when costs, reliability, or market conditions change.

The Regional Infrastructure Authority should:
- value resilience, energy feasibility, regional development, and concentration risk;
- apply transparent permit or procurement conditions;
- react to credible failures or excessive dependency.

These actors should not simply receive random bonuses or mirror the player's actions.

## 9. Information and uncertainty

The player should have access to reliable information about their own group, but not omniscience about competitors.

For the first slice, distinguish:
- **Known:** own cash, contracts, capacity, and realized financial results.
- **Reported:** public filings, announced projects, published prices, and authority decisions.
- **Estimated:** rival utilization, cash runway, expansion progress, and future demand.
- **Unknown:** confidential negotiations, internal strategy, undisclosed liabilities, or covert actions.

Reports should show confidence or age where useful. The first slice can use simple information quality values; it does not need a full intelligence network yet.

## 10. Time and action capacity — proposal

**Recommended prototype time step: one quarter.**

A quarter is long enough for financial performance and strategic projects to matter, while remaining understandable and easy to compare across actors.

Avoid carrying over the prototype's fixed action-point system as a settled design. For the first test, evaluate a limited **leadership / initiative capacity** model: the holding company can sponsor only a small number of major initiatives in a quarter, while recurring operations resolve automatically.

This is a prototype constraint to create trade-offs, not a final rule. Compare it in playtests with a model based on capital, project capacity, and decision lead times rather than hard action slots.

## 11. What the player should experience over eight quarters

This is an intended pressure curve, not a scripted sequence:

- **Opening:** understand NodeWorks, its cash position, power limits, customer exposure, and the rival's visible position.
- **Early game:** choose whether to prioritize capacity, efficiency, a major customer, or energy security.
- **Middle:** a rival move, power constraint, permit decision, contract opportunity, or demand shift forces adaptation.
- **Late slice:** earlier investments create advantages or liabilities. The player may be stronger financially but more exposed, or smaller but more resilient and strategically positioned.
- **Evaluation:** the player can explain the path taken, identify the consequences of important choices, and see plausible alternative strategies.

Do not guarantee that the player wins. The test is whether setbacks remain interesting and whether the world reacts credibly.

## 12. What is deliberately excluded

Do not implement these in the first slice:

- a full world map or multiple continents;
- dozens of sectors and hundreds of companies;
- detailed employee-by-employee simulation;
- a complete public stock exchange;
- large technology trees;
- full political parties, elections, or diplomacy;
- military warfare;
- extensive espionage operations;
- multiplayer, accounts, or network synchronization;
- a large random event catalogue.

A system can be represented by a small abstraction if it creates a necessary constraint. For example, power availability can be a regional capacity variable before it becomes a full infrastructure simulation.

## 13. Technical acceptance criteria

The first slice is not ready for a visual polish pass until:

- the simulation can advance one quarter without React or Zustand;
- all player actions are validated against explicit rules;
- simulation randomness is seeded or injected for reproducible tests;
- core financial and ownership invariants have automated tests;
- company outcomes can be traced to inputs and decisions;
- rival decisions are generated from a stated policy and current information;
- a campaign can be saved and loaded, or a clearly scoped persistence decision is documented before longer playtests;
- the UI can explain major changes in plain language.

## 14. Gameplay acceptance criteria

The slice should be playtested with multiple strategies, not just one intended solution.

A successful test should show that:
- at least three distinct strategic approaches are viable;
- no single action dominates all alternatives;
- the player faces at least two meaningful trade-offs per few quarters;
- rival and institutional behavior can change the player's plan;
- investment consequences persist across several quarters;
- the player can understand why a company improved or deteriorated;
- a setback creates a strategic problem rather than ending the campaign immediately.

If these criteria fail, revise the core loop before adding more content.

## 15. Open questions for collaborative approval

1. Should the player begin with a controlling stake in an existing operating company, or found the holding and acquire its first company during the opening?
2. Should the first scenario emphasize infrastructure and compute, as proposed, or should it focus on a different technological bottleneck?
3. Should the eight-quarter scenario be a guided opening campaign, a sandbox test map, or both?
4. Should major initiatives be limited by leadership capacity, project slots, or only by resources and time?
5. How visible should the rival's internal financial position be: public reports only, estimates, or selectable intelligence actions?

These questions should be resolved before implementation. The scenario and mechanics above are a concrete proposal for discussion, not silent permanent commitments.
