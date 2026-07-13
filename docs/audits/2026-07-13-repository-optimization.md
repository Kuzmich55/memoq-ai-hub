# Repository Optimization Audit — 2026-07-13

## Executive Summary

The repository has a sound product boundary: the native memoQ plugin is thin, the Electron worker owns AI/runtime behavior, shared wire metadata is centralized, and the current architecture/performance initiative has measurable acceptance evidence. The highest-return work is therefore not another broad refactor. It is tightening reproducibility, test isolation, and local desktop trust boundaries.

This audit selects and implements three implementation slices:

1. Track the pnpm lockfile, explicitly allow the required Electron/esbuild install scripts, and make CI/release installs frozen; run repository tests in CI and apply least-privilege CI permissions.
2. Remove the packaging regression test's dependency on an undeclared, stale transitive package.
3. Enforce a loopback-only gateway host, validate the gateway port, restrict external navigation/update URLs to HTTPS, and reject unsafe update artifact names.

No browser or external web source was used. “Industry practice” comparisons are stable engineering principles applied to the current code, while memoQ capability conclusions use only the bundled official SDK material under `docs/reference/`.

## Scope and Evidence

- Baseline commit: `5e906e7` (`v1.0.23`, current `main` when the audit began).
- Repository size: 357 tracked files; approximately 49,995 lines across application, native, tooling, and test surfaces.
- Baseline tests:
  - Repository: 15 passed, 0 failed.
  - Desktop: 403 total; 397 passed, 5 skipped, 1 failed.
  - The sole failure was `forge packaging resolves hoisted ESM-only package roots without a CommonJS export`, because `xml-naming` is neither declared nor present in the current lock graph.
- Dependency reproduction:
  - Generating a lock graph from ranges in offline mode drifted to `@electron-forge/* 7.11.2` and failed because the required archive was not cached.
  - Reusing the existing pnpm 10.6.2 lock graph completed a frozen offline install of 697 packages.
  - pnpm 10 blocks dependency install scripts unless explicitly approved; the clean install identified `electron`, `electron-winstaller`, and `esbuild` as the required build-script allowlist.
  - The final pnpm 10.6.2 offline frozen install completed with the lockfile SHA-256 unchanged at `76fa1f7f47edce30f9c8b9757b54d18f6d68e98512b4ec4f21b4699445957e2f`.
- Prior performance evidence at the same release commit remains valid: runtime startup, runtime RSS delta, and compact package size all exceeded the previous 20% improvement target.

## Architecture Assessment

### Strengths to preserve

- Clear process boundary: memoQ SDK adapter -> loopback gateway -> background runtime -> provider APIs.
- Shared desktop/plugin contract in `packages/contracts/desktop-contract.json`.
- Context isolation enabled and Node integration disabled in the renderer.
- Provider, runtime, asset, preview, packaging, UI interaction, logging, and release behavior have extensive focused tests.
- Sensitive logging keys are redacted and translation content is deliberately omitted.
- Runtime/provider/parser dependencies are lazily loaded; package content has dedicated smoke coverage.
- Database and persistence code use explicit schemas and transaction/rollback paths.
- UI governance already requires locale parity, keyboard behavior, responsive checks, and compile/package verification.

### Concentration risks

- `apps/desktop/src/renderer/src/App.jsx`: 4,423 lines.
- `apps/desktop/src/runtime/runtime.js`: 4,290 lines.
- `apps/desktop/src/provider/providerRegistry.js`: 1,154 lines.
- `native/preview-helper/.../Program.cs`: 1,107 lines.
- `native/plugin/.../MemoQAIDesktopSession.cs`: 1,012 lines.

These files are maintainability hotspots, but a broad split has high regression cost and no immediate user-facing or measurable runtime benefit. Decomposition should follow feature work and preserve the current benchmark protocol.

## Bundled Official SDK Assessment

### memoQ MT SDK 2.4.3

The native plugin follows the documented director/engine/session model:

- It declares interactive, batch, fuzzy-forwarding, and translation-storage capabilities.
- `IsLanguagePairSupported` stays local rather than calling a service, matching the SDK instruction.
- Engine/session construction, batch translation overloads, metadata overloads, `MTException`, and `StoreTranslation` are implemented.
- `MaxDegreeOfParallelism = 8` is valid but should continue to be treated as a per-language upper bound; the SDK explicitly warns that parallelism multiplies across target languages and can trigger rate limits.

