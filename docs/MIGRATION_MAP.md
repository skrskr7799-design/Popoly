# Legacy Prototype Migration Map

**Status:** The initial engine migration is implemented. Final release preservation and cutover steps are tracked in [MIGRATION_REHEARSAL.md](MIGRATION_REHEARSAL.md).  
**Branch:** `docs/game-foundation`  
**Rule:** Do not rewrite the whole client in one pass. Establish the new simulation core alongside the legacy UI, then replace the old flow deliberately.

## 1. Original legacy code shape\n\nThe following describes the pre-foundation prototype that currently lives on `main` and is still retained in the source branch for archival purposes.

The existing client is a compact React/TypeScript/Vite application. Current gameplay state is centered on:
- `src/entities/types.ts`: `Player`, `Company`, `ShareHolding`, `Loan`, `GameState`, `EconomyPhase`;
- `src/store/gameStore.ts`: Zustand store containing initialization, turn flow, trading, loans, espionage, scoring, events, bots, and economy transitions;
- `src/data/companies.ts`: eight pre-seeded companies with share prices, valuations, cash-flow values, technologies, and secrets;
- `src/data/sectors.ts`: sector abilities, score bonuses, adjacency, and labels;
- `src/data/economy.ts`: macro phase multipliers and phase progression;
- `src/data/bots.ts`: four bot archetypes expressed as trading/espionage weights;
- `src/data/events.ts` and `src/data/secrets.ts`: event and secret content;
- `src/App.tsx`: current screen composition and interaction surface.

The current `GameState` has `turn`, `phase`, `players`, `companies`, `currentPlayerIndex`, `actionPointsRemaining`, `log`, and winner/status fields. This is a turn-based share-market game model, not the new holding-company simulation model.

## 2. Preserve, reinterpret, replace

| Legacy area | Decision | Migration direction |
|---|---|---|
| React / TypeScript / Vite | Preserve | Keep the client stack |
| Zustand | Preserve but narrow | UI adapter and transient presentation state; not simulation authority |
| `Player` | Replace | Separate campaign player/leadership authority from organizations and legal entities |
| `Company` | Replace | Operating company with assets, financial accounts, projects, contracts, management, and ownership |
| `ShareHolding` | Refactor | Explicit ownership ledger tied to issued shares and voting rules |
| `Loan` | Refactor | Debt instrument with principal, rate, schedule, covenants, and lender |
| `EconomyPhase` | Reinterpret | World macro conditions become data-driven regional/sector state, not global price multipliers |
| `actionPointsRemaining` | Replace | Quarterly leadership capacity and initiative commitments |
| share buy/sell mechanics | Defer | No public order book in first vertical slice |
| price-impact formula | Remove from new engine | Valuation reporting is derived from operating fundamentals and risk |
| sector adjacency bonuses | Reinterpret | Actual dependencies and bottlenecks between industries |
| bot archetypes | Preserve as inspiration | Replace weights with goal-driven actor policies |
| espionage/secrets | Defer and redesign | Information gathering becomes estimates/research first; covert operations later |
| event catalogue | Preserve as narrative seed | Events must alter modeled variables and produce causal reports |
| score/victory formula | Replace | Multiple strategic outcomes and campaign evaluation |
| monolithic game store | Replace incrementally | Pure engine modules + thin Zustand adapter |
| current App layout | Redesign later | Do not bind the new simulation model to the old screen structure |

## 3. New domain boundaries

Recommended first implementation modules:

- `src/game/domain/`: IDs, money, units, organizations, companies, ownership, debt, contracts, projects.
- `src/game/scenario/`: versioned initial world and scenario/tuning data.
- `src/game/commands/`: player intent and validation.
- `src/game/systems/`: finance, compute capacity, energy, equipment, demand, projects, contracts.
- `src/game/actors/`: independent company and institutional policies.
- `src/game/intelligence/`: public facts, estimates, confidence, freshness.
- `src/game/engine/`: deterministic quarterly resolution.
- `src/game/reports/`: causal quarter reports.
- `src/game/persistence/`: save schema, validation, migrations.
- `src/state/`: Zustand adapter for UI consumption.

The active source branch now implements these boundaries under `src/game/`. The application entry `src/main.tsx` mounts `CampaignApp`; the old `src/App.tsx` and its supporting `store`, `entities`, and `data` modules remain in the tree but are no longer the mounted application. They have not yet been moved to `legacy/`.

## 4. First implementation sequence

1. Add test tooling and verify the current baseline build.
2. Define domain IDs, integer money, explicit physical units, and ownership ledger types.
3. Define `The Compute Bottleneck` scenario data as pure serializable objects.
4. Implement initial-state validation and accounting/ownership invariants.
5. Implement pure calculations for effective capacity, service delivery, energy cost, operating statement, and cash bridge.
6. Implement one quarter with no player commands and verify actor/world resolution.
7. Add typed commands, leadership validation, and project scheduling.
8. Add estimates-based intelligence and ensure hidden-state separation.
9. Add save/load round-trip and deterministic replay tests.
10. Connect a minimal command-center UI to the engine only after the simulation tests pass.

## 5. Explicit non-goals for the migration

- Do not try to preserve old stock-market victory scoring.
- Do not convert all eight old companies into the new scenario.
- Do not keep old AP values while relabeling them Leadership.
- Do not put economy calculations back into React components or Zustand actions.
- Do not build multiplayer or server authority before the single-player engine is stable.
- Do not redesign every UI screen before the first quarter can resolve correctly.

## 6. Exit criteria

The legacy model is no longer authoritative when a new scenario can initialize and advance one quarter entirely through the independent engine, with valid ledger balances, ownership totals, capacity constraints, and a causal report. The old UI may remain temporarily while screens are migrated.
