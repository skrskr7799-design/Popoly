# Migration Rehearsal — Game Foundation to Main

**Status:** Non-destructive rehearsal prepared; no changes have been made to `main`.
**Source branch:** `docs/game-foundation`
**Target branch:** `main`

## 1. Repository snapshot

- Target `main` HEAD at inspection: `3c8c1183490562111f820dafd602eca18826df11`.
- Source branch HEAD at the start of this rehearsal: `0708786ecf8d62e45d8c2a6953069db675a6e2d9`.
- GitHub compare reported source branch **631 commits ahead, 0 behind**.
- The source branch is therefore ahead of the current target without target-only commits to reconcile. This is a large history range; inspect the complete PR commit/file list before choosing merge strategy.
- No merge, force-push, branch deletion, or change to `main` is part of this rehearsal.

## 2. Runtime entry and legacy preservation

- `src/main.tsx` on the source branch mounts `src/game/ui/CampaignApp.tsx`.
- `src/App.tsx`, `src/store/`, `src/entities/`, `src/data/`, and the old share-market implementation remain in the source tree. They are no longer the mounted application entry, but they have not yet been archived or removed.
- The legacy implementation must be preserved under `legacy/prototype/` from the exact target `main` snapshot before any legacy source paths are moved or removed.
- Before archiving/removal, verify import references and ensure the new campaign UI/engine does not depend on legacy modules. Keep the archive self-contained with a README identifying its source commit and original run instructions.
- Do not delete the old source from `src` until the archive has been checked and the production build/tests pass.

## 3. Build and deployment compatibility

| Area | Rehearsal finding | Release action |
| --- | --- | --- |
| React / Vite / TypeScript | Same application stack on both branches | Preserve |
| `src/main.tsx` | Source branch switches the mounted entry from legacy `App` to `CampaignApp` | Intended runtime cutover |
| `src/index.css` | Source branch contains the campaign UI styling changes | Keep after visual review |
| `package.json` | Source branch adds `npm test`, Vitest, and fake-indexeddb | Preserve dependencies/scripts |
| `vite.config.ts` | Unchanged in the comparison | No migration needed |
| `Dockerfile` / Compose | Existing static Vite build and port 3847 mapping retained | Build and container smoke test required |
| `docker-publish.yml` | Existing workflow is present on both branches and remains unchanged | Main push continues publishing the image |
| `game-engine-ci.yml` | Added on source branch; push validation plus PR validation against `main` | Keep as required pre-merge gate |

The Docker build install command has been aligned with CI's legacy-peer-dependency install flags. A CI step now builds the production image and starts it briefly to verify the served HTML entry point. Treat this check as pending until the latest workflow run completes successfully.

## 4. Validation already completed

- Lint, TypeScript production build, and game-engine tests passed on the source branch.
- Four managed 48-quarter seeds passed with per-quarter invariants and financial-balance checks.
- Persistence integration tests cover normal saves, operating payables, active creditor workouts, administration, completed liquidation, corrupted-current fallback, JSON transfer, and deterministic continuation.
- Campaign-session restore tests now explicitly cover active workout, active administration restrictions, and concluded liquidation.
- The project owner reported an exploratory browser check on 2026-11-14 with no visible issues. Browser/device/viewport and individual checklist results were not recorded, so this is not a substitute for the full browser checklist.

## 5. Final cutover sequence

1. Complete the latest CI run, including Docker build and container smoke test.
2. Complete and record the browser checklist on desktop, tablet, and mobile; include the exact tested commit.
3. Create `legacy/prototype/` from the exact pre-cutover `main` snapshot. Verify the archive is complete and independently identifiable.
4. Audit imports and remove/move only the legacy source files that are no longer needed by the active app. Keep the archived copy untouched.
5. Re-run lint, TypeScript build, all tests, Docker image build, and container smoke test on the final source commit.
6. Open a draft PR from `docs/game-foundation` to `main` for review. Confirm the base/head SHAs, 631-commit history range, changed-file list, and that no unrelated files or workflows are lost.
7. Merge only after explicit final review. Preserve the source branch and the pre-cutover `main` commit until the deployed image is verified.
8. After merge, verify the main-branch Docker publish workflow and test the published image on the intended host. Do not delete the source branch or legacy archive as part of the merge.

## 6. Explicitly not done

- `main` has not been modified.
- No pull request has been opened.
- No legacy source files have been moved or deleted.
- No Docker image has yet been deployed to the user's host.
- Full browser checklist execution remains outstanding.