Evidence anchors: `docs/reference/memoQ-MT-SDK-2.4.3/mt-sdk.md:352-370` documents director capabilities and the local-only language-pair check; `:406-413` documents lookup/store sessions and parallelism; `:623-631` documents single and batch `StoreTranslation`.

No immediate SDK-contract correction is justified. Future changes should keep plugin errors inside `TranslationResult.Exception`/`MTException` and retain result-array cardinality for batch calls.

### Preview SDK 9.1

The helper uses the documented named-pipe topology, terminal-session suffix, protocol negotiation, registration/connection, content updates, active preview parts, and preview-part-id requests. Named pipes are a good fit for the current local-only design and avoid running a second unauthenticated callback HTTP service.

Evidence anchors: `docs/reference/Preview_SDK_9_1/preview-sdk.md:220-287` describes endpoints, events, named pipes, and the terminal-session suffix; `:295-307` requires protocol negotiation before registration; `:367-380` defines active preview-part and preview-part-id messages.

### QA SDK 2.4.3 and terminology boundary

The QA SDK describes quick and batch QA add-ins that emit memoQ-native warnings/errors. The repository's terminology QA is instead an advisory runtime result; it is not a memoQ QA add-in. This is a deliberate product boundary, not a defect.

Evidence anchor: `docs/reference/memoQ-QA-SDK-2.4.3/qa-sdk.md:47-58` distinguishes quick and batch QA add-ins and their memoQ-native execution model.

The bundled MT, QA, and Preview documentation exposes no public TBX/term-base API. A case-insensitive `rg` search for `TBX`, `term base`, `glossary`, and `terminology` across all three SDK documents found only a QA problem category, not an integration API. Current TBX support is therefore correctly implemented as local file import and matching, not represented as memoQ term-base integration.

## Prioritization Method

- Priority: P0 critical now, P1 next delivery, P2 planned, P3 opportunistic.
- Impact, confidence, and effort use 1–5 scales.
- ROI score = `impact × confidence ÷ effort`. It is a comparison aid, not a financial forecast.

| ID | Recommendation | Priority | Impact | Confidence | Effort | ROI | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| D1 | Track `pnpm-lock.yaml`; frozen installs; correct cache key; run repo tests; least-privilege CI | P1 | 5 | 5 | 1 | 25.0 | Implemented + verified |
| T1 | Make packaging test hermetic instead of relying on `xml-naming` residue | P1 | 4 | 5 | 1 | 20.0 | Implemented + verified |
| S1 | Validate loopback host/port, HTTPS external/update URLs, and artifact filenames | P1 | 4 | 5 | 2 | 10.0 | Implemented + verified |
| Q1 | Resolve two orphan `test.skip` provider prompt cases or replace them with current-contract tests | P2 | 3 | 4 | 2 | 6.0 | Backlog |
| R1 | Add bounded main-to-worker request timeouts and cancellation cleanup | P2 | 4 | 4 | 3 | 5.3 | Backlog |
| S2 | Make standalone secret-storage mode explicit and fail closed when OS encryption is unavailable | P2 | 4 | 4 | 3 | 5.3 | Backlog |
| Q2 | Add lint/static analysis without weakening existing tests | P2 | 3 | 5 | 3 | 5.0 | Backlog |
| U1 | Add release-manifest SHA-256/signature metadata and verify installer bytes before launch | P1 | 5 | 4 | 4 | 5.0 | Separate contract change |
| M1 | Incrementally decompose `App.jsx` and `runtime.js` by feature/lifecycle boundary | P2 | 4 | 5 | 5 | 4.0 | Backlog |
| N1 | Record provenance/hashes for checked-in memoQ/native binary references and enforce release signing | P2 | 5 | 3 | 4 | 3.8 | Backlog |
| A1 | Normalize malformed JSON/body-limit failures into the gateway's stable JSON error contract | P3 | 2 | 4 | 2 | 4.0 | Backlog |

## Finding Details

### D1 — Dependency and CI reproducibility

Evidence:

- `.gitignore` ignores `pnpm-lock.yaml`, even though this is a shipped desktop application.
- CI and release cache against `apps/desktop/package.json`, then run non-explicit `pnpm install`.
- The local Windows release packager also runs a non-frozen install before producing public artifacts.
- CI does not run `pnpm run test:repo`, so release metadata, repository topology, and benchmark-contract regressions can merge unnoticed.
- The current package ranges already resolve differently without the existing local lock graph.

