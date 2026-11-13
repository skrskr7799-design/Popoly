# Scenario Data — The Compute Bottleneck

**Status:** Proposed playable baseline for implementation and balance testing.  
**Scenario version:** 0.1.0  
**Setting:** Alternative near-future regional economy, 2035  
**Campaign:** Eight-quarter guided opening with same-state sandbox continuation  
**Currency:** USD; authoritative values stored in integer cents  
**Simulation quarter:** 90 days / 2,160 hours for stable first-slice calculations

> All figures in this document are initial balance hypotheses, not claims about a real economy. They are intentionally centralized here so they can be tuned without changing simulation rules.

## 1. Scenario premise

Meridian Group is an established regional holding company. It controls NodeWorks, a data-center and compute-services operator. The business is profitable, but its next stage of growth depends on scarce grid capacity, long equipment lead times, and a rapidly growing AI customer whose demand is larger than any one regional operator can comfortably serve.

Meridian is neither a distressed shell nor an unstoppable incumbent. It has cash, debt capacity, an operating asset, a capable management team, and a valuable customer relationship. It also has constraints: limited executive bandwidth, a concentrated customer base, a large subsidiary debt burden, and exposure to energy and equipment bottlenecks.

The player's role is group-level executive leadership. Subsidiary teams continue routine operations; the player chooses which strategic initiatives receive attention and capital.

## 2. Initial organization structure

### Meridian Group

| Attribute | Starting value | Notes |
|---|---:|---|
| Holding cash | $14.0m | Cash legally held at parent level |
| Holding debt | $3.0m | Secured revolving facility |
| Revolver limit | $8.0m | $5.0m undrawn at start |
| Quarterly interest rate | 2.0% | Initial scenario assumption |
| Reputation | 62 / 100 | Regional corporate reputation |
| Institutional access | 55 / 100 | Access is not the same as political control |
| Leadership capacity | 4 units / quarter | Executive bandwidth; tuning parameter |
| Strategic risk tolerance | Balanced | Starting policy, not a permanent player class |

**Ownership of NodeWorks:** 72% Meridian Group, 18% founders and senior employees, 10% regional infrastructure fund. NodeWorks has 10,000,000 issued ordinary shares. Economic ownership and voting rights are one-to-one in this slice; board appointment rights are a separate control rule and must not be inferred from a share percentage alone.

Meridian's cash is not automatically available to NodeWorks. Capital moves between parent and subsidiary only through explicit equity contributions, intercompany loans, dividends, or other recorded transactions.

### NodeWorks

| Attribute | Starting value | Notes |
|---|---:|---|
| Installed IT capacity | 24 MW | Nameplate capacity |
| Grid allocation | 20 MW | Contracted maximum supply |
| Commissioned equipment capacity | 23 MW | Equipment-ready limit |
| Operational capacity | 22 MW | Staff/process limit |
| Reliability | 98.5% | Availability factor |
| Effective capacity | 19.7 MW | Minimum constraint × reliability, rounded for display |
| Delivered workload | 17.0 MW average | Starting-quarter delivery |
| Utilization | 86.3% | Delivered / effective capacity |
| Cash | $4.2m | Subsidiary cash, not parent cash |
| Debt principal | $14.0m | Long-term infrastructure debt |
| Quarterly interest rate | 2.25% | Scenario assumption |
| Quarterly contracted demand | 13.0 MW | Across two contracts |
| Flexible demand served | 4.0 MW | Non-exclusive workload |
| Reputation | 74 / 100 | Service reliability is a strength |

### Initial NodeWorks quarterly operating baseline

The first quarter begins from a stable operating run-rate. This is a baseline for the first resolution, not a guarantee that every later quarter repeats it.

| Item | Assumption |
|---|---:|
| Contract A delivery | 8.0 MW |
| Contract B delivery | 5.0 MW |
| Flexible workload delivery | 4.0 MW |
| Total delivered workload | 17.0 MW |
| Contract A price | $510k / MW-quarter |
| Contract B price | $485k / MW-quarter |
| Flexible service price | $415k / MW-quarter |
| Revenue | $8.165m |
| Energy consumed | 36,720 MWh |
| Effective energy price | $72 / MWh |
| Energy expense | $2.64384m |
| Operations and staffing | $1.35m |
| Maintenance | $0.62m |
| Network and connectivity | $0.46m |
| Overhead, compliance and insurance | $0.58m |
| Total operating expenses | $5.65384m |
| Operating cash contribution before financing and capex | $2.51116m |

