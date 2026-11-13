# Campaign UI — First Playable Interface

**Status:** Initial interactive shell connected to CampaignSession  
**Scope:** Package 2 of the first vertical slice  
**Branch:** `docs/game-foundation`

## Purpose

The campaign UI replaces the legacy stock-trading screen as the active application entry point. The legacy `App.tsx` and Zustand store remain in the repository but are not imported by the new application.

The new interface uses `CampaignSession` as its only campaign state owner. It does not read from or write to the legacy Zustand store.

## Current player loop

1. Start a new Compute Bottleneck campaign with the scenario's default seed.
2. Review Meridian Group and NodeWorks financial/operational position.
3. Review regional power, equipment availability, and player-visible intelligence estimates.
4. Select strategic initiatives within the current holding cash and leadership budgets.
5. Resolve the quarter through `CampaignSession.advance`.
6. Review the returned `QuarterReport`, including company economics, cash bridge, project outcomes, and autonomous actor actions.
7. Continue into the next quarter; after eight successful transitions the session exposes sandbox stage.

## UI boundaries

- Initiative names, descriptions, costs, duration, and effects are read from `COMPUTE_BOTTLENECK_INITIATIVES`.
- Company balances, capacity, projects, markets, and intelligence are read from the authoritative `GameState` snapshot.
- Financial operating results and causal events are read from `QuarterReport`.
- UI budget checks are convenience feedback only. The engine remains authoritative and validation issues are shown to the player.
- No hidden actor metrics are rendered. Only `playerIntelligence` estimates are shown.
- No save/load controls are included in this package; persistence UI is the next package.
- No contract negotiation, financing, workload override, autosave, or multiplayer controls are exposed yet.

## Files

- `src/game/ui/CampaignApp.tsx` — campaign shell, dashboard, strategy selection, market intelligence, and quarter review.
- `src/game/ui/format.ts` — display-only money, percentage, and quarter formatters.
- `src/main.tsx` — mounts the new campaign UI.
- `src/index.css` — responsive visual system for the campaign interface.

## Known limitations before playtest

- The current UI uses a fixed scenario seed of 2035 for reproducible first-playable testing.
- The opening report is a read-only snapshot; the report panel appears after the first quarter resolution.
- The eight-quarter completion state is surfaced as sandbox mode, but there is not yet a dedicated campaign evaluation screen.
- Save/load and JSON import/export are intentionally deferred to package 3.
- Browser smoke testing remains necessary after CI build checks.