Industry-practice target:

- Applications commit their lock graph, use frozen installs in CI/release, and key caches from that lock graph.
- Required native/tool install scripts are allowlisted narrowly rather than enabled globally or left silently skipped.
- Every merge-blocking test suite is represented in CI.
- Read-only CI jobs declare minimal token permissions.

### T1 — Non-hermetic packaging test

Evidence:

- The failing test hard-codes `xml-naming`.
- `xml-naming` is absent from `package.json`, `pnpm-lock.yaml`, and the clean installation.
- The test passed previously only because another dependency graph left the package hoisted in `node_modules`.

Industry-practice target:

- A unit test creates its own temporary ESM-only package fixture and injects resolution roots. It should not depend on accidental transitive packages.

### S1 — Desktop trust-boundary validation

Evidence:

- Product docs and the shared contract define a local gateway at `127.0.0.1`, but `MEMOQ_AI_DESKTOP_HOST` currently accepts any bind address despite having no gateway authentication.
- `shell.openExternal` receives an arbitrary renderer-provided string.
- Update manifest asset URLs and names are accepted without protocol or path validation; names are joined directly under the update download directory.

Industry-practice target:

- Local unauthenticated services fail closed to loopback.
- Privileged shell/navigation IPC validates allowed protocols.
- Remote manifest fields and redirect targets are treated as untrusted input; artifact names cannot contain path separators or Windows-reserved device names, and download URLs require HTTPS.

### U1 — Update authenticity and integrity

The stable manifest contains names and URLs but no digest/signature. HTTPS protects transport, but byte-level verification before an installer launch is still the stronger release contract. This is P1 by impact but is not included in this pass because it changes the release metadata schema, packaging scripts, publication workflow, update state, and rollback behavior together. It should be a dedicated Spec Kit slice.

### R1 — Unbounded worker IPC

`invokeWorker` keeps requests in a map until a response or worker exit. A live but wedged worker can leave renderer actions pending indefinitely. Add per-operation deadlines, clear timers on every terminal path, and distinguish timeout from worker exit. Provider/network timeouts do not cover all worker failure modes.

### S2 — Standalone secret-storage ambiguity

An environment-equivalent Electron probe confirmed `safeStorage` is available in the normal `ELECTRON_RUN_AS_NODE=1` worker, so production worker secrets are encrypted. The Base64 fallback remains relevant to plain-Node standalone mode and unusual encryption-unavailable states. A later change should make that mode explicit rather than silently persisting reversible values.

### M1/Q2 — Maintainability and static analysis

The large runtime/renderer files and 93 catch sites increase review cost. Existing behavior coverage is strong, so the safer sequence is to add static analysis first, then extract one independently testable lifecycle/feature boundary per product change. A “big bang” rewrite has poor ROI.

## Selected Implementation Acceptance Criteria

1. `pnpm-lock.yaml` is present in the change set and no longer ignored, remains unchanged by `pnpm install --frozen-lockfile`, required dependency build scripts are explicitly allowlisted, and both CI/release use the lockfile as the cache/install source.
2. CI runs repository and desktop tests and has read-only token permissions.
3. A frozen offline install succeeds in the isolated worktree.
4. The packaging test passes from the locked dependency graph without `xml-naming`.
5. Non-loopback gateway hosts and invalid ports are rejected deterministically.
6. External/update URLs and final redirect targets reject non-HTTPS and credential-bearing URLs; artifact names reject traversal, path separators, trailing dot/space, and Windows-reserved device names.
7. Targeted tests, all desktop tests, repository tests, production renderer build, and native plugin regression/build gates pass.

## Implemented Changes

### D1 — Reproducible dependency and CI contract

- Added the root `pnpm-lock.yaml` to the repository change set and removed its ignore rule; it will become version-controlled with the eventual commit.
- Added a narrow `pnpm.onlyBuiltDependencies` allowlist for `electron`, `electron-winstaller`, and `esbuild`; no global lifecycle-script bypass was enabled.
- Changed CI and release caches to use the lockfile and installs to use `--frozen-lockfile`.
- Changed the local Windows release packager to use the same frozen-install contract.
- Added repository tests to CI, read-only CI token permissions, and cancellation of superseded CI runs.
- Added repository-level regression assertions for the lockfile, build-script allowlist, frozen installs, cache key, permissions, and repository-test step.

### T1 — Hermetic packaging regression