Energy calculation: 17 MW average load × 2,160 hours = 36,720 MWh. Energy expense is 36,720 × $72. A future variable load/efficiency model may refine this, but units must remain explicit.

For the first slice, assume customer receipts and operating payments settle within the quarter unless a contract explicitly defines a delay. This keeps revenue and cash-flow accounting understandable while leaving receivables/payables as a later extension.

## 3. Ownership and control rules

- Meridian owns 7,200,000 of 10,000,000 NodeWorks shares.
- Founders/employees own 1,800,000 shares.
- Regional Infrastructure Fund owns 1,000,000 shares.
- All issued shares must be represented in the ownership ledger.
- Meridian's 72% gives it ordinary voting majority under the initial one-share/one-vote rule.
- Subsidiary operational decisions remain delegated to NodeWorks management unless the player sponsors a strategic directive or a governance event requires intervention.
- No public stock exchange or free-floating share price is needed in this slice.

The opening should communicate that Meridian controls NodeWorks but does not personally hold every dollar or directly execute every operational task.

## 4. Regional market

The region is a compact economic abstraction. It has one power market, one critical-equipment allocation market, and a compute-services customer market.

### Regional energy

| Attribute | Starting value |
|---|---:|
| Available regional capacity | 64 MW |
| Existing committed load | 58 MW |
| Uncommitted headroom | 6 MW |
| Reference spot price | $72 / MWh |
| NodeWorks reserved grid capacity | 20 MW |
| Additional firm capacity available immediately | 2 MW |
| Typical lead time for new firm capacity | 3–5 quarters |

The 6 MW of regional headroom is not automatically available to NodeWorks. Allocation depends on contract priority, reliability needs, regulator policy, and competing demand. A player may negotiate a reservation, but it can involve a premium, a deposit, a longer commitment, or a take-or-pay clause.

### Critical equipment

Silicon Vein is the region's principal supplier of advanced compute equipment for this scenario.

| Attribute | Starting value |
|---|---:|
| Regional quarterly delivery pool | 10 MW-equivalent |
| NodeWorks current procurement allocation | 2 MW-equivalent / quarter |
| New order lead time | 2 quarters |
| Rush procurement premium | +25% |
| Supplier concentration risk | High |

Equipment is abstracted as MW-equivalent commissioned capacity, not individual GPU or server SKUs. The abstraction is sufficient to make expansion timing and supplier access strategic.

### Compute demand

| Attribute | Starting value |
|---|---:|
| Total regional demand | 49 MW average |
| NodeWorks demand currently served | 17 MW |
| Kestrel Compute demand currently served | 19 MW |
| Other providers / self-hosted | 13 MW |
| Expected AI workload growth | 5–9% per quarter |
| Demand volatility | Medium-high |

Growth is a forecast range, not a deterministic promise. Actual demand responds to customer investment, pricing, reliability, regulation, and broader economic conditions.

## 5. Independent actors

The first slice needs a small cast with conflicting incentives. Actors should pursue goals even when the player ignores them.

### Kestrel Compute — direct competitor

- Effective compute capacity: estimated 22–26 MW.
- Current delivered workload: estimated 17–21 MW.
- Reliability: estimated 96–98%.
- Strategy: expand aggressively while protecting its largest customer contracts.
- Strengths: scale, procurement relationships, established sales team.
- Weaknesses: higher leverage and less reliable service than NodeWorks.
- Hidden concern: a planned expansion depends on securing additional equipment allocation.
- Likely responses: bid for Asterion workloads, negotiate with the power network, accelerate procurement, or undercut prices when utilization falls.

Player-facing information is a range with confidence and age, not the exact values above. True values are simulation state.

### Asterion AI — anchor customer and fast-growing AI company

- Compute demand: 28 MW average at scenario start.
- NodeWorks contract: 13 MW.
- Kestrel contract: 10 MW.
- Remaining 5 MW: flexible sourcing / other providers.
- Strategy: secure reliable compute supply without becoming dependent on one operator.
- Strengths: rapid demand growth, strong funding, high strategic value.
- Weaknesses: volatile workload forecasts and aggressive price negotiations.
- Likely responses: split workloads, seek volume discounts, require stronger service guarantees, or invest in own infrastructure.
- NodeWorks' two anchor contracts have staggered end dates (Q4 and Q5) and a two-quarter renewal notice. Renewal willingness-to-pay and minimum guaranteed volumes are private customer metrics; the player must infer them from negotiation outcomes and market intelligence.

Asterion is not simply a quest-giver. Its procurement choices must be based on price, reliability, available capacity, concentration, and its own growth outlook.

