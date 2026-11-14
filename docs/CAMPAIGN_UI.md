# Campaign UI — First Playable Interface

**Status:** Interactive campaign shell connected to `CampaignSession`; visual and browser playtesting remains outstanding.  
**Scope:** Package 2 of the first vertical slice  
**Branch:** `docs/game-foundation`

## Purpose

The campaign UI replaces the legacy stock-trading screen as the active application entry point. The legacy trading prototype and Zustand store remain in the repository but are not imported by the campaign application.

The new interface uses `CampaignSession` as its only campaign state owner. It does not read from or write to the legacy Zustand store.

## Current player loop

1. Start a new Compute Bottleneck campaign with the scenario's default seed.
2. Review Meridian Group and NodeWorks financial and operational position.
3. Review customer contracts, renewal windows, regional power, equipment availability, and player-visible intelligence estimates.
4. Select strategic initiatives and prepare commercial or financing decisions.
5. Resolve the quarter through `CampaignSession.advance`.
6. Review the returned `QuarterReport`, including company economics, cash bridges, projects, financing outcomes, and autonomous actor actions.
7. Continue into the next quarter; after eight successful transitions the session exposes sandbox stage.

## Current screen areas

- **Command overview:** quarter, guided-campaign progress, group cash/debt, effective capacity, and reliability.
- **Executive agenda:** scenario initiatives, leadership bandwidth, and capital commitments.
- **NodeWorks operations:** installed IT, grid allocation, equipment, operational limit, and delivered workload.
- **Customer contracts:** contracted/flexible demand, delivered workload, realized contract rate, term, renewal window, and SLA service credits.
- **Contract renewal proposals:** proposed rate, guaranteed workload, and term. Offers are resolved by the simulation; customer reservation terms and rival bids remain hidden.
- **Financial position:** legal-entity cash, outstanding debt, contractual debt service, interest expense, revolving-facility headroom, lender capacity, covenant terms, arrears, and available loan offers.
- **Credit decisions:** accept available offers or request new credit for Meridian or NodeWorks. Requests are underwritten independently by represented lenders at quarter resolution; accepted offers are separate decisions in a later quarter.
- **Regional market and intelligence:** power, equipment availability, energy price, and estimates with confidence/freshness.
- **Quarter review:** operating results, cash bridges, financing decisions, covenant changes, project outcomes, contract negotiations, and autonomous actor activity.
- **Campaign archive:** local save/load, recovery, and validated JSON import/export.

## Financial presentation rules

- Cash and debt remain attached to their legal entity. Meridian and NodeWorks balances are not pooled by the UI.
- Principal, accrued interest expense, interest paid, scheduled principal, and arrears are distinct values.
- Contractual debt service due is a current-quarter obligation derived from the engine's debt-service rules; it is not a promise that the borrower has enough cash to pay it.
- Revolving headroom is constrained by the facility's undrawn commitment and the represented lender's remaining capacity and cash liquidity. Shared lender resources are not counted repeatedly across facilities.
- Lender underwriting policy and available capacity are displayed as scenario data. Confidential customer reservation prices and competitor bids are not surfaced.
- A credit request does not create cash or debt. It asks eligible lenders to independently produce an offer or rejection.
- Accepting a loan offer is an explicit quarter command. The engine validates expiry, borrower restrictions, lender cash, and lending capacity.
- UI previews are informational. The engine remains authoritative for all decisions and state transitions.

## Current financial action scope

Implemented in the UI:
- accept currently available loan offers;
- submit one new credit request for a selected legal borrower in a quarter;
- review debt, facility, covenant, maturity, service, and arrears information.

Not yet exposed as player controls:
- voluntary principal repayment;
- revolving-facility drawdown;
- refinancing;
- debt restructuring or covenant-waiver requests.

These actions remain outside the current player-facing decision flow until their interaction design and consequences can be validated as a coherent experience.

## Files

- `src/game/ui/CampaignApp.tsx` — campaign shell, dashboard, strategy selection, quarter decisions, archive, and report.
- `src/game/ui/ContractPortfolioPanel.tsx` — customer contract portfolio and renewal proposals.
- `src/game/ui/FinancePanel.tsx` — legal-entity liquidity, debt portfolio, lender capacity, offers, and credit requests.
- `src/game/ui/CampaignStoragePanel.tsx` — campaign archive and transfer controls.
- `src/game/ui/format.ts` — display-only money, percentage, and quarter formatters.
- `src/main.tsx` — mounts the new campaign UI.
- `src/index.css` — responsive visual system for the campaign interface.

## Validation and known limitations

- Initiative names, descriptions, costs, duration, and effects are read from scenario definitions.
- Company balances, capacity, projects, markets, contracts, debt, lenders, and intelligence are read from the authoritative `GameState` snapshot.
- Financial operating results and causal events are read from `QuarterReport`.
- UI budget checks are convenience feedback only. The engine remains authoritative and structured validation issues are shown to the player.
- No hidden actor metrics are rendered. Only `playerIntelligence` estimates are shown.
- The current UI uses a fixed scenario seed of 2035 for reproducible first-playable testing.
- The opening report is a read-only snapshot; the report panel appears after the first quarter resolution.
- The eight-quarter completion state is surfaced as sandbox mode, but there is not yet a dedicated campaign evaluation screen.
- CI verifies TypeScript, production build, and automated engine/persistence tests. Browser smoke testing, responsive review on actual devices, and a human-played eight-quarter campaign remain required before calling the vertical slice fully playable.
