# Browser Smoke Test — Campaign Vertical Slice

**Status:** Prepared; not yet executed in a real browser  
**Branch:** `docs/game-foundation`  
**Scope:** End-to-end manual verification of the campaign UI, quarterly loop, persistence, and responsive layout.

This checklist complements automated engine and persistence tests. A passing CI build does **not** mean the browser smoke test has passed. Record the browser, OS, viewport, build/commit, and actual result for every test session.

## 1. Test session

- Tested commit:
- Application URL / preview:
- Browser and version:
- OS / device:
- Date:
- Tester:

For each case, mark **Pass**, **Fail**, or **Blocked** and record the observed result. Do not mark a case as passed based only on code inspection or CI.

## 2. Launch and opening state

### BS-01 — Application starts
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Open the application URL in a clean browser tab. Open the developer console.
- **Expected:** The application renders without a blank screen, fatal runtime error, or unhandled rejection. The campaign launch screen is usable.
- **Actual result / evidence:**

### BS-02 — Start a new campaign
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Start a campaign using a fixed test seed if the UI exposes one; otherwise use the normal start flow.
- **Expected:** A new Meridian Group campaign opens. The initial quarter is Q1. The dashboard shows the holding group and NodeWorks with plausible, internally consistent starting values.
- **Actual result / evidence:**

### BS-03 — Dashboard consistency
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Inspect the dashboard before making decisions.
- **Expected:** Quarter, cash, debt, capacity, workload, and financial-health indicators render without missing/NaN values. Values agree with the corresponding detailed panels.
- **Actual result / evidence:**

## 3. Strategic decisions and world resolution

### BS-04 — Initiative availability and selection
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Inspect the available strategic initiatives. Select one eligible initiative and review its cost, prerequisites, and expected effect.
- **Expected:** Eligibility and resource requirements are understandable. Selecting an initiative does not resolve the quarter prematurely.
- **Actual result / evidence:**

### BS-05 — Initiative validation
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Attempt an unavailable or otherwise invalid initiative, if the interface permits a safe attempt.
- **Expected:** The UI presents a clear validation message; invalid commands do not partially alter the campaign.
- **Actual result / evidence:**

### BS-06 — Market and intelligence
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Inspect market and intelligence information for customers, competitors, energy, and equipment.
- **Expected:** Own-group facts are distinguishable from external reports and estimates. Confidence/freshness information is visible where supplied. No hidden competitor values are presented as known facts.
- **Actual result / evidence:**

### BS-07 — Resolve a quarter
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Submit a valid set of decisions and advance the quarter once.
- **Expected:** The quarter advances exactly once. A report is shown for the resolved period. The report and dashboard reflect the same resulting state. No negative cash or invalid values appear.
- **Actual result / evidence:**

### BS-08 — Quarter report explains consequences
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Review the quarter report after BS-07.
- **Expected:** Material changes, operating outcomes, financial effects, and actor/market developments are readable. The report corresponds to the transition just completed.
- **Actual result / evidence:**

## 4. Customer contracts

### BS-09 — Contract portfolio rendering
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Open the customer contract portfolio.
- **Expected:** Active customer agreements show contracted/flexible workload, delivered workload where applicable, price, term, renewal window, and service-credit information without layout breakage.
- **Actual result / evidence:**

### BS-10 — Prepare a renewal proposal
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Edit a renewal proposal's price, guaranteed workload, and term. Do not submit an invalid proposal unless the UI explicitly supports safe validation.
- **Expected:** The editor retains the draft values. The displayed proposal is not represented as accepted before the simulation resolves the customer's response.
- **Actual result / evidence:**

### BS-11 — Renewal resolution and draft preservation
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Submit a valid renewal command during quarter resolution. If a safe validation failure can be induced, verify that unrelated draft decisions remain intact.
- **Expected:** The engine determines accept/counter/reject. A failed quarter transition does not silently discard pending UI drafts.
- **Actual result / evidence:**

## 5. Finance and credit

### BS-12 — Financial portfolio consistency
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Open the financial panel. Compare group and subsidiary cash, debt, debt service, and portfolio details with the dashboard.
- **Expected:** Legal-entity cash remains distinguishable; the UI does not imply that all cash is freely pooled. Debt balances and lender details are internally consistent.
- **Actual result / evidence:**

