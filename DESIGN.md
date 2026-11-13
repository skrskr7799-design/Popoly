# Popoly: Tech Dominion

**Design foundation:** 1.0 (documentation baseline)  
**Last updated:** 2026-11-13  
**Project status:** Transitioning from the original local prototype to a new grand-strategy design foundation.

## What is Popoly?

Popoly is a hardcore grand-strategy and economic simulation set in an alternative near-future around 2035. The player begins as a corporate power and can gradually grow into a force capable of shaping regions, institutions, technology, and the wider world.

The chosen direction is a **hybrid model**: corporate strategy is the starting identity; a broader world-shaping sandbox is the long-term destination.

## Core pillars

- Strategic agency and meaningful trade-offs.
- Independent corporations, states, and other actors.
- Interconnected economic, technological, political, and intelligence systems.
- Emergent stories and consequences.
- Information, uncertainty, and intelligence as strategic resources.
- Hardcore simulation depth with a clear, usable interface.
- Single-player first, with future multiplayer considered but deferred.

## Documentation map

| [Prototype Audit](docs/AUDIT.md) | Findings from the current code review and recommended rebuild direction |

| Document | Purpose |
|---|---|
| [Vision](docs/VISION.md) | Project identity, player fantasy, pillars, and principles |
| [Game Design](docs/GAME_DESIGN.md) | World, player role, actors, progression, and gameplay cycle |
| [Systems](docs/SYSTEMS.md) | Major simulation systems and their interactions |
| [Roadmap](docs/ROADMAP.md) | Development phases and exit criteria |
| [Architecture](docs/ARCHITECTURE.md) | Technical principles and target boundaries |
| [Workflow](docs/WORKFLOW.md) | Collaborative development and verification process |
| [Decisions](docs/DECISIONS.md) | Accepted decisions and their rationale |

## Development approach

1. Preserve the current prototype as a recoverable baseline.
2. Audit the existing code and gameplay systems.
3. Complete the game-design specification.
4. Define the simulation and technical foundation.
5. Build and test a compact vertical slice.
6. Expand systems only when the core loop proves engaging.
7. Iterate through playtesting, balance, UX, and technical validation.

See [ROADMAP.md](docs/ROADMAP.md) for the detailed phases.

## Current prototype versus future design

The existing application is a prototype and contains earlier local economic-strategy mechanics. Those mechanics are not automatically the specification for the future game.

The audit will classify existing work as preserve, refactor, replace, remove, or investigate further.

## Project status

This documentation is the initial agreed foundation, not a complete game design specification. Detailed decisions about world scale, map structure, time progression, actor simulation, influence, victory conditions, and the first playable scenario remain to be made collaboratively.

The implementation status of each system must be verified against the repository and actual runtime checks before being reported as complete.
