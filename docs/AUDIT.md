# Prototype Audit

**Audit date:** 2026-11-13  
**Target:** `docs/game-foundation` (prototype source currently matches `main`)  
**Scope:** Static repository/code review of the current React/TypeScript prototype. No local build, browser playtest, or runtime profiling was performed.

## Executive verdict

The prototype is useful as a record of early ideas and as a small UI/interaction experiment. It is **not a sound implementation foundation for the agreed Popoly direction**.

The recommended path is to preserve the repository history and selectively retain useful concepts/data, while rebuilding the playable core around a new domain model and simulation engine. Do not attempt to evolve the current stock-trading loop into the full game by accumulating features.

The current prototype is a short local stock-market contest. The agreed game is a persistent, systemic grand-strategy simulation in which the player builds a corporate group and gradually gains economic, technological, infrastructural, institutional, and political influence. These are different game structures.

## 1. Confirmed findings

### Critical — economy has incompatible scales

- Each player starts with **$10,000,000**.
- The eight listed companies have a combined initial market capitalization of **$419,550**.
- One player's starting cash is therefore about **23.8 times the entire listed market**; four players collectively start with about **95.3 times that value**.
- Company cash-flow values are only **40–320** per round, while actions such as espionage, security upgrades, and intelligence upgrades cost hundreds of thousands or millions.
- Dividends are calculated directly from those small cash-flow values, so they are negligible relative to player capital.

This makes the economy internally inconsistent. The values may have been authored on different scales. A balance pass cannot fix this reliably; the economic model and units need to be defined first.

**Evidence:** `src/store/gameStore.ts`, `src/data/companies.ts`, `src/data/sectors.ts`.

### Critical — share supply is not enforced

`buyShares()` checks player cash and action points but does not check how many shares remain available. Multiple players can collectively acquire more shares than a company has issued. The current control calculation then selects the player with the largest percentage at or above 50%, even if aggregate ownership exceeds 100%.

The market needs an explicit ownership/supply model: available float, issued shares, treasury/locked shares, transfers between owners, and any future issuance/dilution rules.

**Evidence:** `src/store/gameStore.ts` — `buyShares()`, `getOwnershipPercent()`, `recalculateControl()`.

### Critical — price movement is disconnected from a credible market model

The current price impact is linear in the number of shares traded. In the base phase, a 50-share transaction changes price by roughly 17.5% before rounding. There is no order book, market depth, available float, bid/ask spread, external demand, or separation between market price and fundamental value. Events can also multiply prices directly.

This creates large price jumps without a coherent model of liquidity or company performance.

**Evidence:** `src/store/gameStore.ts` — `applyPriceImpact()`; `src/data/economy.ts`; `src/data/events.ts`.

### Critical — the current game loop does not represent the agreed game

The player interacts primarily as a personal shareholder. Companies have no operating cycle, management, production, research pipeline, workforce, contracts, financing strategy, or meaningful corporate treasury. The player does not found or operate a holding group.

The current loop is: buy/sell shares, borrow, upgrade intelligence, run espionage, leak secrets, and end turn. It cannot support the agreed progression from corporate power to broader world influence without replacing its central model.

**Evidence:** `src/entities/types.ts`, `src/store/gameStore.ts`, `src/App.tsx`.

### High — victory scoring rewards control bonuses more than systemic achievement

The score combines net worth with large fixed bonuses for controlled companies, sector control, adjacency, and reputation. A controlled company adds a fixed $3M plus a sector bonus of roughly $0.9M–$1.6M, while the total initial listed market capitalization is only $419,550.

Espionage, research, institutional influence, and other strategic behavior do not form distinct victory paths. The current winner check is a short score race (from round 12, or at round 20).

This scoring system should not be carried forward as the foundation for Popoly's long-term objectives.

**Evidence:** `src/store/gameStore.ts` — `getScore()`, `checkVictory()`; `src/data/sectors.ts`.

### High — simulation logic and application state are tightly coupled

`src/store/gameStore.ts` is a 722-line Zustand store containing state, domain rules, market calculations, debt, espionage, events, dividends, bot behavior, turn sequencing, and victory checks. UI state and simulation state are not cleanly separated.

