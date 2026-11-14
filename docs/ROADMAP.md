# Development Roadmap

**Status:** Active development plan. The simulation foundation, versioned campaign persistence, and playable vertical slice are implemented on `docs/game-foundation`; final validation and migration preparation remain.

## Guiding approach

Build a coherent, testable vertical slice before expanding the simulation. Do not attempt to implement the entire grand-strategy vision at once.

## Phase 0 — Preserve and document

- [ ] Preserve the current prototype with a clearly named Git tag or snapshot.
- [x] Create a documentation branch for the new foundation.
- [x] Establish the initial vision, design, architecture, workflow, and decision records.
- [ ] Mark legacy prototype behavior separately from the future design.

**Exit criteria:** The existing work can be recovered, and the agreed direction is documented.

## Phase 1 — Full project audit

Review the current codebase and module boundaries; game state and simulation rules; corporate and financial logic; AI / bot behavior; events and progression; UI, usability, and information hierarchy; persistence and save/load; and build, lint, test, Docker, and CI workflows.

**Progress note:** The initial static audit is documented in [AUDIT.md](AUDIT.md). The active foundation has since passed CI build, lint, engine, and persistence tests. The project owner reported an exploratory browser check on 2026-11-14 with no visible issues; the detailed browser checklist is not fully recorded, so targeted end-to-end cases remain.

Deliverables:
- findings classified by severity and impact;
- preserve / refactor / replace / remove recommendations;
- known risks and missing tests;
- proposed migration sequence.

**Exit criteria:** We understand what exists, what is unreliable, and what can be reused. Do not claim runtime validation unless it has actually been run.

## Phase 2 — Game design specification

Resolve the core design questions: world scale, regions, and map representation; player role and progression of influence; major actor types and their independent goals; time model and action economy; first playable gameplay loop; initial victory and campaign objectives; information, uncertainty, and feedback.

**Accepted design baseline:** [VERTICAL_SLICE.md](VERTICAL_SLICE.md) records the confirmed scenario decisions. Detailed contracts are in [CORE_LOOP_SPEC.md](CORE_LOOP_SPEC.md), [ECONOMY_MODEL.md](ECONOMY_MODEL.md), and [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md). Numerical balance remains provisional.

**Exit criteria:** A bounded first playable experience can be described precisely enough to implement and test.

## Phase 3 — Simulation and technical foundation

**Specification baseline:** [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) defines the target engine boundary, commands, deterministic quarter resolution, information model, persistence, and testing strategy. [ECONOMY_MODEL.md](ECONOMY_MODEL.md) defines the first-pass accounting and operating model. [SCENARIO_DATA.md](SCENARIO_DATA.md) defines the initial world and balance hypotheses. [MIGRATION_MAP.md](MIGRATION_MAP.md) maps the legacy prototype to the new architecture.

- [x] inspect the current source tree and establish a migration map;
- [x] define domain types, canonical units, and authoritative state;
- [x] implement validated player commands and leadership capacity;
- [x] implement deterministic quarter orchestration and seeded randomness;
- [x] implement core economic calculations and accounting invariants;
- [x] implement actor policies and estimates-based intelligence;
- [x] implement versioned save/load;
- [x] establish unit, integration, and scenario tests.

**Current status:** The framework-independent simulation engine, deterministic quarter resolution, actor policies, estimates-based intelligence, versioned campaign persistence, and player-facing vertical slice are implemented and covered by CI. The finance layer now includes arrears, payment defaults, operating payables, creditor workouts, administration, and liquidation. Phase 3 is complete. The playable slice is implemented; long-horizon balance and deeper content remain iterative work.

**Exit criteria:** Core simulation rules can be exercised independently of the interface.

## Phase 4 — Vertical slice

Build one compact scenario with a small world and a limited number of actors. It should include a meaningful economic decision, an independent rival response, and a visible consequence that affects the next decision.

**Implementation status:** The Compute Bottleneck scenario, independent market actors, contract renewals, strategic initiatives, quarterly reports, finance, persistence, and the main player-facing destinations are implemented. The guided opening and sandbox continuation are covered by scenario tests. The project owner has completed an exploratory browser check; full checklist evidence and deeper gameplay/balance feedback remain ongoing.

**Exit criteria:** A new player can understand the situation, make strategic choices, and find the resulting chain of consequences engaging.

## Phase 5 — Expand and deepen

Only after the vertical slice is enjoyable, deepen corporate structures and markets; add technology and infrastructure dependencies; expand state and institutional behavior; add intelligence and counterintelligence; improve rival strategies and emergent events; and expand regional and global influence.

**Exit criteria:** Each new system improves the strategic experience and passes integration and balance checks.

## Phase 6 — UX, balance, and content

The core strategy-game interface, onboarding, and main destinations are implemented. Continue with focused visual polish rather than a wholesale redesign; balance viable strategic paths; test long campaigns and edge cases; improve accessibility, performance, and presentation.


## Phase 8 — Release validation and migration

- [x] Add four-seed, 48-quarter managed campaign validation with per-quarter invariants.
- [x] Add campaign-session restore tests for active creditor workout, active administration restrictions, and completed liquidation.
- [x] Record the owner's exploratory browser check without overstating the unrecorded checklist results.
- [x] Prepare a non-destructive migration rehearsal documenting branch ancestry, runtime entry, legacy preservation, Docker/CI, and cutover gates.
- [x] Complete production Docker build and container HTTP smoke test in CI (run 43588680792).
- [ ] Complete and record the full browser checklist on desktop, tablet, and mobile.
- [x] Archive the exact pre-cutover `main` prototype under `legacy/prototype/` (27 tracked files from commit `3c8c118`).
- [ ] Review the full source-to-main PR diff and merge only after all release gates pass.

**Current release posture:** `docs/game-foundation` is the candidate release branch. `main` remains unchanged. See [MIGRATION_REHEARSAL.md](MIGRATION_REHEARSAL.md) for the current comparison and exact cutover sequence.

## Phase 7 — Future options

Evaluate only when the single-player foundation is stable: multiplayer architecture and authoritative server; larger worlds and actor counts; advanced diplomacy or military conflict; modding and scenario tools; optional platform or distribution expansions.

## Definition of done for a development task

A task is not complete merely because code was written. Its acceptance criteria should be met, relevant tests and checks should be run, regressions should be reviewed, and documentation should be updated when behavior or decisions change.
