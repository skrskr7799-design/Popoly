# Technical Specification — Vertical Slice Simulation

**Status:** Target implementation contract, not a claim about existing code.  
**Stack direction:** Retain React, TypeScript, Vite, and Zustand for the current client; isolate the simulation in framework-independent TypeScript modules.  
**Mode:** Single-player, deterministic/reproducible quarterly simulation.

## 1. Scope

Implement the first playable scenario with:
- Meridian Group and controlled NodeWorks;
- a small number of independent companies and institutional actors;
- compute, energy, equipment, and AI-demand dependencies;
- quarterly player commands and leadership capacity;
- estimates-based rival intelligence;
- eight-quarter guided opening and sandbox continuation;
- save/load with schema versioning;
- causal reports explaining important outcomes.

Not in scope: multiplayer networking, full exchange/order book, military systems, detailed employee simulation, complete political simulation, or large-scale world generation.

## 2. Architectural boundary

The simulation must not import React, Zustand, browser APIs, DOM types, or UI components.

Suggested module layout (adapt to repository conventions after inspecting the current tree):

```text
src/
  app/                 # application orchestration and route composition
  ui/                  # reusable presentation components
  features/             # screens and interaction flows
  game/
    domain/             # entities, IDs, value types, invariants
    commands/           # player command schemas and validation
    engine/             # quarter orchestration and state transitions
    systems/            # economy, projects, energy, demand, actors, intel
    ai/                 # rival and institution policies
    scenario/           # scenario definitions and initial state
    reports/            # causal log and player-facing explanations
    persistence/        # save schema, validation, migrations
    content/            # data-driven definitions and tuning parameters
  state/                # Zustand adapters for UI-facing state only
  tests/
    unit/
    integration/
    scenarios/
```

This is a target structure, not an instruction to move every existing file immediately. Refactor incrementally after the current source tree is re-inspected.

## 3. Authoritative state

Define a serializable `GameState` containing:
- schema / simulation version;
- campaign and scenario metadata;
- current quarter;
- deterministic random seed and random-stream state;
- organizations and companies;
- ownership ledgers;
- regions and sector conditions;
- contracts and projects;
- financial ledgers and debt instruments;
- actor goals / policy state;
- player information and intelligence estimates;
- event and causal report history;
- campaign objectives and continuation state.

Do not store derived display values as independent authoritative fields unless there is a strong reason. Derive them from canonical state or maintain them through tested reducers.

UI-only state (selected tab, open modal, sorting, filters, temporary form values) must not be included in campaign saves.

## 4. Commands and validation

Player intent is represented as typed commands, not direct component mutations.

Each command has:
- stable command ID;
- actor / issuer;
- target entity IDs;
- parameters;
- issue quarter;
- optional expected state/version precondition.

Command processing:
1. validate schema and referenced IDs;
2. validate authority and ownership/governance rights;
3. validate prerequisites and current phase;
4. validate leadership capacity;
5. validate financial commitments and facilities;
6. validate project / actor eligibility;
7. return structured validation errors or an accepted command.

Invalid commands must not partially mutate state.

Initial command families:
- sponsor project;
- negotiate / pursue contract;
- secure energy reservation;
- procure critical equipment;
- fund efficiency or resilience initiative;
- commission market research;
- propose partnership / acquisition, only if the scenario enables it;
- delegate or change a strategic policy, if required.

Keep command payloads explicit and versionable. Avoid generic `doAction(type, payload:any)` APIs.

## 5. Quarter engine

Expose a small deterministic API, conceptually:

```ts
type AdvanceQuarterResult = {
  state: GameState;
  report: QuarterReport;
};

function validateCommand(
  state: GameState,
  command: PlayerCommand
): ValidationResult;

function applyCommands(
  state: GameState,
  commands: PlayerCommand[]
): CommandResolution;

function advanceQuarter(
  state: GameState,
  acceptedCommands: PlayerCommand[],
  random: RandomSource
): AdvanceQuarterResult;
```

The exact signatures may evolve, but the engine must:
- be independent of UI state;
- make phase ordering explicit;
- use injected deterministic randomness;
- return a new state or an explicit immutable transition;
- produce a structured causal report;
- preserve invariants after every resolved quarter.

No hidden timers, `Math.random()`, `Date.now()`, or network calls inside domain rules. Timestamps and randomness must be injected at the boundary when needed.

