# Campaign Session — Application Boundary

**Status:** Initial implementation contract  
**Scope:** Vertical Slice package 1

## Responsibility

`CampaignSession` is the application-facing owner of one authoritative `GameState`. It connects the pure quarter engine, opening/last-quarter reporting, and the existing persistence repository without coupling the engine to React or Zustand.

## Lifecycle

1. Start a campaign from the validated Compute Bottleneck scenario.
2. Build an opening situation report without advancing time.
3. Accept player `QuarterCommands` and call the pure `advanceQuarter` engine.
4. Replace the authoritative in-session state only when the engine returns success.
5. Expose defensive snapshots so UI callers cannot mutate the campaign accidentally.
6. Save explicitly at a stable quarter boundary through `CampaignSaveRepository`.
7. Restore through the existing validation, checksum, compatibility, and previous-revision recovery pipeline.

## Eight-quarter evaluation

The scenario opens in quarter 1. Each successful transition resolves the current quarter and advances the state to the next quarter. After eight transitions, the state opens quarter 9 and the guided evaluation is complete. The same state can continue advancing as a sandbox; no reset or separate simulation mode is introduced.

The stage is derived from the authoritative quarter (`state.quarter - 1` completed transitions), so it survives save/load without introducing a second source of truth.

## Persistence boundary

- No implicit autosave or hidden writes occur during quarter resolution.
- `save()` persists the current state and metadata using the existing versioned envelope.
- `restore()` delegates to `restoreCampaign`; a recovered previous revision is surfaced to the caller.
- The application boundary does not bypass save validation or invent a second serialization format.

## Deliberate exclusions

This package does not connect React screens, migrate the legacy Zustand store, add a new action economy, change scenario balance, add cloud sync, or implement new simulation mechanics. Those belong to later Vertical Slice packages.
