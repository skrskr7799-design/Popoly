# Technical Architecture Direction

**Status:** Principles approved; concrete architecture follows the code audit and game-design specification.

## 1. Current prototype

The repository currently uses Vite, React 19, TypeScript, Zustand, Tailwind CSS v4, Framer Motion, and lucide-react.

This describes the current frontend prototype, not a final commitment to every future technical choice.

## 2. Architectural goals

The architecture should support a deep simulation that can be tested, reasoned about, and extended without coupling game rules to presentation.

Core goals:
- clear domain boundaries;
- explicit ownership of game state;
- simulation rules independent of React components;
- predictable state transitions;
- testable economic and strategic calculations;
- controlled data flow between simulation and UI;
- versioned persistence and safe migrations;
- performance that scales with the intended world size.

## 3. Separation of responsibilities

### Domain model
Entities and concepts such as companies, ownership, regions, states, markets, technologies, people, and organizations.

### Simulation / rules engine
Rules that resolve actions, update actors, calculate economic outcomes, advance time, and process events. These rules should not depend on UI components.

### Application state and orchestration
Coordinates player commands, simulation steps, save/load, and presentation-ready state. Avoid turning one global store into the entire game engine.

### User interface
Displays the world, reports, options, and consequences. UI components should not independently implement economic or political rules.

### Data and content
Definitions for scenarios, companies, sectors, technologies, events, and balancing parameters should be organized and validated.

## 4. Simulation quality

Where practical, make important calculations pure functions; make simulation steps reproducible from known state and inputs; control randomness through explicit seeds or random sources; test invariants such as ownership limits, accounting consistency, and valid state transitions; and keep a record of why significant outcomes occurred, so the UI can explain them.

The exact simulation model and time-step strategy remain open.

## 5. Persistence

Save/load is a core system, not a late convenience. The design should account for schema versions; validation of loaded data; migrations between versions; recovery from invalid or incomplete saves; and separation of durable campaign state from transient UI state.

## 6. Future multiplayer

Multiplayer is deferred. However, avoid unnecessary assumptions that make it impossible later: keep simulation rules outside browser components; represent player commands explicitly; define clear state transitions; avoid relying on client-only authority for rules that may later require server validation.

Do not build networking, accounts, synchronization, or an authoritative server until the single-player game justifies them.

## 7. Engineering quality gates

For meaningful changes, use appropriate checks: TypeScript build; lint; unit tests for domain rules; integration tests for interacting systems; deterministic simulation tests where applicable; save/load and migration tests; manual gameplay and UI review.

A passing build does not prove that the game is balanced or fun. Technical correctness and gameplay quality must both be evaluated.