## 6. Determinism and randomness

A campaign should be reproducible from:
- initial scenario version;
- initial seed;
- ordered player commands;
- simulation/content version.

Use a seeded PRNG or an injected random source. Prefer separate named random streams for independent subsystems (for example, actor decisions and operational incidents) so adding one random draw in one subsystem does not unpredictably rewrite every later outcome.

Do not use nondeterministic randomness for routine calculations. Random outcomes should be bounded, explainable, and recorded in the report when they materially affect the player.

## 7. Actor AI

Rivals and institutions use goal-driven policies, not scripts that mirror the player.

Each actor policy receives:
- its own true operational state;
- its own information set;
- goals and constraints;
- available legal actions;
- deterministic random source.

It returns candidate actions with scores/reasons, then selects a valid action. Store a concise decision trace: goal, relevant inputs, selected action, and key reason(s).

The player-facing intelligence layer must not leak the actor's hidden state. It receives only reports, public facts, and estimates generated through explicit information rules.

## 8. Information model

Represent knowledge separately from world truth.

A knowledge record should include:
- subject and field;
- value or interval;
- classification: known, reported, estimated, unknown;
- confidence;
- source type;
- observed quarter / age;
- expiry or decay policy where applicable.

Do not overwrite true rival state with an estimate. UI displays only the player-accessible information set.

## 9. Economy and numeric safety

- Use integer minor currency units for money.
- Use explicit physical units and conversion helpers.
- Avoid floating-point accumulation for accounting.
- Define rounding rules for division, rates, and proportional allocation.
- Centralize balance coefficients in scenario/tuning data.
- Validate all inputs at command boundaries.
- Avoid silent clamping that hides invalid states.

Pure functions should implement core calculations where practical: effective capacity, service delivery, revenue, operating cost, debt service, cash bridge, ownership totals, and valuation estimate.

## 10. Reports and explainability

Every quarter returns a structured report containing:
- phase summaries;
- command acceptance/rejection;
- project progress and blockers;
- actor decisions and observable outcomes;
- production/delivery and contract outcomes;
- financial ledger entries;
- changes in reputation, risk, and information;
- causal links from inputs/actions to outcomes;
- warnings and newly available opportunities.

A report is part of the simulation output, not prose assembled ad hoc by UI components. UI may format it into concise narratives and drill-downs.

## 11. Persistence

Define a versioned save envelope:
- format identifier;
- save schema version;
- simulation/content version;
- scenario ID and version;
- campaign ID;
- created / updated metadata supplied at the application boundary;
- serialized authoritative state;
- optional integrity checksum if justified.

Loading must:
1. parse safely;
2. validate envelope and payload;
3. migrate supported older schemas in ordered migrations;
4. validate domain invariants;
5. reject unsupported/corrupt saves with actionable feedback.

Keep migrations pure and tested. Do not serialize Zustand internals as the save format.

## 12. Testing strategy

### Unit tests
- money arithmetic and rounding;
- capacity and delivery;
- energy consumption and cost;
- revenue and cash bridge;
- debt service;
- ownership and voting;
- command validation;
- leadership budget;
- estimate confidence / staleness.

### Integration tests
- a quarter with player initiatives and rival actions;
- power scarcity delaying expansion;
- equipment shortage delaying commissioning;
- customer contract shortfall and penalties;
- financing and distress recovery;
- estimate generation without hidden-state leakage;
- save/load round trip and migration.

### Scenario tests
Run the eight-quarter scenario under multiple seeds and player strategies:
- scale-first;
- efficiency/resilience;
- bottleneck-control;
- mixed/adaptive.

Assert invariants and collect metrics. Do not assert one fixed winning path or exact narrative outcome unless the test is specifically for deterministic replay.

## 13. Performance and future multiplayer

The first slice is small; clarity and correctness matter more than premature optimization. Still:
- use stable entity IDs;
- keep commands explicit;
- keep engine transitions serializable;
- avoid UI components as authority;
- avoid global mutable singletons.

This makes later server authority possible without building networking now.

## 14. Definition of implementation-ready

The technical foundation is ready for feature implementation when:
- domain types and units are defined;
- command validation is implemented and tested;
- quarter phase order is explicit;
- deterministic random source is available;
- core accounting and ownership invariants pass;
- a seeded scenario can advance repeatedly without UI dependencies;
- save/load format and migration policy exist;
- reports explain the most important changes.
