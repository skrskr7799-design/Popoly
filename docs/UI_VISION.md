# Popoly UI Vision

**Status:** Accepted direction for the next UI phase  
**Date:** 2026-11-14  
**Branch:** `docs/game-foundation`  
**Purpose:** Replace the current dashboard-like presentation with a coherent grand-strategy game experience without changing simulation rules or expanding the vertical-slice scope.

## 1. Product experience

Popoly is a near-future (2035) grand-strategy / economic simulation / corporate sandbox. The player leads a holding company and builds a technology-focused corporate group in a world where companies, customers, infrastructure providers, competitors, and institutions pursue their own interests.

The interface must make the player feel like the executive leader of a living corporate empire—not an operator configuring a SaaS dashboard.

The UI should consistently answer four questions:

1. What is happening in my group and in the surrounding world?
2. What is the most important threat or opportunity?
3. Why is it happening, and how confident are we in that information?
4. What strategic decision can I make now, and what could it change?

## 2. Visual direction

**Design language:** premium grand-strategy game meets a near-future corporate command system.

- Dark graphite and deep blue-gray surfaces; avoid flat stacks of identical cards.
- Restrained turquoise/cyan for focus, active systems, and positive operational signals.
- Amber for pressure, uncertainty, and warnings; red only for material danger or failure.
- Strong editorial hierarchy: large page titles, compact uppercase metadata, readable body copy, clear numeric emphasis.
- Use maps, network diagrams, timelines, company identity, event feeds, and data visualizations as game-world representations—not decoration.
- Use motion sparingly and purposefully: view transitions, live status changes, event arrival, quarter resolution, and map focus.
- Prefer contextual explanations and cause/effect summaries over unexplained metrics.
- Avoid the visual language of generic admin templates: repetitive metric tiles, dense form-first layouts, excessive tiny uppercase labels, and every feature competing for attention.

The visual identity must remain legible and usable at desktop, tablet, and mobile widths. Responsive behavior is part of the design, not a later CSS patch.

## 3. Information architecture

The long-term game spaces are:

- **Command Center** — executive situation, urgent developments, strategic opportunities, current priorities, and the next quarter decision.
- **World Map** — geography, regions, infrastructure, markets, and corporate presence.
- **Corporation** — holding structure, subsidiaries, ownership, assets, management, and group strategy.
- **Markets** — demand, supply, prices, customers, competitors, and sector conditions.
- **Technology** — research, capabilities, technological dependencies, and investment.
- **Intelligence** — estimates, reports, rival activity, confidence, freshness, and unknowns.
- **Politics** — regulators, permits, institutional influence, and public programs.
- **News & Events** — a chronological account of important world and company developments.

These are destination concepts, not a requirement to expose empty or non-functional sections immediately. Navigation must only advertise spaces that have meaningful content in the current playable build. Future spaces may be introduced progressively when the simulation supports them.

## 4. First implementation scope

The current vertical slice remains one region and a small number of consequential actors. It explicitly does not require a full global map or a broad content expansion.

The first UI redesign should deliver:

### 4.1 Game shell

- Persistent game identity and campaign context.
- Clear primary navigation between actual screens, not anchor links down one long page.
- Consistent quarter/date and campaign status.
- Contextual action area for save/archive and other session-level actions.
- A responsive navigation pattern for smaller screens.

### 4.2 Command Center

The first screen after loading a campaign.

It should prioritize:
- A strong campaign/region header and a sense of place.
- A regional strategic visualization or schematic showing the actual dependencies represented by the scenario: compute capacity, power availability, equipment constraints, customer demand, and the rival.
- Meridian Group and NodeWorks' strategic position.
- A small number of meaningful alerts, opportunities, and recent developments.
- The most important current-quarter decisions, with cost, time, constraint, and expected consequence explained.
- A clear transition into quarter planning and resolution.

The regional visualization must be grounded in scenario data. It must not invent geographic precision or pretend that the first slice contains a fully simulated world map.

### 4.3 Corporation

A dedicated view for Meridian Group and NodeWorks:
- Holding and operating-company identity.
- Ownership/control relationship.
- Separate cash and debt positions for each legal entity.
- Operational capacity, utilization, reliability, and dependencies.
- Customer portfolio and contract exposure.
- Financial detail available progressively rather than all presented at once.