### Solara Grid — regional energy supplier

- Controls the regional energy allocation process and grid reliability data.
- Strategy: preserve grid stability, meet regulatory obligations, and secure predictable long-term revenue.
- Strengths: control of a scarce input and superior information about grid constraints.
- Weaknesses: limited immediate spare capacity and political scrutiny over allocation.
- Likely responses: offer conditional reservations, prioritize resilient operators, raise prices under scarcity, or delay commitments pending infrastructure investment.

### Silicon Vein — equipment supplier

- Supplies advanced compute equipment and accelerator systems.
- Strategy: maximize margin while allocating scarce production to reliable, strategically important customers.
- Strengths: proprietary technology and limited substitute suppliers.
- Weaknesses: capacity constraints and exposure to export / logistics disruption.
- Likely responses: prioritize larger commitments, demand deposits, adjust delivery schedules, or offer premium rush allocation.

### Regional Infrastructure Authority — public institution

- Responsibilities: grid resilience, competition, employment, regional investment, and critical infrastructure continuity.
- Strategy: balance development with concentration and systemic-risk concerns.
- It is not a player-controlled actor and does not exist merely to approve projects.
- Likely responses: publish reports, set conditions on large expansions, investigate concentration, or offer incentives for resilience investments.

## 6. Contract lifecycle assumptions

The opening NodeWorks/Asterion anchor agreements are fixed-term contracts. Contract A (8 MW) ends after Q4; Contract B (5 MW) ends after Q5. Both enter a two-quarter renewal-notice window. A renewal proposal specifies price per MW-quarter, guaranteed workload, and a new term of 2–8 quarters. Asterion evaluates price and volume against private thresholds. Accepted terms begin in the following quarter; counteroffers and rejections do not silently alter the existing agreement. An agreement remains valid through its stated end quarter. If no renewal is accepted by the end of that quarter, it expires and its guaranteed workload is removed from NodeWorks' future contracted revenue. Asterion then reallocates the uncovered volume to Kestrel up to available capacity; any remainder becomes flexible demand. These thresholds are initial balance hypotheses. In the current engine slice, Asterion's private relationship score responds to NodeWorks' SLA performance and fixed-contract delivery. That score dynamically shifts its private renewal price ceiling, minimum guaranteed volume, and flexible-service price ceiling. The player receives a separate low-confidence renewal-risk estimate, not the hidden score or exact commercial thresholds. Future iterations should also incorporate supplier concentration, customer growth, and explicit account-management actions.

## 7. Leadership capacity and initiative catalogue

Starting leadership capacity: **4 units per quarter**. This is a test value, not a permanent design truth.

Leadership units represent senior attention, negotiation authority, cross-company coordination, and escalation capacity. They are not consumed by ordinary operations.

| Initiative | Leadership cost | Initial financial commitment | Typical duration | Strategic effect |
|---|---:|---:|---:|---|
| Capacity expansion phase I | 2 | $6.0m total, milestone-based | 3 quarters | +6 MW installed capacity after commissioning |
| Secure additional equipment allocation | 1 | $1.2m deposit | 2 quarters | Improves delivery certainty for expansion |
| Negotiate additional firm power | 2 | $0.5m reservation deposit + tariff premium | 2–4 quarters | Potential +4–5 MW grid allocation |
| Efficiency and cooling program | 2 | $1.8m | 2 quarters | Reduces energy per delivered workload by 8% |
| Renegotiate Asterion contract | 1 | No fixed cost; may change price/commitment | 1 quarter | Alters volume, price, term, and concentration |
| Commission competitor market study | 1 | $0.25m | 1 quarter | Improves selected rival estimates |
| Resilience and security program | 1 | $0.9m | 2 quarters | Improves reliability and institutional trust |

Initiative costs and effects are scenario data. The engine must validate them; it must not embed these figures in command handlers.

A project can span multiple quarters. Launch consumes its stated leadership cost. Further leadership is required only when the project explicitly reaches a decision milestone, faces a blocker needing executive intervention, or requires renegotiation. Ordinary progress is automatic.

Unused leadership capacity expires at quarter end in the first prototype. No carryover mechanic is assumed.

## 8. Opening pressure and eight-quarter arc

The opening arc introduces pressure points without scripting a single correct response. Events should be conditional where possible.

