# Vertical Slice Playthrough Verification

**Status:** Automated technical acceptance coverage  
**Scenario:** The Compute Bottleneck  
**Campaign length:** Eight quarterly transitions, Q1 through Q8, then sandbox at Q9

## Test matrix

The integration test runs each of three player approaches with two deterministic seeds (2035 and 2042):

| Approach | Initial commitments | Intended strategic outcome |
|---|---|---|
| Scale-first | Capacity expansion + equipment allocation; later firm power | Installed compute capacity increases |
| Resilience-first | Resilience and security + market study | Service reliability improves |
| Bottleneck control | Equipment allocation + firm power; later market study | NodeWorks' grid allocation increases |

The test resolves all eight quarters through `CampaignSession.advance`, not by calling internal quarter helpers directly.

## Automated acceptance checks

For all six playthroughs:
- every quarter resolves successfully;
- the report quarter and next authoritative state quarter remain aligned;
- the final state is Q9 and the session enters sandbox stage;
- `validateGameState` returns no invariant violations;
- no legal entity finishes with negative cash.

The test also verifies that the three strategies produce their intended distinct state changes: installed capacity, reliability, and grid allocation respectively.

## Persistence concurrency regression

The IndexedDB repository now serializes commits for the same campaign through a per-campaign in-process write queue. The regression test uses two repository instances pointed at the same database and starts two commits concurrently from the same initial snapshot. Exactly one commit must succeed; the stale commit must return `storage.concurrent_write`.

The repository still uses an IndexedDB read/write transaction and compares the current stored revision against the captured preflight snapshot. The in-process queue supplements, rather than replaces, transaction atomicity.

## What this proves — and what it does not

This is technical playthrough coverage, not a balance verdict. It demonstrates that three different initiative mixes can complete the guided campaign for the tested seeds without violating state or cash invariants, and that their intended project effects become visible.

It does not yet establish that the strategies are equally profitable, optimally balanced, or fun across a broad seed distribution. Those are playtest and balance tasks after a real browser walkthrough.

## Current verification boundary

- GitHub Actions TypeScript and production build: passed.
- Automated test suite: passed.
- Real browser smoke test of start → play → save → reload → import/export: still required.
- Visual review on desktop and tablet/mobile widths: still required.
