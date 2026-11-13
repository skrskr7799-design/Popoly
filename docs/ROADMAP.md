# Development Roadmap

**Status:** Initial plan; sequence may change when audits and prototypes reveal better options.

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

**Progress note:** An initial static code audit is documented in [AUDIT.md](AUDIT.md). Runtime validation, local build, browser review, and a complete persistence / CI verification pass remain outstanding.

Deliverables:
- findings classified by severity and impact;
- preserve / refactor / replace / remove recommendations;
- known risks and missing tests;
- proposed migration sequence.

**Exit criteria:** We understand what exists, what is unreliable, and what can be reused. Do not claim runtime validation unless it has actually been run.

## Phase 2 — Game design specification

Resolve the core design questions: world scale, regions, and map representation; player role and progression of influence; major actor types and their independent goals; time model and action economy; first playable gameplay loop; initial victory and campaign objectives; information, uncertainty, and feedback.

**Working proposal:** [VERTICAL_SLICE.md](VERTICAL_SLICE.md) defines the first scenario and its proposed mechanics. It is awaiting collaborative review and is not yet a locked specification.

**Exit criteria:** A bounded first playable experience can be described precisely enough to implement and test.

## Phase 3 — Simulation and technical foundation

- define domain model and authoritative simulation state;
- separate rules and simulation from UI rendering;
- define deterministic or reproducible simulation steps where practical;
- design save/load and versioning;
- establish automated tests for core rules;
- keep future multiplayer in mind without building multiplayer prematurely.

**Exit criteria:** Core simulation rules can be exercised independently of the interface.

## Phase 4 — Vertical slice

Build one compact scenario with a small world and a limited number of actors. It should include a meaningful economic decision, an independent rival response, and a visible consequence that affects the next decision.

**Exit criteria:** A new player can understand the situation, make strategic choices, and find the resulting chain of consequences engaging.

## Phase 5 — Expand and deepen

Only after the vertical slice is enjoyable, deepen corporate structures and markets; add technology and infrastructure dependencies; expand state and institutional behavior; add intelligence and counterintelligence; improve rival strategies and emergent events; and expand regional and global influence.

**Exit criteria:** Each new system improves the strategic experience and passes integration and balance checks.

## Phase 6 — UX, balance, and content

Redesign the interface around strategic questions and actionable information; add onboarding and contextual explanations; balance viable strategic paths; test long campaigns and edge cases; improve accessibility, performance, and presentation.

## Phase 7 — Future options

Evaluate only when the single-player foundation is stable: multiplayer architecture and authoritative server; larger worlds and actor counts; advanced diplomacy or military conflict; modding and scenario tools; optional platform or distribution expansions.

## Definition of done for a development task

A task is not complete merely because code was written. Its acceptance criteria should be met, relevant tests and checks should be run, regressions should be reviewed, and documentation should be updated when behavior or decisions change.