| Quarter | World pressure / opportunity | Systems brought into focus |
|---|---|---|
| Q1 | Solara Grid signals that spare capacity is likely to be allocated soon | Intelligence, energy reservation, prioritization |
| Q2 | Silicon Vein confirms a constrained equipment window | Procurement, deposits, project dependencies |
| Q3 | Asterion AI issues a revised growth forecast and requests additional supply | Customer contracts, demand uncertainty |
| Q4 | Regional grid maintenance increases outage risk | Reliability, resilience, contract penalties |
| Q5 | Kestrel announces an expansion plan | Rival estimates, competitive response |
| Q6 | Infrastructure Authority opens a review of regional compute concentration | Institutional relationships, governance conditions |
| Q7 | Energy price volatility and equipment delays test the chosen strategy | Risk exposure, adaptation, liquidity |
| Q8 | The region's compute market enters a new capacity/demand balance | Campaign review and sandbox continuation |

These are scenario beats, not guaranteed identical outcomes. The same pressure may be resolved differently or arrive with different severity based on actor decisions and prior player choices. Do not force the event if its preconditions no longer make sense.

## 9. Viable strategic approaches

The scenario should allow at least three credible strategies:

### Scale-first
Commit capital early, reserve power, secure equipment, and expand capacity. Potentially captures Asterion's growth, but exposes Meridian to debt, customer concentration, and execution delays.

### Efficiency and resilience
Improve cooling, energy efficiency, service reliability, and operational discipline. Generates stronger margins and may win contracts based on reliability, but can surrender market share if demand grows faster than capacity.

### Bottleneck control
Secure energy and equipment access, cultivate supplier and institutional relationships, and use partnerships rather than owning every new asset. Requires negotiation and careful commitments; success depends on counterparties and may sacrifice some upside.

A fourth adaptive strategy should emerge naturally. The design must not give any one strategy a guaranteed advantage across all seeds and actor behaviors.

## 10. Starting intelligence presentation

At campaign start, the player knows Meridian and NodeWorks' internal operating figures. External actor data is presented as public, reported, or estimated.

Examples:

| Subject | Player-visible information | Confidence | Freshness |
|---|---|---|---|
| Kestrel delivered workload | 17–21 MW | Medium | Recent |
| Kestrel effective capacity | 22–26 MW | Medium | Recent |
| Kestrel cash runway | 3–5 quarters | Low | Stale |
| Asterion demand | 26–30 MW | High | Current |
| Solara spare capacity | 4–7 MW | Medium | Recent |
| Silicon Vein delivery lead time | 2–3 quarters | High | Current |

The exact truth remains in the world state. Estimates are generated from source quality, observation age, and uncertainty. Research improves the player's knowledge; it does not reveal every hidden value.

## 11. Initial lender terms

The opening credit market includes two illustrative counterparties:

| Lender | Borrower | Principal | Quarterly rate | Maturity | Offer expiry |
|---|---|---:|---:|---:|---:|
| Northstar Commercial Bank | NodeWorks | $2.0m | 2.8% | Q9 | Q2 |
| Frontier Development Bank | Meridian Group | $3.0m | 3.2% | Q9 | Q2 |

Northstar is modeled with a conservative risk appetite and a collateral description covering equipment and receivables. Frontier has a growth-oriented appetite and a holding-company asset/covenant package. These are opening scenario offers for testing borrower-specific finance, not yet dynamically generated bank decisions.

The opening debt ledger also names its incumbent creditors: Northstar holds Meridian Group's $3.0m revolving facility, while Frontier holds NodeWorks' $14.0m infrastructure loan. This makes lender relationships actionable from the first quarter: the player can request revised terms from the actual creditor or seek a competing lender's offer to refinance. Opening offers carry covenant packages consistent with each lender's risk appetite (DSCR/leverage thresholds, grace period, borrowing restriction, and a one-time breach premium).

## 12. Initial scenario acceptance checks

The scenario data is ready for engine implementation when:

- parent and subsidiary cash are distinct and never double-counted;
- NodeWorks ownership sums to 10,000,000 issued shares;
- effective capacity is derived from all four constraints and reliability;
- delivered workload cannot exceed effective capacity or available demand;
- energy consumption and cost use consistent MW/MWh units;
- the opening operating statement reconciles;
- projects cannot commission before equipment, power, and operational prerequisites are met;
- Asterion and Kestrel make independent supplier/market decisions;
- rival estimates never leak hidden true state;
- fixed contracts open a renewal window, preserve service through expiry, and expire/reallocate volume only when no renewal is accepted;
- leadership capacity prevents over-sponsoring initiatives but does not stop routine operations;
- the eight-quarter arc remains playable when the player chooses different strategies;
- quarter eight can transition to sandbox with the same authoritative state.
