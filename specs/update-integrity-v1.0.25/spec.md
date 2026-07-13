# Update Integrity Contract for v1.0.25

## Goal

Add SHA-256 metadata to published update assets and prevent an installed build from launching a downloaded installer unless its bytes match the trusted manifest digest.

## Context

- `v1.0.24` publishes a stable manifest with HTTPS asset URLs but no byte digest.
- The desktop update service can download an installer asset and the main process can launch the downloaded path.
- Repository audit item U1 is the only remaining P1 recommendation and explicitly calls for a dedicated release-contract change.

## Constraints

- Keep the current GitHub Release, stable-channel URL, asset names, and portable browser-download behavior.
- Use Node.js built-ins; add no dependency.
- Existing manifests without a digest remain readable for version checks and portable browser navigation.
- Application-managed installer download and launch fail closed when the digest is missing, malformed, or mismatched.
- Do not mutate published tags or release assets; publish this contract as `v1.0.25` only after main CI passes.

## Done When

- The stable manifest contains a lowercase 64-character SHA-256 for the ZIP and 7z assets generated in the same packaging run.
- Manifest parsing preserves valid digests and rejects malformed non-empty digests.
- Installer download verifies bytes before writing the destination file.
- Installer launch re-verifies the persisted file against the manifest digest immediately before `shell.openPath`.
- Focused, repository, desktop, native, packaging, main CI, release workflow, and published-asset checks pass for `v1.0.25`.

## Repositories in Scope

- `langlink-localization/memoq-ai-hub` only.

## Source of Truth

- Release version: `apps/desktop/package.json`.
- Manifest contract and generation: `tooling/scripts/release-metadata.mjs`.
- Runtime enforcement: `apps/desktop/src/update/updateService.js` and the main/background worker IPC path.
- Engineering state: remote `main`, GitHub Actions, tag `v1.0.25`, and its GitHub Release.

## Non-Goals

- Asymmetric code signing or a separate signing service.
- Changing the memoQ SDK/plugin contract, provider APIs, release asset names, or packaging mode.
- Enabling in-app portable archive download or self-update.

## Verification Gates

1. Manifest unit tests cover generated digests, missing artifacts, and malformed digest input.
2. Update-service tests cover valid download, mismatch rejection without file persistence, missing digest rejection, persisted digest handling, and launch-time re-verification.
3. Main-process surface tests prove verification occurs before `shell.openPath`.
4. Repository tests, full desktop tests, renderer build, native plugin regression/build, and the complete Windows packaging script pass.
5. Main CI passes before the tag is created.
6. The release workflow succeeds and the downloaded published manifest digests match GitHub's uploaded ZIP/7z asset digests.

## Rollout Waves

1. Implement and verify in an isolated worktree.
2. Fast-forward merge to local `main`, push, and wait for main CI.
3. Create and push `v1.0.25` from the exact green main commit.
4. Verify the formal Release, release notes, asset state, sizes, digests, and stable manifest contents.

## Rollback Condition

- Before tagging: stop on any failed verification, manifest compatibility regression, or digest mismatch.
- After tagging: do not rewrite `v1.0.25`; disable the affected download path if necessary and fix forward with a new patch release.

## GitHub Links

- No issue or project link was supplied; this is a user-authorized direct release task.
