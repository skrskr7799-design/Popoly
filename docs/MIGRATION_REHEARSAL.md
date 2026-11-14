# Migration Rehearsal — Game Foundation to Main

**Status:** Draft migration PR opened; candidate is CI-green; no changes have been made to `main`.
**Source branch:** `docs/game-foundation`
**Target branch:** `main`
**Draft PR:** [#1 — Migrate Popoly Tech Dominion foundation](https://github.com/skrskr7799-design/Popoly/pull/1)

## 1. Repository snapshot

- Target `main` HEAD: `3c8c1183490562111f820dafd602eca18826df11`.
- Candidate snapshot validated in push and PR CI: `0eea3ca7767735b35c885b21ce246b5a4be6601e`.
- GitHub compare reports source branch **645 commits ahead, 0 behind**, across **111 changed files**.
- The PR is open, draft, and currently reported mergeable. It is not merged.
- The source branch is ahead of the current target without target-only commits to reconcile. The history range is large; review the complete PR commit/file list before choosing the final merge strategy.
- No merge, force-push, branch deletion, or change to `main` is part of this rehearsal.

## 2. Runtime entry and legacy preservation

- `src/main.tsx` on the source branch mounts `src/game/ui/CampaignApp.tsx`.
- `src/App.tsx`, `src/store/`, `src/entities/`, `src/data/`, and the old share-market implementation remain in the active source tree but are no longer the mounted application entry.
- [x] The pre-foundation prototype is archived under `legacy/prototype/` from the exact target `main` snapshot.
- The archive contains all **27 tracked files** from source commit `3c8c1183490562111f820dafd602eca18826df11`; `legacy/README.md` records provenance. The original Git blob objects were reused, preserving exact file contents.
- The old source remains in `src/` for now; no legacy source paths have been moved or deleted. Keep the archive untouched and remove active-tree duplicates only after a separate import audit.
- The active lint command is scoped to `src` (`oxlint src`), so archived legacy files are not treated as current application code. The root `.dockerignore` excludes `legacy`, keeping the archive out of the production build context.

## 3. Build and deployment compatibility

| Area | Rehearsal finding | Release action |
| --- | --- | --- |
| React / Vite / TypeScript | Same application stack on both branches | Preserve |
| `src/main.tsx` | Source branch switches the mounted entry from legacy `App` to `CampaignApp` | Intended runtime cutover |
| `src/index.css` | Source branch contains campaign UI styling changes | Keep after visual review |
| `package.json` | Adds `npm test`, Vitest, fake-indexeddb; lint targets active `src` | Preserve |
| `vite.config.ts` | Unchanged in the comparison | No migration needed |
| `Dockerfile` / Compose | Static Vite build and port 3847 mapping retained | Production image and HTTP smoke test passed |
| `docker-publish.yml` | Existing workflow is present on both branches and remains unchanged | Main push continues publishing the image |
| `game-engine-ci.yml` | Added on source branch; validates pushes and PRs to `main` | Keep as pre-merge gate |

The Docker build install command is aligned with CI's legacy-peer-dependency install flags. The workflow builds the production image, starts the container, and checks that the root HTML and compiled JS asset are served. The full push and PR workflows passed on candidate commit `0eea3ca`:
- [Push CI run 43588897995](https://github.com/skrskr7799-design/Popoly/actions/runs/43588897995)
- [PR CI run 43588902089](https://github.com/skrskr7799-design/Popoly/actions/runs/43588902089)

## 4. Validation already completed

- Oxlint: passed.
- TypeScript + Vite production build: passed.
- Game engine tests: **157 passed across 10 test files**.
- Managed campaign audit: four independent seeds × 48 quarters; each quarter checks domain invariants, legal-entity cash/debt balances, and finite operating reports.
- Persistence tests cover normal saves, operating payables, active creditor workouts, administration, completed liquidation, corrupted-current fallback, JSON transfer, and deterministic continuation.
- Campaign-session restore tests explicitly cover active workout, active administration restrictions, and concluded liquidation.
- Production Docker image build and container HTTP smoke test: passed in both push and PR CI.
- The project owner reported an exploratory browser check on 2026-11-14 with no visible issues. Browser/device/viewport and individual checklist results were not recorded; the full 29-case browser checklist remains a release gate.

## 5. Final cutover sequence

1. [x] Complete automated CI on the source branch, including lint, production build, tests, Docker build, and container HTTP smoke test.
2. Complete and record the browser checklist on desktop, tablet, and mobile; include the exact tested commit.
3. [x] Archive the exact pre-cutover `main` prototype under `legacy/prototype/`.
4. Review the full draft PR diff and confirm the archived snapshot, active entry point, and unchanged deployment workflow.
5. Decide the final merge strategy after reviewing the 645-commit history range. Do not merge while the PR is draft.
6. Merge only after explicit final review. Preserve the source branch and pre-cutover `main` commit until the deployed image is verified.
7. After merge, verify the main-branch Docker publish workflow and test the published image on the intended host. Do not delete the source branch or legacy archive as part of the merge.

## 6. Explicitly not done

- `main` has not been modified.
- Draft PR #1 is open but not merged.
- No legacy source files have been removed from `src/`; the complete original project snapshot is safely archived under `legacy/prototype/`.
- No Docker image has been deployed to the user's host.
- Full browser checklist execution remains outstanding.
