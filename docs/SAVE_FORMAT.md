# Save Format and Persistence Contract

**Status:** Accepted implementation contract for the first Save / Load implementation.  
**Scope:** Single-player authoritative campaign state for the current Game Engine.

## 1. Boundary and source of truth

A save contains the framework-independent `GameState` defined in `src/game/domain/types.ts`. It does not serialize Zustand stores, React state, UI selections, modal state, filters, temporary forms, or derived display values.

The initial implementation stores only the authoritative state at a stable quarter boundary. A `QuarterReport` is a transition result, not part of the current authoritative `GameState`, and is therefore not included in the first save format. If campaign report history becomes a product requirement, it will be designed as a separate, explicitly versioned record.

The current domain model has `GameState.schemaVersion = 1`. Do not add campaign identity, timestamps, storage metadata, or checksum fields to GameState merely to support persistence; those belong to the envelope.

## 2. Version dimensions

These dimensions are deliberately independent:

1. **Save schema version** — shape and semantics of the outer persistence envelope.
2. **GameState schema version** — shape and semantics of the authoritative simulation state.
3. **Scenario version** — content and rules identity of the selected scenario.
4. **Simulation version** — engine rules/build compatibility identifier.

The envelope records all four. The first release supports the current save schema and current GameState schema, plus only scenario/simulation combinations explicitly accepted by a compatibility registry. Unknown future versions must be rejected, not guessed.

A save-format migration must not silently perform a GameState or scenario migration. Each migration family has its own registry and explicit input/output version contract.

## 3. Envelope

The logical envelope is:

```ts
interface CampaignSaveV1 {
  format: 'popoly-campaign-save';
  saveSchemaVersion: 1;
  simulationVersion: string;
  campaignId: string;
  createdAt: string; // ISO-8601 UTC timestamp
  updatedAt: string; // ISO-8601 UTC timestamp
  scenarioId: string;
  scenarioVersion: string;
  gameStateSchemaVersion: number;
  quarter: number;
  checksum: string; // "sha256:" followed by lowercase hexadecimal digest
  state: GameState;
}
```

The exact TypeScript type will live in the persistence module. Runtime decoding is mandatory: a type assertion on parsed JSON is not validation.

Rules:
- `campaignId` is generated once when a campaign is first persisted and remains stable across later saves and imports.
- `createdAt` is immutable for a campaign; `updatedAt` changes for each successful revision.
- Time is supplied by an injected application-boundary clock, not read from domain rules.
- `scenarioId`, `scenarioVersion`, `gameStateSchemaVersion`, and `quarter` must match the corresponding values in `state`.
- `simulationVersion` identifies the engine rules expected to interpret the state. Compatibility is explicit; it is not inferred from a semver comparison alone.
- The envelope is metadata around the state, not a second source of truth.

## 4. Canonical serialization and integrity

The checksum is SHA-256 over canonical UTF-8 JSON for the envelope with the `checksum` property omitted.

Canonical JSON rules:
- recursively sort object keys lexicographically;
- preserve array order;
- use JSON string escaping and number serialization;
- reject values that are not representable as JSON (including `undefined`, functions, BigInt, non-finite numbers, and cyclic structures);
- do not include whitespace outside JSON strings.

The digest is stored as `sha256:<lowercase-hex>`. Verification recomputes the digest using the same canonicalization function and compares the complete value.

The checksum detects accidental corruption and incomplete/manual edits. It is not a digital signature, does not authenticate the author, and does not prevent deliberate tampering. Do not describe it as anti-cheat protection.

Use the Web Crypto SHA-256 implementation behind a small injectable digest interface so the canonicalization and checksum logic can be unit-tested independently.

## 5. Save pipeline

1. Accept a GameState only at a stable quarter boundary; do not save a partially applied transition.
2. Run `validateGameState` against the state.
3. Construct envelope metadata using injected campaign ID, clock, and version providers.
4. Verify metadata mirrors the authoritative state.
5. Canonically serialize the envelope without checksum and calculate SHA-256.
6. Attach the checksum and serialize the complete envelope.
7. Persist the new revision through the storage repository in one atomic IndexedDB transaction.
8. Retain the previous current revision as the single recovery revision.

A failed validation, serialization, digest, or storage transaction must leave the last committed revision unchanged.

## 6. Load and recovery pipeline

Treat every imported or stored save as untrusted input.

1. Read the raw string/bytes without modifying the stored record.
2. Parse JSON and convert syntax failures into a structured decode error.
3. Structurally validate the envelope before reading nested properties.
4. Check format identifier and supported save schema version.
5. Verify checksum against canonicalized envelope content.
6. Apply registered save-envelope migrations in order, if any.
7. Validate the GameState object shape before passing it to domain code.
8. Apply only explicitly registered GameState migrations, if any.
9. Check simulation and scenario compatibility through explicit registries.
10. Run `validateGameState` and return all domain invariant issues as structured load failures.
11. Verify duplicated envelope metadata matches the final migrated state.
12. Return a fully validated campaign object only after every stage succeeds.

The decoder must never assume a typed object is safe because JSON parsing succeeded. In particular, malformed nested arrays/objects must produce a controlled validation result rather than a thrown property-access exception.