The store should become a thin application-state/orchestration layer. Domain rules and simulation transitions should be pure, independently testable modules operating on explicit state and inputs.

**Evidence:** `src/store/gameStore.ts`.

### High — simulation is not reproducible

Gameplay uses `Math.random()`, `Date.now()`, and nested `setTimeout()` calls directly. There is no seeded random source, command/event history, or deterministic turn resolver. That makes bugs and balance outcomes difficult to reproduce and makes save/replay or future multiplayer synchronization much harder.

A simulation core should accept an explicit random seed/state and resolve commands in a deterministic order. UI animation and bot pacing should not determine game rules.

**Evidence:** `src/store/gameStore.ts`, `src/data/companies.ts`, `src/data/secrets.ts`.

### High — there is no automated test foundation

The package scripts expose build and lint commands, but no test script or test framework is configured. No automated checks cover market invariants, ownership, debt, turn transitions, event resolution, or bot decisions.

Before adding complex systems, establish domain-level unit tests and simulation invariant tests.

**Evidence:** `package.json`.

### Medium — bots are heuristic action loops, not independent strategic actors

Bots use weighted preferences and random choices, but do not maintain plans, evaluate long-term goals, reason about threats, or respond to a changing world model. Their behavior is adequate as placeholder opposition for the prototype, not as the basis for the independent actors described in the design.

**Evidence:** `src/data/bots.ts`, `src/store/gameStore.ts`.

### Medium — event content is mostly cosmetic market repricing

Events apply direct multipliers to company prices, cash flow, reputation, security, or credit ratings. There are no persistent event chains, actor decisions, player responses, policy choices, or systemic propagation through supply chains and institutions.

The event content can be mined for setting and narrative seeds, but the current event-effect model should be replaced by causal simulation rules and event consequences.

**Evidence:** `src/data/events.ts`, `src/store/gameStore.ts`.

### Medium — current UI is a compact prototype dashboard

`src/App.tsx` is a 629-line component that owns most screen composition and local interaction state. The layout is a three-panel players/market/actions interface, with a tabbed mobile version. It is functional as a prototype but does not communicate the scale, world state, organizational structure, or strategic priorities of the intended game.

The UI should be redesigned around player questions and decision workflows, not merely split into more tabs. A Command Center should summarize meaningful changes, threats, opportunities, and decisions; deeper views should expose the underlying systems.

**Evidence:** `src/App.tsx`, `src/index.css`.

### Medium — no campaign persistence

The game state is held in memory. There is no save/load model, schema versioning, migration strategy, or recovery from a closed/reloaded session.

Persistence is not required for the first simulation experiment, but it becomes essential before a longer campaign or meaningful progression can be tested.

**Evidence:** `src/store/gameStore.ts`, `src/entities/types.ts`.

### Medium — build pipeline is not reproducible enough

The repository does not contain a `package-lock.json`, while the Docker build uses `npm install` and a wildcard copy for the lock file. Dependency resolution can therefore change between builds. The workflow publishes an image on pushes to `main`, but does not define a separate pull-request validation pipeline for typecheck, lint, tests, and build.

Add a committed lockfile and CI validation before relying on automated releases.

**Evidence:** `package.json`, `Dockerfile`, `.github/workflows/docker-publish.yml`.

## 2. Classification

