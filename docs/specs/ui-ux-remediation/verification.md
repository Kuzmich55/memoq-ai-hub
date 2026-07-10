# UI/UX Remediation Verification

Verification date: 2026-07-10

## Acceptance Mapping

| # | Problem group | Implementation evidence | Automated evidence | Manual/visual evidence |
|---|---|---|---|---|
| 1 | Navigation, Dashboard, and real workflow disagree | `APP_SECTIONS`, runtime checklist, Dashboard actions, README, and both user guides use Integration → AI Services → optional Assets → Setup → Translation Records. | `runtime.test.js`, `rendererShell.test.mjs`, and `uiBehavior.test.mjs` assert the ordered five-step journey. | Packaged Dashboard sequence checked; user reported no issue. |
| 2 | Narrow layouts reserve a 72px rail | The shell uses expanded navigation at 1366px, compact navigation at 1024px, and a Drawer at 768px and below. The old mobile 72px CSS override is removed. | `uiBehavior.test.mjs` covers 1366/1024/768/767; `rendererShell.test.mjs` asserts the Drawer branch and absence of the mobile override. | Packaged app checked at 1366px, 1024px, and 768px; user reported no overflow or navigation issue. |
| 3 | Custom rows lack keyboard semantics | Provider and Profile selectors use listbox/option semantics, selected state, focus rings, and Enter/Space activation. History and Asset actions use native controls. | `componentInteraction.test.mjs` loads the real JSX component through Vite and triggers Enter/Space; `uiBehavior.test.mjs` covers the activation helper. | Packaged keyboard path checked; user reported no issue. |
| 4 | Dashboard is a card wall | A single journey panel presents onboarding progress; runtime/integration stays separate; updates are under maintenance disclosure. | Renderer build and Dashboard regression assertions pass. | Packaged hierarchy checked; user reported no issue. |
| 5 | Setup, AI Services, and History are too dense | Setup uses staged sections and sticky actions; AI Services folds advanced request controls; History folds advanced filters and technical details; Assets uses top filter/search. | Renderer build, locale parity, and renderer regression tests pass. | Packaged disclosures checked; user reported no issue. |
| 6 | Page position and dirty drafts are unsafe | Shell storage preserves valid page, navigation preference, and per-page scroll positions. Provider/Profile navigation uses Save/Discard/Stay, visible dirty state, and `beforeunload`. | `uiBehavior.test.mjs` covers storage, scroll read/write, and dirty routing; desktop draft tests cover rebase/discard. | Packaged leave-protection flow checked; user reported no issue. |
| 7 | Card-heavy hierarchy lacks orientation | Every page has a shell-level title and description; navigation is grouped by Overview, Configure, Activity, and Support; diagnostic content is disclosed. | Locale parity, responsive CSS regressions, and renderer build pass. | Packaged visual hierarchy checked; user reported no issue. |
| 8 | UI tests only inspect source strings | New behavior tests exercise shell state/navigation, and a Vite-backed component test invokes the real Profile row keyboard handler. | `componentInteraction.test.mjs` and `uiBehavior.test.mjs` pass with the full desktop suite. | Manual packaged-app verification complements automation; user reported no issue. |

## Fresh Commands And Results

- Targeted UI tests: `node --test test/componentInteraction.test.mjs test/uiBehavior.test.mjs test/rendererShell.test.mjs` — 35 passed, 0 failed.
- Desktop suite: `node --test "test/*.test.js" "test/*.test.mjs"` — 399 total, 394 passed, 5 existing skips, 0 failed.
- Repository suite: `pnpm run test:repo` — 11 passed, 0 failed.
- Renderer production build: `pnpm --dir apps/desktop exec vite build --config vite.renderer.config.mjs` — 4,859 modules transformed; build passed.
- Windows package: direct Electron Forge `package` invocation — x64 package completed successfully.
- Manual verification: packaged `memoQ AI Hub.exe` checked at 1366px, 1024px, and 768px; the user reported no problems.

## Skipped Checks And Residual Risk

- Five desktop tests are pre-existing package/provider skips and were not disabled by this change.
- Automated offscreen Electron capture returned `ERR_FAILED` before renderer loading in this environment. The packaged Windows application was used for the required visual and overflow check instead.
- The renderer bundle remains above Vite's 500 kB warning threshold. This predates the remediation and is a future code-splitting opportunity, not a functional failure.
- Data tables intentionally scroll inside their own containers; page-level horizontal scrolling remains disallowed.