### 4.4 Markets and Intelligence

- Regional supply/demand and infrastructure constraints.
- Asterion AI customer position and demand signals.
- Kestrel Compute rival position and known/estimated activity.
- Clear distinctions between known, reported, estimated, and unknown information.
- Confidence and freshness presented as part of the game, not hidden metadata.

### 4.5 Quarter resolution

Quarter planning and resolution should feel like a strategic turn:
1. Review the situation and incoming developments.
2. Choose a limited set of strategic priorities.
3. Review commitments and constraints before confirming.
4. Resolve the quarter with a clear transition.
5. Present a readable outcome report: what changed, why, who acted, and what new choices emerged.

The simulation engine remains authoritative. UI changes must not silently alter the economic model, command validation, actor behavior, or save format.

## 5. Interaction principles

- Separate strategic overview from detailed management. Do not put every control on the first screen.
- Use progressive disclosure: show the decision and its consequence first; expose advanced detail when requested.
- Every major decision should communicate capital cost, leadership cost, duration, relevant dependencies, and known uncertainty where available.
- Distinguish player-controlled decisions from autonomous outcomes.
- Preserve drafts when an action fails validation.
- Explain engine rejection in player-facing language; technical codes may remain available as secondary detail.
- Reports should connect outcomes to causes and prior decisions.
- Avoid false precision: estimated competitor information must remain visibly estimated.
- Do not introduce decorative buttons or navigation destinations without real behavior.

## 6. Design system and components

Build a small reusable UI foundation before styling each screen independently:

- App shell, primary navigation, page header, contextual action bar.
- Campaign/quarter status and event/alert treatments.
- Company and actor identity blocks.
- Strategic map/diagram frame and legend.
- Decision cards with consequence and cost hierarchy.
- Timeline/event feed.
- Data visualizations with readable labels and units.
- Detail panels, drawers, and confirmation/review surfaces.
- Empty, loading, error, and unavailable states.

Use consistent spacing, typography, borders, radii, semantic color tokens, focus states, and motion rules. Prefer CSS variables/design tokens over scattered one-off values.

## 7. Technical boundaries

- Keep the current GameState, CampaignSession, quarter engine, and persistence pipeline intact.
- Do not reconnect the new UI to the legacy Zustand game store.
- Keep screen components separate from domain/simulation logic.
- Derive displayed values from current authoritative state and reports; do not create a second source of truth in UI state.
- Keep the first redesign within the existing React/TypeScript stack and dependencies unless a concrete need is demonstrated.
- Do not add new simulation mechanics solely to fill a screen.
- Do not modify `main`; all work remains on `docs/game-foundation`.

## 8. Delivery sequence

1. **Design foundation and game shell:** tokens, typography, navigation, responsive layout, screen routing/state.
2. **Command Center:** the visual centerpiece and primary gameplay entry point.
3. **Corporation:** group structure, NodeWorks operations, contracts, and financial details in dedicated views.
4. **Markets and Intelligence:** regional conditions, rival/customer context, and uncertainty.
5. **Quarter planning and resolution:** decision review, turn transition, and readable consequences.
6. **Polish and usability:** responsive passes, keyboard/focus behavior, empty/error states, motion restraint, and manual browser review.

Each step should be small, testable, and committed independently. Existing functional behavior must remain available during the migration; do not remove a working feature until its replacement is connected and verified.

## 9. Acceptance criteria

The redesign is successful when:

- The first screen reads as a strategy game command center rather than a KPI dashboard.
- The player can understand the current situation and identify the next meaningful decision without scanning a long page.
- Major game spaces have clear identities and purposeful navigation.
- The regional visualization communicates real scenario relationships without pretending to be a complete world simulation.
- Corporation, finance, contracts, markets, and intelligence are organized into coherent destinations.
- Quarter planning and resolution communicate decisions and consequences as a game turn.
- All existing campaign, finance, contract, and save/load capabilities remain functional.
- The interface works at desktop, tablet, and mobile widths.
- The UI never implies a simulation feature exists when it is only a placeholder.
