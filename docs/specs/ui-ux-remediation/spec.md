# UI/UX Remediation Specification

## Goal

Turn the memoQ AI Hub desktop renderer into a task-oriented, responsive, keyboard-accessible operator experience while preserving all current integration, provider, profile, asset, history, and diagnostics capabilities.

## Context

The renderer has grown from a compact operator console into six top-level modules. The current implementation has a sound Ant Design base, but navigation order, onboarding, long-form configuration, responsive behavior, accessible row activation, dirty-state safety, visual hierarchy, and test depth have drifted apart.

The baseline audit is represented by eight tracked problem groups:

1. Navigation, Dashboard onboarding, and the documented journey disagree.
2. Narrow layouts reserve a fixed 72px navigation rail.
3. Custom clickable rows lack complete keyboard semantics.
4. Dashboard mixes onboarding, health, integration maintenance, updates, and notices.
5. Setup, AI Services, and Translation Records expose too much information at once.
6. Page/layout position is not restored and dirty drafts lack leave protection.
7. Visual hierarchy depends too heavily on cards and lacks page-level orientation.
8. Renderer UI tests primarily assert source structure instead of real interaction.

## Repositories In Scope

- `memoq-ai-hub`: source of truth and only write target.

## Source Of Truth

- Product journey and interaction rules: `docs/ui-governance.md`.
- Initiative state: `docs/initiatives/ui-ux-remediation.yaml`.
- Engineering implementation and verification: this repository, its tests, and GitHub CI when a PR is later authorized.
- User-facing workflow: `docs/user-guide.md` and `docs/user-guide.zh-CN.md`.

## Constraints

- Preserve memoQ plugin, local HTTP, persisted-data, Provider, Profile, Asset, and History contracts.
- Preserve React 18, Ant Design 5, Electron, pnpm, and the existing localization approach.
- English and Chinese resource keys must remain in parity.
- Do not disable or bypass tests, introduce unrelated backend refactors, or commit generated output.
- Prefer incremental and reversible UI slices over a full renderer rewrite.

## Non-goals

- Rebranding or replacing Ant Design.
- Changing translation/runtime behavior, provider APIs, storage formats, or memoQ SDK behavior.
- Publishing a release, modifying remote GitHub state, or deploying the application.
- Building a phone-first product; narrow-window support is for a resizable desktop application.

## Rollout Waves

1. **P0 foundation**: journey/navigation consistency, adaptive shell, keyboard semantics, persistent shell state, and dirty-navigation protection.
2. **Dashboard and hierarchy**: task-oriented overview, page headers, reduced card dependence, and support-task placement.
3. **Dense workflows**: progressive disclosure and clearer actions in Setup, AI Services, Assets, and Translation Records.
4. **Verification hardening**: interaction, keyboard, responsive, localization, renderer build, and documentation evidence.

Each wave must leave the renderer compiling and the relevant test subset passing.

## Verification Gates

- The onboarding sequence includes integration, AI service, optional Assets, Profile, and record review in the same order everywhere.
- Navigation remains usable at 1366px, 1024px, and 768px without page-level horizontal overflow.
- Provider, Profile, Asset category/row, placeholder, and History row activation is keyboard-operable with visible focus.
- Dirty Provider/Profile navigation presents an explicit save/discard/stay decision, and shell state restores only valid page keys.
- Dashboard clearly separates onboarding/attention from low-frequency support tasks.
- Setup, AI Services, and History keep common actions visible and advanced/diagnostic content behind explicit disclosure.
- English/Chinese locale parity, desktop tests, repository tests, and renderer compile/package-relevant checks pass.
- Self-review maps every baseline problem group to code and verification evidence.

## Done When

All eight baseline problem groups have implemented fixes, automated or documented behavior evidence, passing agreed gates, synchronized user documentation, and no unresolved high-priority review findings. The initiative ledger identifies the verified commit and no remaining next action.

## Rollback Condition

Rollback the current wave if it breaks persisted configuration/history compatibility, prevents the existing setup or translation-review path, introduces page-level horizontal overflow at the supported widths, or causes the desktop/renderer validation gate to fail without an in-wave fix.

## GitHub Tracking

- Project: pending; no remote write authorized.
- Issues: pending; current work is thread-goal and branch scoped.
- Pull request: pending user authorization.
