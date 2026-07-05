# Phased Implementation Plan

## 1. Purpose

This plan lets Codex implement the redesign in safe, reviewable phases while preserving the current network-analysis application.

Do not implement every phase in one task. Complete and validate one phase before starting the next.

## 2. Phase 0 — Baseline and repository health

### Scope

- inspect repository architecture
- document current routes, stores, parser entry points, exports, and tests
- capture current screenshots where possible
- run all validation commands
- fix only blocking build/deployment configuration issues
- confirm Vercel uses Next.js with no custom `public` output directory

### Deliverables

- short architecture summary
- list of existing failures
- stable baseline build

### Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Run E2E if browser dependencies are available.

### Exit criteria

- baseline failures are understood
- build passes
- no feature behavior was intentionally changed

## 3. Phase 1 — Design foundation

### Scope

Create:

- cyber design tokens
- static 3D panel depth
- reusable CyberPanel
- CyberButton
- CyberBadge
- CyberMetricCard
- CyberSectionHeader
- fixed global cyber background
- reduced-motion support

Suggested files:

```text
src/components/cyber/*
src/components/effects/cyber-background.tsx
src/styles/cyber-theme.css
src/styles/cyber-depth.css
src/styles/cyber-background.css
src/styles/cyber-motion.css
```

### Constraints

- do not modify parser/correlation logic
- do not replace data with mocks
- no card transform animation
- preserve existing pages

### Tests

- primitive render tests where practical
- reduced-motion classes/state
- no regression to app startup

### Exit criteria

- shared components exist
- one existing panel uses them as a proof
- static UI works with animation disabled
- all validation commands pass

## 4. Phase 2 — Application shell

### Scope

Extract and redesign:

- AppShell
- desktop sidebar
- mobile drawer
- header
- theme/language controls
- page container

### Requirements

- compact icon sidebar matching the reference style
- active route and conflict badge
- accessible mobile navigation
- sticky header
- fixed decorative background behind content

### Exit criteria

- every route remains reachable
- 375/768/1024/1440/1920 px layouts are usable
- keyboard navigation and focus are visible
- no parser or result changes

## 5. Phase 3 — Hero, actions, and CLI input

### Scope

Create:

- DashboardHero
- PrimaryActionPanel
- LocalAnalysisStatus
- CliInputPanel
- ParsingProgress
- HologramRadar
- LightSweep
- BorderEnergy
- CyberScanline

### Real-data bindings

- busy/progress state
- detected device/vendor counts
- command block count
- input bytes and lines
- sensitive-data hits
- supported/unsupported counts

### Requirements

- Analyze Now remains the main action
- status pills reflect real state
- CLI text does not animate
- progress reflects actual stages where currently available; do not fake precise progress

### Exit criteria

- paste, upload, sample, analyze, sanitize, and clear still work
- no layout movement from animation
- mobile actions remain usable

## 6. Phase 4 — Overview and subnet details

### Scope

Create:

- OverviewSummary
- CyberMetricCard integration
- SecurityScoreCard
- EvidenceCoverage display
- SubnetDetailPanel
- utilization visualization

### Metrics

Use real values only:

- devices
- commands
- subnets
- usable IPs
- used/likely free/reserved/unknown
- DHCP pools
- security checks
- blocked/denied
- findings
- warnings
- unsupported commands

### Requirements

- counts are distinct and meaningful
- Unknown security checks do not count as failed
- security score and evidence coverage are separate
- card links open the correct route or tab

### Exit criteria

- dashboard resembles the reference layout
- values match `AnalysisResult`
- no metric uses placeholder production values

## 7. Phase 5 — Table foundation and IP workspace

### Scope

Create a reusable TanStack table system and rebuild the IP workspace.

### Required functionality

- pagination
- virtualization threshold
- sticky header
- global search
- column filters
- sorting
- column visibility
- row selection
- detail drawer
- evidence viewer
- export filtered/selected rows
- mobile horizontal scroll/card mode

### Required IP fields

- device
- VRF
- IP
- description/source/confidence
- MAC and description
- VLAN and description
- interface and description
- status
- usage confidence
- source
- timestamp/age
- evidence

### Constraints

- remove silent `rows.slice(0, 400)` behavior
- do not alter analysis results to satisfy presentation

### Exit criteria

- total and visible row counts are shown
- large datasets stay responsive
- description search works
- selected/filtered export works

## 8. Phase 6 — Description presentation system

### Scope

Implement consistent display components for description metadata already available or added by assigned logic work.

Create:

- DescriptionField
- DescriptionSourceBadge
- DescriptionConfidenceBadge
- RelatedDescriptionList