### BS-13 — Credit offers
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Inspect available credit offers and their lender, amount, rate, term, and covenant information. Accept an offer only in a disposable test campaign.
- **Expected:** The selected offer and its terms are clear. Acceptance is submitted as a campaign decision and only takes effect after successful quarter resolution.
- **Actual result / evidence:**

### BS-14 — Request financing
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Open the financing request flow. Inspect borrower, amount, term, and security inputs. Submit only a valid request in a disposable campaign.
- **Expected:** Required inputs are validated. Ineligible requests or covenant restrictions produce understandable feedback. No cash/debt changes occur before resolution.
- **Actual result / evidence:**

## 6. Save, restore, and JSON transfer

Use a disposable campaign for destructive or corruption-related cases.

### BS-15 — Save a campaign
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Save the campaign at a stable quarter boundary.
- **Expected:** The save operation completes with visible feedback. The campaign appears in the storage list with sensible metadata.
- **Actual result / evidence:**

### BS-16 — Reload and restore
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Reload the browser page. Restore the saved campaign from the storage panel.
- **Expected:** The same campaign and quarter are restored. Core state values match the saved state. No transient form state is expected to persist.
- **Actual result / evidence:**

### BS-17 — Continue after restore
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Advance one quarter after restoring.
- **Expected:** The campaign continues normally. No duplicate transition, stale-state overwrite, or persistence error occurs.
- **Actual result / evidence:**

### BS-18 — JSON export
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Export a valid saved campaign. Inspect that a file is downloaded and contains a campaign save envelope.
- **Expected:** Export completes and produces readable JSON. It represents the validated current revision, not UI-only state.
- **Actual result / evidence:**

### BS-19 — JSON import
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Import the exported file into a clean test profile or after deleting the disposable imported copy.
- **Expected:** The imported campaign appears and can be restored. Its campaign identity and state are preserved.
- **Actual result / evidence:**

### BS-20 — Campaign ID collision
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Import the same JSON again without deleting the first imported campaign.
- **Expected:** Import is rejected with a clear existing-campaign/collision message. The existing campaign is not overwritten.
- **Actual result / evidence:**

### BS-21 — Invalid or damaged import
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** In a disposable test, alter a copy of the exported JSON without updating its checksum, then attempt import.
- **Expected:** Import is rejected with a controlled integrity/validation error. No campaign record is created and the application remains usable.
- **Actual result / evidence:**

### BS-22 — Previous-revision recovery (optional advanced case)
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Only in a disposable local test profile and only if a safe documented method is available, corrupt the current stored revision after creating at least two valid revisions. Then restore the campaign.
- **Expected:** The repository reports recovery from the previous valid revision, identifies that fallback was used, and does not silently overwrite the damaged source. If corruption cannot be safely induced through supported tooling, mark Blocked rather than modifying a real campaign.
- **Actual result / evidence:**

## 7. Eight-quarter campaign and sandbox

### BS-23 — Complete the guided opening
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** In a dedicated campaign, play through eight successful quarterly transitions using a coherent strategy. Record any blockers or invalid states.
- **Expected:** The campaign reaches the Sandbox stage after eight completed quarters. It does not reset or force a scripted victory/defeat.
- **Actual result / evidence:**

### BS-24 — Continue in sandbox
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Advance at least one additional quarter after reaching Sandbox.
- **Expected:** The same campaign continues beyond the guided opening and retains its accumulated state.
- **Actual result / evidence:**

## 8. Responsive layout

Test the main dashboard, initiative area, contract portfolio, finance panel, quarter report, and storage panel at each viewport width.

| Viewport | Expected | Actual result |
| --- | --- | --- |
| 390 px (narrow mobile) | No horizontal page overflow; controls and data remain usable | |
| 768 px (tablet) | Panels reflow cleanly; no overlapping controls or clipped values | |
| 1280 px (desktop) | Intended multi-column layout; readable spacing and hierarchy | |

### BS-25 — Responsive and interaction check
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Use browser responsive mode or real devices at 390 px, 768 px, and 1280 px. At each width, scroll through all major panels and operate primary controls.
- **Expected:** No unintended horizontal scrolling, overlapping panels, clipped buttons, inaccessible dialogs, or unreadable financial values. Interactive controls remain reachable and usable.
- **Actual result / evidence:**

## 9. Completion summary

- Passed:
- Failed:
- Blocked:
- Critical defects:
- Non-blocking UX issues:
- Screenshots / recordings / console logs:
- Follow-up issue references:

**Exit criterion:** The browser smoke test is complete only after the critical launch, quarter-resolution, contract/finance, save/restore, JSON transfer, and responsive cases have been executed in a real browser. Record blocked cases explicitly; do not infer a pass from automated tests.

## 10. Initial manual browser pass (2026-11-14)

A manual browser check was reported by the project owner on 2026-11-14. The owner reported that the application looked good overall and no issues had been noticed at the time of testing.

- **Outcome:** Initial manual pass; no visible defects reported.
- **Browser / version:** Not recorded.
- **OS / device / viewport:** Not recorded.
- **Exact commit tested:** Not confirmed.
- **Individual case results:** Not recorded; the checklist above remains available for detailed follow-up.

This is a user-reported exploratory check, not a claim that every BS-01–BS-25 case was executed. Re-run targeted cases after material UI, campaign-flow, or persistence changes.


## 11. Markets & Intelligence destination

### BS-26 — Dedicated market intelligence view
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Open Markets & Intelligence from desktop and mobile navigation. Inspect regional power, equipment throughput, contracted workload, actor profiles, intelligence ranges, confidence/freshness, and recent world activity. Advance a disposable campaign by one quarter and inspect the updated report signals.
- **Expected:** The destination renders as a distinct strategy-game screen, not a dashboard continuation. Regional values match the authoritative scenario state. External actor information is sourced only from `playerIntelligence`; hidden actor metrics are never displayed. Known, reported, estimated, and unknown information remain visually distinguishable. Empty activity and missing-intelligence states remain understandable. No horizontal overflow or clipped content at 390 px, 768 px, and 1280 px.
- **Actual result / evidence:**


## 12. Quarter Strategy destination

### BS-27 — Dedicated quarterly planning view
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Open Quarter Strategy from desktop and mobile navigation. Inspect the leadership and capital meters, regional operating constraints, all initiative cards, projected effects, and the commitment preview. Select and deselect initiatives; then resolve one disposable campaign quarter.
- **Expected:** Quarter Strategy renders as a distinct executive-planning screen. Resource meters update immediately and consistently with selected initiatives. Active projects cannot be launched twice. Unaffordable initiatives cannot be selected. The commitment preview reflects the exact selected portfolio. Decisions do not affect campaign state until a successful quarter resolution. Validation errors remain visible and do not silently discard selections. Layout remains usable without horizontal overflow at 390 px, 768 px, and 1280 px.
- **Actual result / evidence:**


## 13. Shared visual system

### BS-28 — Cross-destination consistency and accessibility
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Visit Command Center, Corporation, Markets & Intelligence, and Quarter Strategy at desktop and compact widths. Compare page headings, quarter context, navigation active state, panel surfaces, badges, primary/secondary actions, and keyboard focus. Enable the operating system's reduced-motion preference and revisit the screens.
- **Expected:** All destinations read as one game interface while retaining their own hero illustration and information layout. The active navigation item is unambiguous visually and exposed as the current page to assistive technology. Shared controls and panels use consistent treatment. Focus remains visible for keyboard users. Reduced-motion preference suppresses nonessential transitions. No horizontal overflow at 390 px, 768 px, and 1280 px.
- **Actual result / evidence:**


## 14. Administration and reorganization

### BS-29 — Distress response and administration controls
- [ ] Pass  [ ] Fail  [ ] Blocked
- **Steps:** Use a disposable campaign state with NodeWorks in financial distress. Open Corporation and Command Center treasury views. File for administration, advance a quarter, attempt a workload change and new credit request, then resolve a viable reorganization after clearing arrears.
- **Expected:** The administration event is visually distinct and clearly explains its consequences. Filing creates one persistent case without changing cash, debt principal, or trade-payable balances. New borrowing, discretionary investment, and workload changes are rejected while essential operations and turnaround actions remain available. Reorganization is offered only after operating health is stable and trade payables, debt arrears, defaults, and covenant breaches are cleared. The liquidation preview reconciles company cash, asset proceeds, administration costs, creditor recoveries, unpaid claims, and shareholder residual. Confirm liquidation; all subsidiary assets are marked disposed, only that entity's debts and payables are reduced by recorded recoveries, the subsidiary cash becomes zero, and any residual is distributed by ownership shares. Save/restore preserves the case and resolution. Quarter progression is blocked after liquidation until post-insolvency group play is implemented. Both Corporation and Command Center show the same state.
- **Actual result / evidence:**
