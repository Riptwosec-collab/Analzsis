# NetScope Analyzer — Agent Instructions

These instructions apply to every AI coding agent working in this repository.

## Required reading

Before editing code, read these files in order:

1. `README.md`
2. `docs/cyber-3d-ui-spec.md`
3. `docs/component-map.md`
4. `docs/animation-rules.md`
5. `docs/implementation-phases.md`

Inspect the real repository before proposing changes. Do not rely on README claims alone.

## Project goal

NetScope Analyzer is a client-side Network CLI Analysis, IP Inventory, DHCP, Conflict Detection, Security Audit, Topology, Troubleshooting, and Reporting application.

The redesign target is a professional cyber-network operations dashboard with static 3D depth and restrained decorative animation. The interface should resemble the supplied dark navy/cyan reference dashboard while remaining readable and operational.

## Non-negotiable rules

- Preserve parser, correlation, security, export, sanitization, and analysis behavior unless the assigned task explicitly includes logic changes.
- Never replace real `AnalysisResult` data with mock production data.
- Main content must remain visually stationary.
- Do not animate card, panel, table, form, text, or layout position, scale, rotation, tilt, or perspective.
- Only decorative layers may move: background grid, particles, scanline, light sweep, border energy, radar rings, chart fills, gauges, and loading indicators.
- Do not use mouse-follow tilt, floating cards, parallax content, continuous zoom, bobbing, or camera movement.
- Every entity view must support descriptions where data exists: Device, IP, MAC, VLAN, Interface, DHCP Pool, Subnet, Finding, Security Check, Topology Node/Link, and Troubleshooting Command.
- Description metadata must expose source and confidence when available: `CLI`, `Related`, `Generated`, or `Unknown`.
- Keep `Likely Free IP` probabilistic. Never present it as guaranteed free.
- Unknown security evidence must not be treated as failed.
- All troubleshooting commands must remain read-only. Never generate destructive commands such as `clear`, `shutdown`, `reload`, `delete`, `write erase`, or configuration commands.
- Preserve local-only processing and privacy behavior.
- Do not commit secrets, tokens, credentials, `.env`, generated reports, test artifacts, `.next`, coverage, or `tsconfig.tsbuildinfo`.

## Frontend requirements

- Next.js App Router and TypeScript strictness must be preserved.
- Refactor the large `src/components/netscope-app.tsx` gradually. Do not rewrite the entire application in one uncontrolled change.
- Reuse existing data types and state where practical.
- Add reusable cyber components instead of duplicating styling.
- Do not hard-code user-facing strings in feature components. Use the translation system.
- Support desktop, tablet, and mobile widths: 375, 768, 1024, 1440, and 1920 px.
- Mobile must have a usable navigation drawer.
- Tables must not silently truncate results. Use pagination and/or virtualization.
- Support keyboard navigation, visible focus, sufficient contrast, semantic labels, and `prefers-reduced-motion`.

## Motion and performance

- Use CSS animations for decorative effects whenever possible.
- Limit particles and large blur layers, especially on mobile.
- Decorative layers must use `pointer-events: none` and `aria-hidden="true"`.
- Add motion levels: `Off`, `Reduced`, and `Normal`, persisted locally.
- Respect browser visibility and reduced-motion preferences.
- Analysis must continue to run in a Web Worker where supported.

## Validation commands

Run and fix all failures before finishing:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

When E2E execution is unavailable because browser dependencies are missing, state that clearly and still run the remaining commands.

## Change discipline

- Keep commits focused: one logical change per commit when reasonable.
- Explain why a change is needed, not only what changed.
- Avoid unrelated formatting or broad rewrites.
- Add tests for every new shared component behavior, parser behavior, rule, or state transition that can be tested.
- Update relevant docs when architecture or UX behavior changes.

## Required completion report

At the end of each task, report:

- Files added
- Files modified
- Functional behavior preserved
- Visual behavior added
- Responsive/accessibility work
- Tests added or updated
- Results of typecheck, lint, unit tests, build, and E2E
- Known limitations
- Recommended next phase
