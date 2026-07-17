# Component Architecture Map

## 1. Refactoring strategy

The current application concentrates a large amount of layout and feature rendering in `src/components/netscope-app.tsx`.

Refactor incrementally:

1. extract presentational components first
2. preserve current props and state
3. keep route behavior unchanged
4. move feature logic only after visual extraction is stable
5. add tests before changing analysis behavior

Do not replace the application shell and every feature page in one commit.

## 2. Target file structure

```text
src/
  components/
    cyber/
      cyber-panel.tsx
      cyber-button.tsx
      cyber-badge.tsx
      cyber-metric-card.tsx
      cyber-section-header.tsx
      cyber-status-pill.tsx
      cyber-tabs.tsx
      cyber-progress.tsx
      cyber-gauge.tsx
      confidence-badge.tsx
      description-badge.tsx
      severity-badge.tsx

    effects/
      cyber-background.tsx
      cyber-particles.tsx
      cyber-scanline.tsx
      hologram-radar.tsx
      light-sweep.tsx
      border-energy.tsx
      data-pulse.tsx

    layout/
      app-shell.tsx
      app-sidebar.tsx
      mobile-sidebar.tsx
      app-header.tsx
      page-container.tsx
      page-toolbar.tsx

    dashboard/
      dashboard-hero.tsx
      primary-action-panel.tsx
      local-analysis-status.tsx
      cli-input-panel.tsx
      parsing-progress.tsx
      overview-summary.tsx
      security-score-card.tsx
      subnet-detail-panel.tsx

    tables/
      data-table.tsx
      record-table.tsx
      data-table-toolbar.tsx
      column-selector.tsx
      table-pagination.tsx
      table-empty-state.tsx
      row-detail-drawer.tsx

    descriptions/
      description-field.tsx
      description-source-badge.tsx
      related-description-list.tsx

    evidence/
      evidence-viewer.tsx
      evidence-line.tsx
      evidence-drawer.tsx

    findings/
      finding-card.tsx
      finding-list.tsx
      finding-detail-drawer.tsx

    security/
      security-overview.tsx
      security-check-card.tsx
      security-status-summary.tsx

    dhcp/
      dhcp-overview.tsx
      dhcp-pool-card.tsx
      dhcp-pool-table.tsx

    topology/
      topology-canvas.tsx
      topology-node.tsx
      topology-node-drawer.tsx
      topology-link-drawer.tsx

    troubleshooting/
      command-group.tsx
      troubleshooting-command-card.tsx

    reports/
      report-option-card.tsx
      sensitive-export-dialog.tsx

    common/
      empty-state.tsx
      loading-state.tsx
      error-state.tsx
      partial-data-state.tsx

  styles/
    cyber-theme.css
    cyber-depth.css
    cyber-animation.css
    cyber-background.css
    cyber-motion.css
```

## 3. Application shell ownership

### `AppShell`

Responsibilities:

- place fixed decorative background
- place desktop sidebar and mobile drawer
- place header
- provide content offset and responsive layout
- no analysis logic

Suggested props:

```ts
interface AppShellProps {
  children: React.ReactNode;
  activeView: ViewId;
  criticalCount: number;
  language: "en" | "th";
  onLanguageChange(language: "en" | "th"): void;
}
```

### `AppSidebar`

Responsibilities:

- render navigation from `NAV_ITEMS`
- active state
- conflict/critical badges
- compact and expanded modes
- tooltips in compact mode

### `MobileSidebar`

Responsibilities:

- accessible dialog/drawer
- same navigation source as desktop
- close on route selection
- keyboard focus management

### `AppHeader`

Responsibilities:

- app title/subtitle
- theme and language controls
- help/profile actions
- small radar decoration
- current processing status

## 4. Dashboard composition

Suggested page composition:

```tsx
<AppShell>
  <DashboardHero />
  <CliInputPanel />
  <OverviewSummary />
  <div className="dashboard-detail-grid">
    <SecurityScoreCard />
    <SubnetDetailPanel />
  </div>
  <IpWorkspace />
</AppShell>
```

### `DashboardHero`

Contains:

- product identity
- decorative hologram
- `PrimaryActionPanel`
- `LocalAnalysisStatus`