Apply to:

- devices
- IPs
- MACs
- VLANs
- interfaces
- DHCP pools
- subnets
- findings
- security checks
- topology nodes/links
- troubleshooting commands
- reports

### Rules

- mark Generated descriptions clearly
- do not invent owner names or roles
- show Unknown/localized empty state when absent
- evidence action opens source lines

### Exit criteria

- descriptions appear in their relevant local sections
- source/confidence behavior is consistent
- search indexes descriptions

## 9. Phase 7 — Feature page redesigns

Implement one feature group per task where possible.

### 7A. Devices, VLANs, Interfaces, MAC

- device cards/table
- VLAN database
- access/trunk/routed/SVI sections
- interface descriptions and status
- MAC-to-port workspace

### 7B. Findings and blocked events

- finding cards
- related-object links
- evidence and false-positive section
- structured blocked/denied events

### 7C. Security

- score/coverage summary
- security check cards
- affected objects/descriptions
- verification commands

### 7D. DHCP

- DHCP summary cards
- pool utilization
- binding/reservation/exclusion details

### 7E. Topology

- cyber nodes/links
- search, filters, auto layout
- node/link detail drawers
- export controls

### 7F. Troubleshooting and reports

- command descriptions and copy actions
- report option cards
- sensitive export dialog

### Exit criteria for each feature task

- uses shared design system
- preserves real functionality
- has empty/loading/error/partial states
- validation passes

## 10. Phase 8 — Settings and motion controls

### Scope

Create or extend a persisted UI/settings store.

Settings:

- language
- sidebar mode
- table density
- Animation Level: Off / Reduced / Normal
- report/UI preferences assigned by the feature scope

### Requirements

- settings must affect the real UI
- local persistence
- browser reduced-motion preference overrides or safely reduces Normal mode
- Off mode still retains static depth

### Exit criteria

- settings survive reload
- no hydration mismatch
- animation can be fully disabled

## 11. Phase 9 — Accessibility and performance hardening

### Accessibility

- labels and descriptions
- keyboard navigation
- focus rings
- screen-reader names
- table captions
- dialog focus traps
- contrast audit
- reduced motion

### Performance

- reduce animated layers on mobile
- pause canvas/effects when hidden
- IntersectionObserver for below-fold effects
- memoize expensive table/chart transformations
- prevent unnecessary rerenders
- verify analysis worker remains responsive

### Exit criteria

- no obvious keyboard traps
- no continuous layout shift
- large table and analysis remain usable
- Lighthouse/accessibility findings documented

## 12. Phase 10 — Final QA and documentation

### Scope

- full validation suite
- test primary routes and actions
- verify Vercel preview/production
- update README with new architecture and screenshots
- document remaining limitations

### Required checks

- CLI paste/upload/analyze
- sample load
- language/theme
- all navigation routes
- table search/filter/pagination
- descriptions and evidence
- export dialogs
- mobile drawer
- animation levels
- reduced motion

### Exit criteria

- typecheck passes
- lint passes
- unit tests pass
- build passes
- E2E passes where environment supports it
- Vercel deploy succeeds
- no known critical regression

## 13. Codex prompt for the first implementation task

```text
Open repository Riptwosec-collab/Analzsis.

Read AGENTS.md and every file under docs/ before editing code.
Inspect the real repository and current components first.

Implement Phase 1 only from docs/implementation-phases.md:

- cyber design tokens
- fixed decorative cyber background
- static 3D CyberPanel
- CyberButton
- CyberBadge
- CyberMetricCard
- CyberSectionHeader
- prefers-reduced-motion support

Strict rules:

- Do not modify parser, correlation, security, export, sanitization, or analysis logic.
- Do not use mock AnalysisResult data.
- Do not animate card or content position, scale, rotation, tilt, or perspective.
- Only decorative layers may move.
- Preserve all existing routes and functionality.
- Refactor incrementally; do not rewrite netscope-app.tsx in one step.
- Do not commit tsconfig.tsbuildinfo or generated artifacts.

Run:

npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e

Fix all errors that are caused by this change. If E2E cannot run because browser dependencies are missing, report that clearly.

Finish with a summary of files added/modified, behavior preserved, tests, command results, known limitations, and the recommended Phase 2 task.
```

## 14. Review gate between phases

Before starting the next phase, review:

- screenshots at desktop and mobile widths
- diff size and unrelated changes
- build/test status
- real data binding
- motion compliance
- accessibility regressions

Do not continue automatically into the next phase when the current phase has unresolved build or UX issues.
