# Legacy Prototype Migration Map

**Status:** The new game foundation is implemented. The original prototype is preserved under `legacy/prototype/`; final cleanup and cutover are tracked in [MIGRATION_REHEARSAL.md](MIGRATION_REHEARSAL.md).
**Branch:** `docs/game-foundation`

## 1. Original legacy code shape

The pre-foundation prototype was a compact React/TypeScript/Vite share-market game. Its main modules were:

- `src/entities/types.ts`: `Player`, `Company`, `ShareHolding`, `Loan`, `GameState`, and `EconomyPhase`.
- `src/store/gameStore.ts`: Zustand store for turn flow, trading, loans, espionage, scoring, events, bots, and economy transitions.
- `src/data/`: seeded companies, sectors, economy phases, bot archetypes, events, and secrets.
- `src/App.tsx`: legacy screen composition and player interaction surface.

That model is intentionally not the authoritative model for Tech Dominion.

## 2. Preserve, reinterpret, replace

| Legacy area | Decision | New direction |
| --- | --- | --- |
| React / TypeScript / Vite | Preserve | Keep the client stack |
| Zustand | Narrow | UI adapter and transient presentation state only |
| `Player` | Replace | Separate campaign player/leadership authority from organizations and legal entities |
| `Company` | Replace | Operating company with assets, accounts, projects, contracts, management, and ownership |
| `ShareHolding` | Refactor | Explicit ownership ledger tied to issued shares and voting rules |
| `Loan` | Refactor | Debt instrument with principal, rate, schedule, covenants, and lender |
| `EconomyPhase` | Reinterpret | Data-driven regional/sector conditions rather than global price multipliers |
| `actionPointsRemaining` | Replace | Quarterly leadership capacity and initiative commitments |
| Share buy/sell and price-impact loop | Defer / remove | No public order book in the first vertical slice |
| Sector adjacency bonuses | Reinterpret | Actual dependencies and bottlenecks between industries |
| Bot archetypes | Preserve as inspiration | Goal-driven independent actor policies |
| Espionage/secrets | Defer and redesign | Estimates-based intelligence first; covert operations later |
| Event catalogue | Preserve as narrative seed | Events must alter modeled variables and produce causal reports |
| Score/victory formula | Replace | Multiple strategic outcomes and campaign evaluation |
| Monolithic game store | Replace incrementally | Pure engine modules plus thin UI adapter |
| Legacy App layout | Archive | Campaign UI is mounted through the new application entry |

## 3. Implemented domain boundaries

The active implementation lives under `src/game/`:

- `domain/`: IDs, money, units, organizations, companies, ownership, debt, contracts, and invariants.
- `scenario/`: versioned initial world, initiative definitions, and turnaround data.
- `engine/`: validated quarter orchestration and seeded state initialization.
- `systems/`: actors, economy, finance, operating payables, creditor workouts, administration, liquidation, and quarter reports.
- `campaign/`: application-facing authoritative campaign session.
- `persistence/`: canonical serialization, checksums, decoding, IndexedDB repository, save/load, restore, and JSON transfer.
- `ui/`: campaign application, command center, markets, finance, corporation, and storage screens.
- `__tests__/`: unit, integration, persistence, campaign, and managed long-horizon tests.

The active entry `src/main.tsx` mounts `src/game/ui/CampaignApp.tsx`. The old `src/App.tsx`, `src/store/`, `src/entities/`, and `src/data/` still exist in the active tree but are not mounted. Their exact pre-foundation versions are also archived in `legacy/prototype/`.

## 4. Legacy archive

- Source branch: `main`.
- Exact source commit: `3c8c1183490562111f820dafd602eca18826df11`.
- Archive path: `legacy/prototype/`.
- Archived tracked files: 27.
- `legacy/README.md` records the provenance and explains the snapshot.
- The archive reuses the original Git blob objects, so the archived file contents match the source commit exactly.

No legacy files have been deleted from `src/`. Keep the archive immutable. Before removing duplicate legacy source from `src/`, audit import references and run the full CI suite.

## 5. Build and CI boundaries

- `npm run lint` runs `oxlint src`, intentionally excluding the historical archive from active application lint.
- `tsconfig.app.json` continues to compile the active `src/` tree.
- Root `.dockerignore` excludes `legacy/` from the production Docker build context.
- The production Docker image serves only the Vite `dist/` output.
- `game-engine-ci.yml` validates lint, TypeScript/build, tests, Docker image creation, and container HTTP smoke test on pushes to the source branch and PRs targeting `main`.
- The existing `docker-publish.yml` remains unchanged and continues to publish only after changes reach `main`.

## 6. Migration status

The new scenario initializes and advances through the independent quarterly engine. The campaign UI, persistence, finance, creditor workouts, administration, and liquidation are implemented and covered by automated tests. Managed four-seed, 48-quarter runs and the campaign-session restore cases pass CI.

The old prototype is preserved, but duplicate old source files remain in `src/` pending a deliberate cleanup review. The source branch has a draft migration PR to `main`; it has not been merged.

## 7. Exit criteria

The legacy model is no longer authoritative when the new scenario initializes and advances through the independent engine with valid ledgers, ownership totals, capacity constraints, causal reports, persistence, and player-facing controls. This implementation condition is met on `docs/game-foundation`.

The remaining release gates are the full browser checklist, final review of the 645-commit PR history and merge strategy, and explicit approval before merging. See [MIGRATION_REHEARSAL.md](MIGRATION_REHEARSAL.md).