If the current revision fails validation, the repository may attempt the retained previous revision. Recovery must report that a fallback was used and why. It must not overwrite or delete the damaged source automatically. If both revisions fail, return a structured unrecoverable-save error and preserve both records for diagnosis/export.

Import follows the same pipeline. It must not overwrite an existing campaign until the imported save has fully passed validation and the user/application explicitly resolves any campaign-ID collision.

## 7. Migration policy

Migration functions are pure transformations:
- input is immutable;
- output is a new value;
- no storage, clock, network, or UI access;
- deterministic for the same input;
- each migration declares exact source and target versions.

Maintain separate ordered registries for:
- save envelope schema;
- GameState schema;
- scenario content/version compatibility.

Never mutate the source save in place. A successful load of an older supported save does not silently rewrite the original record. A later explicit save may write the current version as a new revision.

Unknown newer versions are rejected with an actionable unsupported-version error. Do not attempt best-effort loading.

## 8. Storage adapter

The first backend is IndexedDB, not `localStorage`.

The persistence core depends on an adapter/repository interface, not directly on browser storage APIs. The IndexedDB adapter is responsible for:
- create/list campaign metadata;
- read current revision;
- read previous revision;
- atomically commit a new current revision and rotate the prior current revision to previous;
- delete a campaign only through an explicit repository operation;
- atomically create-only commit imported campaigns so an ID collision cannot overwrite an existing record, including when two imports race.

The current and previous revisions for one campaign must be updated in a single read/write transaction. Before rotating, the adapter verifies the existing current revision's structure, checksum, and domain invariants; if it is damaged, the last retained previous revision is preserved instead of replacing it with corrupt data. The adapter compares the preflight revision with the value read inside the write transaction and reports a concurrent-write conflict rather than overwriting a newer revision. A failed transaction must roll back both changes. Keep storage records separate from domain types.

The repository must expose failures as structured errors. Do not silently fall back to in-memory or localStorage persistence.

## 9. JSON portability

Provide JSON export for a validated current revision and JSON import through the full load pipeline. The portable file is the envelope itself; do not invent a second interchange format.

Export must not expose IndexedDB implementation details. Import must preserve the campaign ID unless an explicit duplicate/copy workflow is later designed.

## 9A. JSON transfer behavior

`exportCampaignSave` reads only the current revision, validates it through the normal load pipeline, and returns the canonical envelope JSON. It must not export a corrupt or unsupported revision. `importCampaignSave` runs the same decoder, checksum, compatibility, and domain validation before writing. It preserves the envelope campaign ID and refuses collisions. The repository enforces create-only semantics inside the write transaction so concurrent imports cannot overwrite one another after a successful preflight check.

## 10. Initial module boundaries

Adapt names to the existing tree, but keep responsibilities separated:

- `persistence/types.ts` — envelope, metadata, structured errors.
- `persistence/canonicalJson.ts` — deterministic canonical serialization.
- `persistence/checksum.ts` — SHA-256 digest and verification.
- `persistence/decode.ts` — unknown JSON structural decoder.
- `persistence/migrations/` — pure versioned migration registries.
- `persistence/save.ts` — validated envelope creation.
- `persistence/load.ts` — ordered validation and restoration pipeline.
- `persistence/repository.ts` — storage-neutral repository contract.
- `persistence/indexedDbRepository.ts` — IndexedDB implementation.
- `persistence/transfer.ts` — JSON import/export orchestration.

The first implementation phase may deliver the pure Save Core before IndexedDB and transfer adapters. Do not couple this module to React, Zustand, the legacy `src/store/gameStore.ts`, or UI components.

## 11. Explicitly deferred

Not part of the first persistence milestone:
- autosave scheduling;
- cloud synchronization or accounts;
- multiplayer/network persistence;
- command/event log and deterministic replay;
- saving transient UI state;
- storing the quarter report history;
- legacy Zustand store integration;
- cryptographic signatures or anti-cheat guarantees.

## 12. Acceptance tests

The persistence foundation is not complete until tests cover:

- valid state → envelope → canonical JSON → decode/load round trip;
- stable canonical output regardless of object insertion order;
- checksum changes when authoritative content changes;
- malformed JSON and malformed nested structures return structured errors;
- unsupported save/GameState/scenario/simulation versions are rejected;
- registered migrations run in exact order and do not mutate their input;
- envelope metadata/state mismatches are rejected;
- domain invariant failures prevent restoration;
- failed writes preserve the previous committed revision;
- recovery loads the previous valid revision without modifying the corrupt current revision;
- JSON import/export round trip across separate repositories;
- import rejects checksum damage without writing;
- import rejects campaign-ID collisions and concurrent duplicate imports without overwriting existing data;
- deterministic continuation: advance a campaign, save/load into a fresh engine instance, apply identical subsequent commands, and compare resulting states and reports.

Deterministic continuation is a required test, not an assumption. The current `GameState` contains a seed but no explicit mutable PRNG cursor. The existing `src/game/engine/random.ts` exposes a pure PRNG state API, while the current `advanceQuarter` path does not import it. Before asserting deterministic continuation, audit all engine/system/scenario paths for hidden mutable state and nondeterministic sources, then test the exact continuation behavior. If a mutable random stream is introduced later, its complete state must become part of authoritative GameState and be covered by a GameState schema migration.
