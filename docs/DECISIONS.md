# Decision Log

This file records important decisions and their rationale. Add new entries rather than silently rewriting the history. If a decision is superseded, mark it as superseded and link the replacement entry.

## D-001 — Hybrid grand-strategy direction

**Status:** Accepted  
**Decision:** Popoly follows the hybrid model: it begins as a corporate strategy game and gradually expands into a broader sandbox in which the player can influence regions, institutions, and the wider world.

**Rationale:** This preserves a clear initial identity while allowing the long-term ambition of a world-shaping grand strategy.

## D-002 — Near-future setting

**Status:** Accepted  
**Decision:** Use an alternative near-future setting around 2035.

**Rationale:** It supports recognizable technology, corporate competition, infrastructure dependencies, and political-economic tensions without requiring a direct simulation of current real-world entities.

## D-003 — Single-player first

**Status:** Accepted  
**Decision:** Build and validate the single-player experience first. Keep future multiplayer in mind architecturally, but defer networking and server infrastructure.

**Rationale:** The core simulation and gameplay loop must be compelling before multiplayer complexity is justified.

## D-004 — Hardcore depth with readable UX

**Status:** Accepted  
**Decision:** The simulation may be complex, but the interface must explain the situation, relevant information, choices, and consequences clearly.

**Rationale:** Difficulty should come from strategic decisions and interacting systems, not from confusing navigation or opaque presentation.

## D-005 — Vertical slice before broad expansion

**Status:** Accepted  
**Decision:** Build a small but complete playable slice before implementing the full world and all planned systems.

**Rationale:** This reduces risk and gives us an early test of whether the core loop is genuinely engaging.

## D-006 — No premature feature commitments

**Status:** Accepted  
**Decision:** Military warfare, huge production chains, individual employee simulation, thousands of actors, multiplayer, and blockchain are not part of the initial foundation.

**Rationale:** These features can be evaluated later if they strengthen the proven core game.


## D-007 — Existing holding-company start

**Status:** Accepted  
**Decision:** The player begins as the leader of an existing holding company controlling an operating company, rather than founding the group from zero.

**Rationale:** This puts the player immediately into strategic management and lets the opening focus on inherited assets, obligations, control, and choices.

## D-008 — Mixed interconnected industry scope

**Status:** Accepted  
**Decision:** The first slice connects compute infrastructure, energy, semiconductors/equipment, and AI/digital-service demand.

**Rationale:** These dependencies create meaningful bottlenecks without requiring a broad multi-industry simulation.

## D-009 — Guided opening with sandbox continuation

**Status:** Accepted  
**Decision:** The eight-quarter opening scenario can continue as a sandbox using the same campaign state.

**Rationale:** The scenario teaches and tests the core loop without imposing an artificial end to an interesting campaign.

## D-010 — Leadership capacity as the strategic action constraint

**Status:** Accepted  
**Decision:** Major initiatives compete for limited executive attention; routine operations continue automatically.

**Rationale:** This models the finite bandwidth of a holding-company leadership team rather than an abstract action-point counter.

## D-011 — Estimates-based rival intelligence

**Status:** Accepted  
**Decision:** The player receives public information plus estimates of competitor conditions, with confidence and freshness indicators. Hidden world truth remains separate from player knowledge.

**Rationale:** Uncertainty becomes a strategic resource while preserving fair and explainable information boundaries.


## D-013 — Unified lender funding limits and debt-service coverage

**Status:** Accepted  
**Decision:** All lender-funded outflows in one quarter share the same opening cash and lending-capacity budget, regardless of whether they originate from revolving drawdowns, new loan acceptance, or refinancing. A single debt cannot be drawn and refinanced, or accelerated and restructured, in the same quarter. Credit assessment and covenant DSCR use one target-quarter debt-service calculation that includes arrears and due balloon principal while excluding settled debt.

**Rationale:** The simulation must not create lender liquidity through command ordering or understate borrower obligations by omitting overdue or maturity payments.


## D-012 — Lender-funded revolving facility drawdowns

**Status:** Accepted  
**Decision:** A revolving-facility drawdown is funded by the facility's named lender. The lender's cash and remaining lending capacity decrease by the draw amount; the legal borrower's cash, debt balance, and facility principal increase by the same amount. The draw is permitted only when the facility commitment, lender capacity, and lender liquidity all cover it. Repayment restores the lender's cash and available capacity.

**Rationale:** Revolving credit must preserve double-entry cash movement and remain consistent with the existing term-loan acceptance and principal-repayment flows. The committed facility limit and the lender's general lending capacity remain separate constraints.


## D-012 — Lender-funded revolving facility drawdowns

**Status:** Accepted  
**Decision:** A revolving-facility drawdown is funded by the facility's named lender. The lender's cash and remaining lending capacity decrease by the draw amount; the legal borrower's cash, debt balance, and facility principal increase by the same amount. The draw is permitted only when the facility commitment, lender capacity, and lender liquidity all cover it. Repayment restores the lender's cash and available capacity.

**Rationale:** Revolving credit must preserve double-entry cash movement and remain consistent with the existing term-loan acceptance and principal-repayment flows. The committed facility limit and the lender's general lending capacity remain separate constraints.