Data sources:

- `progress`
- `busy`
- detected vendors/devices
- privacy/local-only constants

### `PrimaryActionPanel`

Callbacks:

- analyze
- load sample
- import/open file picker
- clear
- save snapshot
- open recommended commands

It must not own analysis state.

### `CliInputPanel`

Props should include:

```ts
interface CliInputPanelProps {
  value: string;
  onChange(value: string): void;
  onAnalyze(): void;
  onFiles(files: File[]): void;
  busy: boolean;
  progress: AnalysisProgress;
  summary: ImportPreview;
  sensitiveHits: SanitizationHit[];
}
```

## 5. Cyber primitives

### `CyberPanel`

Use for major sections.

Props:

```ts
interface CyberPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "cyan" | "green" | "purple" | "yellow" | "orange" | "red" | "blue";
  lightSweep?: boolean;
  borderEnergy?: boolean;
  cutCorners?: boolean;
}
```

It must never animate its own transform.

### `CyberMetricCard`

Props:

```ts
interface CyberMetricCardProps {
  title: string;
  subtitle?: string;
  value: React.ReactNode;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: CyberTone;
  href?: string;
  progress?: number;
  trend?: string;
  loading?: boolean;
  tooltip?: string;
}
```

### `CyberGauge`

Props:

```ts
interface CyberGaugeProps {
  value: number;
  max?: number;
  label: string;
  tone?: CyberTone;
  animateOnce?: boolean;
}
```

Animation is limited to the gauge fill.

## 6. Feature views

### IP Workspace

Recommended split:

- `IpWorkspace`
- `IpWorkspaceTabs`
- `IpInventoryTable`
- `IpRowDetailDrawer`
- `IpEvidencePanel`

Data remains sourced from `AnalysisResult`.

### Description presentation

`DescriptionField` should provide consistent behavior:

```ts
interface DescriptionFieldProps {
  description?: string;
  source?: "CLI" | "Related" | "Generated" | "Unknown";
  confidence?: number;
  evidence?: Evidence[];
  compact?: boolean;
}
```

It should render:

- description or a localized empty value
- source badge
- confidence when relevant
- evidence action

### Findings

`FindingCard` should receive a full `Finding` plus optional related records. It should not repeat rule logic in the UI.

### Security

Separate score calculation from presentation. `SecurityScoreCard` receives final score and coverage values.

### DHCP

Use normalized pool data. A pool card should not infer missing values in the component.

### Topology

Keep graph transformation in a dedicated adapter function or hook. Nodes and links receive normalized presentation data.

## 7. State boundaries

### Existing analysis store

Keep analysis input/result/progress in `analysis-store.ts`.

### New UI/settings state

Recommended settings state:

```ts
interface UiSettingsState {
  language: "en" | "th";
  sidebarMode: "compact" | "expanded";
  animationLevel: "off" | "reduced" | "normal";
  tableDensity: "comfortable" | "compact";
  persist(): void;
}
```

Do not mix parser output with UI preferences.

### Local component state

Keep state local for:

- open/closed drawer
- selected row
- active table tab
- local filters
- expanded evidence

## 8. Data-table architecture

Use one reusable table foundation with feature-specific column definitions.

Suggested API:

```ts
interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  searchableText?(row: TData): string;
  estimatedRowHeight?: number;
  enableVirtualization?: boolean;
  onOpenRow?(row: TData): void;
  exportFileName?: string;
}
```

Requirements:

- no hidden `slice()` truncation
- expose total and visible count
- virtualize when threshold is exceeded
- keep toolbar usable on mobile

## 9. Translation boundaries

Every user-visible string should come from translation resources, including:

- navigation
- section names
- states
- table labels
- buttons
- filters
- tooltips
- description sources
- severity/status text

Technical values such as commands, IP addresses, and vendor strings must remain unchanged.

## 10. Suggested extraction order

1. cyber primitives
2. fixed effects background
3. app shell/sidebar/header
4. hero/actions/status
5. CLI input panel
6. metric cards
7. security and subnet cards
8. data-table foundation
9. IP workspace
10. findings/security/DHCP/topology/reports/settings

After each extraction, run validation and confirm existing behavior still works.
