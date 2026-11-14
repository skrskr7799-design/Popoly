# Core Loop Specification — Vertical Slice

**Status:** Design baseline based on accepted player decisions; numerical balance remains provisional.  
**Scenario:** The Compute Bottleneck  
**Time model:** Quarterly  
**Campaign:** Eight-quarter guided opening, then optional sandbox continuation.

## 1. Player role and starting position

The player is the executive authority of Meridian Group, an existing holding company. At campaign start, Meridian controls NodeWorks, a regional compute-infrastructure operator, through a controlling equity stake.

The player is not the day-to-day manager of every subsidiary. The player sets group priorities, allocates capital, sponsors strategic initiatives, appoints or replaces senior leadership where supported, and decides how the group responds to external pressure.

Starting ownership, cash, debt, assets, contracts, and reputation must be scenario data, not hard-coded assumptions in simulation rules. Exact starting values are balance parameters to be playtested.

## 2. Initial sector network

The slice uses four connected domains, not four fully simulated industries:

1. **Compute infrastructure:** data-center capacity, utilization, reliability, customer delivery.
2. **Energy:** regional availability, price, reliability, reserved capacity, expansion constraints.
3. **Semiconductors and equipment:** accelerator/server availability, procurement lead time, cost, supplier concentration.
4. **AI and digital services:** compute demand, customer contracts, workload growth, supplier diversification.

The dependency chain is intentional:
- equipment availability constrains how quickly compute capacity can be installed;
- installed compute capacity is useful only when power and operational capability are available;
- compute supply creates revenue only when there is deliverable demand and a viable contract or market price;
- AI-sector growth changes demand, but customer concentration can create exposure;
- energy scarcity and equipment delays can change the relative value of efficiency, expansion, and long-term contracts.

The first slice may model these dependencies with regional and company-level variables. It does not require a detailed physical supply-chain simulator.

## 3. Quarterly player experience

Each quarter has five visible stages:

### A. Intelligence brief
Present:
- group-level financial summary;
- subsidiary operating performance;
- active projects and expected milestones;
- sector and regional conditions;
- rival estimates with confidence and age;
- customer, supplier, regulator, and infrastructure developments;
- urgent risks and time-sensitive opportunities.

The brief must distinguish facts from estimates. It should surface the few developments that can materially change the player's next decision.

### B. Leadership agenda
The player chooses which strategic initiatives receive executive attention this quarter.

Leadership capacity represents scarce executive bandwidth: review, negotiation, cross-company coordination, crisis handling, and high-level sponsorship. It is not a generic energy bar and should not be spent on routine actions such as ordinary operations.

Initiatives have:
- leadership cost;
- financial cost or commitment;
- prerequisites and eligibility;
- duration and expected milestones;
- strategic objective;
- risks and uncertainty;
- explicit resolution outcomes.

The quarterly leadership limit is a scenario/balance parameter. Do not hard-code a final number until playtests establish the right decision density.

### C. Directives and commitments
The player issues a small set of validated directives, for example:
- sponsor a capacity expansion;
- negotiate a power reservation or long-term energy agreement;
- secure equipment allocation;
- pursue or renegotiate a major customer contract;
- fund an efficiency or resilience program;
- commission market research on a rival;
- pursue a partnership or acquisition, if eligible.

Some directives may be operationally delegated to subsidiary management. The player should choose strategic intent and constraints; the simulation resolves execution.

### D. World resolution
Resolve in a documented, deterministic order:
1. validate and commit accepted player commands;
2. progress projects and procurement;
3. update regional supply, demand, and market conditions;
4. let independent actors choose actions from their own goals and information;
5. resolve contracts, service delivery, revenue, costs, and penalties;
6. resolve financing, debt service, and cash movements;
7. update reputation, institutional relationships, risks, and information;
8. generate a causal report and advance the quarter.

The exact order may change during implementation, but it must be explicit, stable, testable, and documented. Avoid hidden same-quarter feedback loops.

### E. Consequence review
Show:
- what changed;
- why it changed;
- which player directive or external factor contributed;
- financial and strategic effects;
- whether the result was known, reported, estimated, or previously unknown;
- what now requires attention.

Every major result should have a traceable explanation.

## 4. Leadership capacity rules

Leadership capacity is a limited quarterly budget for major initiatives.

Design constraints:
- recurring company operations do not consume player leadership capacity;
- a major initiative consumes capacity when formally sponsored or when it requires a meaningful executive decision;
- ongoing projects may consume no further capacity unless a milestone, crisis, renegotiation, or escalation requires attention;
- some initiatives may require multiple quarters of leadership commitment, but this should be explicit;
- unused capacity does not automatically accumulate without a deliberate design reason;
- emergency responses may exceed the normal limit only through a clearly defined cost, trade-off, or consequence.

Do not implement a fixed action-point economy under another name. Leadership capacity should model organizational attention and coordination, not arbitrary button limits.

## 5. Campaign structure

The guided opening lasts eight quarters. It introduces systems through the state of the world and consequential opportunities rather than forcing a single optimal scripted path.

The scenario should define:
- an opening situation and initial relationships;
- a small number of authored pressure points;
- flexible actor goals and responses;
- optional objectives and setbacks;
- a clear evaluation at the end of quarter eight.

After the evaluation, the player may continue the same state as an open-ended sandbox. The campaign must not silently reset or convert the player's choices into a predetermined victory/defeat.

## 6. Rival intelligence: estimates

The player receives:
- exact internal data for Meridian-controlled entities where appropriate;
- public reports and announced facts about external actors;
- estimated ranges for important rival variables;
- confidence level and observation age for estimates.

An estimate is a knowledge object, not the rival's true state. Store true simulation state separately from the player's information state.

Suggested confidence labels: low, medium, high. Suggested freshness labels: current, recent, stale. These labels should be derived from data age, source quality, and uncertainty, not randomly assigned decoration.

Examples:
- rival compute utilization: 70–85%, medium confidence, recent;
- rival cash runway: 3–5 quarters, low confidence, stale;
- announced expansion: 20 MW planned, high confidence, current; completion timing remains uncertain.

Research initiatives may improve confidence or freshness. They must not automatically reveal all hidden information.

## 7. Strategic viability

The slice must support at least three credible approaches:
- **Scale-first:** invest in capacity and secure demand, accepting financing and execution risk.
- **Efficiency/resilience:** improve margins and reliability, reducing exposure to scarce inputs.
- **Bottleneck control:** secure energy/equipment access or partnerships to gain leverage without simply maximizing installed capacity.

These are test hypotheses, not locked classes. A mixed approach should also be possible.

## 8. Player-facing principles

- The player chooses priorities, not every operational detail.
- The world continues to act when the player does nothing.
- Information uncertainty is visible and consequential.
- No single metric defines success.
- Setbacks should create new constraints and decisions rather than automatically ending the campaign.
- The UI explains causal relationships and presents decisions in context.
