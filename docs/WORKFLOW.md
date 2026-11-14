# Collaborative Development Workflow

## 1. Working relationship

The project is developed collaboratively by the user and ChatGPT.

- The user owns product direction and makes final design decisions.
- ChatGPT helps investigate, design, implement, review, test, and document.
- Important trade-offs and uncertainties must be made explicit.
- ChatGPT must accurately distinguish inspected, changed, and verified work.

## 2. Before implementation

For each meaningful task:
1. State the problem and desired outcome.
2. Inspect the relevant files and their dependencies in the current repository state.
3. Identify affected systems, risks, and assumptions.
4. Propose a bounded implementation and acceptance criteria.
5. Confirm significant design changes with the user before making irreversible or broad changes.

Do not rely on stale snippets when the repository may have changed.

## 3. Implementation

- Prefer small, reviewable changes.
- Avoid mixing unrelated refactors and features.
- Preserve existing behavior unless changing it is part of the task.
- Do not introduce abstractions without a concrete need.
- Keep domain rules out of UI components.
- Add or update tests with behavior changes.
- Update documentation when accepted design or technical decisions change.

## 4. Git workflow

- Keep the main branch stable.
- Use focused branches for substantial work.
- Use descriptive commits.
- For larger code changes, open a Pull Request with a summary, rationale, test results, and known limitations.
- Do not force-push or overwrite user work without explicit agreement.
- Preserve a recoverable snapshot before major rewrites.

Documentation-only changes may be committed directly to a dedicated documentation branch and reviewed before merging.

## 5. Verification and reporting

When reporting a task, clearly state files inspected; files created or changed; checks actually run and their results; behavior not verified; and known risks or follow-up work.

Never say that tests passed, the app ran, or a visual review was completed unless that check was actually performed.

## 6. Definition of done

A task is done when agreed acceptance criteria are satisfied; relevant automated checks have been run; related systems have been reviewed for regressions; documentation is updated where necessary; and the user receives a concise and truthful summary.

## 7. Design change control

New ideas are welcome, but distinguish approved direction; proposal awaiting discussion; experimental implementation; deferred idea; and rejected approach.

Record important decisions in DECISIONS.md so they are not lost in chat history.