| Area | Decision | Rationale |
|---|---|---|
| Near-future Big Tech setting and sector themes | Preserve as inspiration | Fits the agreed world, but needs broader and more original world-building |
| Company names and initial company roster | Investigate / replace | Useful placeholders; the world needs a coherent actor and region model |
| Stock trading and share ownership | Refactor / redesign | Ownership matters, but must sit inside a real corporate-finance model |
| Current price-impact formula | Replace | No credible liquidity or valuation foundation |
| Current cash-flow and dividend formulas | Replace | Units and economic meaning are inconsistent |
| Economy phases | Preserve as a concept; redesign implementation | Macro cycles are useful, but need causal effects on firms, states, and markets |
| Sector relationships | Preserve as a concept; redesign data | Sector dependencies can become supply-chain and strategic interdependence |
| Espionage and discovered secrets | Preserve as a concept; redesign deeply | Information asymmetry is a strong pillar, but needs intelligence networks, risk, counterintelligence, and consequences |
| Current event catalogue | Mine for narrative seeds | Event themes are useful; direct multiplier effects are too shallow |
| Bot personalities | Preserve as inspiration only | Different strategic archetypes are useful, current behavior is placeholder logic |
| Fixed action-point economy | Do not assume it is final | Time and action resolution remain an open design decision |
| Current score / victory check | Replace | Does not support multiple long-term paths to influence |
| Zustand store as simulation engine | Replace | Domain simulation must be independent from UI state |
| Current App layout | Replace | Does not express the intended player fantasy or information hierarchy |
| React, TypeScript, Vite, Tailwind | Preserve provisionally | Suitable for the current web prototype; revisit only if a concrete need appears |
| Docker / GHCR delivery | Preserve provisionally | Useful development convenience, not a gameplay architecture decision |
| Local single-player first | Preserve | Matches the agreed development strategy |

## 3. Recommended target structure

Build the next prototype as a **small, coherent vertical slice**, not as a miniature version of every planned system.

The first slice should prove this loop:

1. The player controls a small corporate group with a clear starting position.
2. A handful of independent companies operate in a small number of connected sectors.
3. The player chooses between a small set of meaningful investments, acquisitions, partnerships, or research initiatives.
4. Company performance changes through understandable causes: demand, costs, capacity, talent, technology, financing, and external shocks.
5. Competitors and at least one institution react according to their own goals.
6. The player receives reports with uncertainty, interprets what happened, and makes the next strategic decision.
7. Consequences persist across multiple turns and can create both opportunities and setbacks.

The first slice does **not** need a full world map, dozens of sectors, detailed workforce simulation, warfare, multiplayer, or a large content catalogue.

## 4. Technical direction

Recommended separation:

- **Domain:** companies, corporate groups, ownership, contracts, technologies, actors, money, and rules.
- **Simulation engine:** deterministic state transitions, economic periods, actor decisions, event resolution, and invariant validation.
- **Application layer:** player commands, turn orchestration, save/load, and notifications.
- **Presentation:** React views, interaction state, visualizations, and localization.
- **Content/data:** scenario definitions, companies, regions, technologies, events, and actor profiles.

Keep the simulation independent of React and Zustand. Represent player actions as validated commands and simulation outcomes as explicit state changes. Use seeded randomness for reproducible events and actor behavior.

## 5. Priority order

1. **Freeze the old prototype as a reference baseline.** Do not keep layering features onto its current economy.
2. **Specify the first playable scenario.** Define the player, starting group, actors, sectors, time step, available decisions, and what makes a turn interesting.
3. **Define economic invariants and units.** Decide what money represents, how company value is formed, where revenue/cost/profit/cash/debt live, and how ownership is constrained.
4. **Design the smallest corporate model.** A few companies with operating performance, treasury, ownership, management capacity, and a reason to interact.
5. **Implement a deterministic simulation core with tests.**
6. **Build a playable vertical slice and test whether decisions are genuinely interesting.**
7. **Only then expand into technology, intelligence, institutions, regions, and the broader world.**

## 6. Open questions requiring design decisions

- What is the time unit: month, quarter, or another strategic period?
- Does the player start with an existing holding, a single company, or capital and a founding opportunity?
- Are companies independently owned actors, player-created entities, or both?
- How much of the economy is simulated directly versus abstracted?
- What is the first scenario's central pressure: competition, capital scarcity, technology race, infrastructure bottleneck, or institutional constraint?
- How should ownership, control, voting rights, debt, equity issuance, and acquisitions work?
- What information is public, private, delayed, estimated, or deliberately misleading?
- What is the minimum meaningful behavior expected from AI-controlled companies and institutions?

## 7. Verification limits

This audit is based on repository source inspection. The application was not installed or run in a local environment; no browser playtest, production build, lint run, or automated test run was performed. Runtime behavior, visual responsiveness, and any issues requiring execution remain to be verified in a later validation pass.