- Replaced the undeclared `xml-naming` dependency with a temporary ESM-only package fixture owned by the test.
- Added optional resolution roots to `resolvePackageDirectory` solely as a test seam; production defaults and package resolution behavior are unchanged.

### S1 — Desktop trust-boundary hardening

- Restricted the unauthenticated desktop gateway to `127.0.0.1` or `localhost` and validated ports as integers in `1..65535` before startup.
- Centralized external URL validation: HTTPS only, valid URL, and no embedded credentials.
- Applied the validator before `shell.openExternal`, to configured and manifest-provided update URLs, and to final manifest/download redirect targets.
- Rejected update artifact traversal, path separators, invalid Windows filename characters, trailing dot/space, overlong names, and Windows-reserved device names.
- Sanitized unsafe persisted update URLs/assets rather than re-exposing stale values after upgrade.

## Verification Matrix

| Acceptance area | Fresh verification | Result |
| --- | --- | --- |
| Locked install | pnpm 10.6.2 `install --offline --frozen-lockfile`; SHA-256 before/after | Passed; lock hash unchanged; Electron/esbuild binaries present; no pending builds |
| Focused trust-boundary regression | `node --test` for `externalNavigation`, `updateService`, `preloadSurface`, and `desktopContract` | 21 passed, 0 failed, 0 skipped |
| Full desktop regression | `node --test test/*.test.js test/*.test.mjs` | 413 total; 408 passed, 0 failed, 5 skipped |
| Repository governance | `node --test tests/repo/*.test.mjs` | 16 passed, 0 failed |
| Renderer production build | `pnpm --dir apps/desktop exec vite build --config vite.renderer.config.mjs` | Passed; 3,086 modules transformed |
| Native plugin regression | `dotnet run --project tests/plugin-regression/PluginRegression.csproj -c Release` | Passed all retry, fallback, concurrency, capability, and timeout scenarios |
| Native plugin Release build | `dotnet build native/plugin/MemoQ.AI.Desktop.Plugin/MemoQ.AI.Desktop.Plugin.csproj -c Release` | Passed; 0 warnings, 0 errors |
| Windows package | `pnpm --dir apps/desktop run package` | Electron Forge x64 package passed; Preview helper build had 0 warnings and 0 errors |
| Packaged runtime smoke | `releasePackaging.test.js` with `MEMOQ_AI_PACKAGED_APP_DIR` pointing at the final package | 3 passed: version metadata, `app.asar`, and transitive worker dependencies |
| Static diff check | `git diff --check` | Passed |

The five skips in the general desktop run are explicit: two existing provider prompt tests tracked as Q1, plus three artifact tests that require `MEMOQ_AI_PACKAGED_APP_DIR`. The latter three were then executed against the freshly generated package and all passed. One final packaging attempt encountered a transient TLS disconnect while Forge was resolving its Electron payload; the local Electron archive matched the vendor checksum, and the immediate retry completed successfully. No test was disabled or bypassed.

## Delivery Notes and Residual Risk

- Work-item linkage: local audit goal on branch `codex/repo-audit-high-roi`; no issue, PR, commit, push, release, or deployment was created.
- Release note candidate: dependency installs and CI are now reproducible, packaging tests are hermetic, and desktop/update navigation fails closed at local and HTTPS trust boundaries.
- Documentation sync: this audit is the durable technical record. No existing README contract advertised non-loopback gateway binding or HTTP update endpoints, so no user guide correction is required. Add a versioned release note only when these changes are scheduled for a release.
- Rollback watchpoint: D1 is one dependency contract and should be reverted as a unit; reverting only the lockfile or only frozen installs recreates drift.
- Rollback watchpoint: if a legitimate remote gateway or HTTP staging use case appears, do not relax S1 globally. Introduce an authenticated, explicit mode with dedicated tests and migration documentation.
- Remaining risk: update artifacts still lack digest/signature verification (U1), worker IPC can still wait indefinitely (R1), and standalone secret persistence still has a reversible fallback (S2).
- Remaining quality debt: the two provider `test.skip` cases remain visible as Q1; the renderer build still warns about a roughly 1.19 MB main chunk, consistent with M1/Q2 rather than a regression introduced here.
- External CI was not triggered because the requested scope forbids remote writes; the workflow changes are proven locally by repository contract tests and equivalent Windows commands, but the first GitHub Actions run remains the final platform-specific confirmation.
