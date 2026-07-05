# Cyber 3D UI Specification

## 1. Purpose

This document defines the visual and interaction target for the NetScope Analyzer redesign.

The application should feel like a professional Network Operations and Security Intelligence dashboard:

- dark navy cyber environment
- cyan neon edge lighting
- high-density information layout
- static 3D depth
- restrained holographic animation
- clear operational hierarchy
- readable Thai and English text

The supplied Smart IP, DHCP & Security Analyzer image is the primary visual reference. Reproduce its design language, not its exact text or fake values.

## 2. Core design principle

The dashboard must look animated without making the working interface move.

### Content that remains stationary

- sidebar and header layout
- cards and panels
- CLI editor
- buttons and forms
- tables and rows
- labels and text
- findings
- topology nodes unless manually dragged

### Decorative elements that may move

- background circuit flow
- sparse particles
- scanline
- light sweep
- border energy
- radar rings
- network pulses
- gauge/chart fills
- loading and progress indicators

No continuous tilt, floating, zooming, card rotation, mouse-follow transform, or content parallax is allowed.

## 3. Visual identity

### Base palette

```css
:root {
  --cyber-bg: #020817;
  --cyber-bg-2: #031128;
  --cyber-panel: #06172f;
  --cyber-panel-2: #071d3c;
  --cyber-panel-raised: #08234a;

  --cyber-cyan: #00d9ff;
  --cyber-cyan-bright: #39efff;
  --cyber-blue: #138cff;
  --cyber-green: #20e39a;
  --cyber-yellow: #ffc928;
  --cyber-orange: #ff8a24;
  --cyber-red: #ff435b;
  --cyber-purple: #a855f7;

  --cyber-text: #e9f7ff;
  --cyber-text-secondary: #8daac2;
  --cyber-text-muted: #55748f;
  --cyber-border: rgba(0, 217, 255, 0.38);
  --cyber-border-active: #00d9ff;
}
```

### Semantic tones

- cyan: neutral information and network data
- green: used/healthy/passed
- purple: reserved and special-purpose addresses
- yellow: conflict, anomaly, medium warning
- orange: high warning and parsing issue
- red: critical, blocked, denied, failed
- blue/gray: unknown, unsupported, incomplete coverage

Never rely on color alone. Pair tone with icon and text.

## 4. Typography

Recommended font roles:

- headings: Oxanium, Rajdhani, or Orbitron
- body: Inter plus IBM Plex Sans Thai or Noto Sans Thai
- CLI and technical identifiers: JetBrains Mono or IBM Plex Mono

Requirements:

- large title with strong weight and controlled letter spacing
- section titles in cyan with a geometric line decoration
- metric values prominent but not oversized
- table text remains readable at 12–14 px minimum depending on density
- Thai text must not use a decorative Latin-only font

## 5. Global background

The background is a fixed decorative stack behind all content:

1. dark navy gradient
2. subtle dot grid
3. circuit pattern
4. perspective grid
5. radial cyan glows
6. sparse particles
7. one faint scanline

Requirements:

- `position: fixed`
- `pointer-events: none`
- `aria-hidden="true"`
- low contrast behind text
- effects reduced on mobile
- no movement of the application content

## 6. Static 3D panel treatment

Depth comes from layers, not transform animation.

Each major panel should use:

- dark multi-stop gradient
- thin cyan border
- inset top highlight
- deep lower shadow
- faint outer glow
- geometric/cut-corner accents
- optional light-sweep overlay

Example visual stack:

```css
.cyber-panel {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(7,29,60,.97), rgba(2,8,23,.99));
  border: 1px solid rgba(0,217,255,.48);
  box-shadow:
    0 18px 45px rgba(0,0,0,.48),
    0 0 18px rgba(0,217,255,.12),
    inset 0 1px 0 rgba(180,245,255,.12),
    inset 0 -18px 28px rgba(0,0,0,.25);
}
```

Do not animate the transform property of the panel.

## 7. Application shell

### Desktop

- compact icon sidebar: 68–76 px
- optional expanded sidebar: 230–260 px
- sticky header
- wide workspace using 1600–1800 px effectively
- section panels with consistent vertical rhythm

### Mobile

- sidebar becomes an accessible drawer
- header title becomes compact
- actions move into a responsive grid or overflow menu
- tabs scroll horizontally
- tables support horizontal scroll and optional card view
- metric cards use one or two columns

## 8. Header and hero

The upper area should resemble the reference dashboard:

### Left

- geometric network/security logo
- `NETSCOPE ANALYZER` or `SMART IP, DHCP & SECURITY ANALYZER`
- Thai subtitle explaining the platform

### Center decoration

- stationary container with animated radar rings
- network scanning motif
- subtle circuit pulses

### Right

- Help
- theme switch
- language switch
- user/profile menu
- system/local-only status

## 9. Primary action area

Actions:

- Analyze Now
- Load Example
- Import Files
- Save Snapshot
- Recommended Commands
- Clear

Analyze Now is the primary action with blue/cyan gradient, lightning icon, loading state, and progress feedback.

Under the actions, show status pills derived from real state:

- Client-side Analysis
- Local Only
- Detected Vendor
- No Data Upload
- Current Analysis Only

## 10. CLI input panel

Title:

- `PASTE ROUTER / SWITCH OUTPUT`
- Thai subtitle

Features:

- large monospace editor
- file drag/drop and multi-file import
- file/device/command summary
- sensitive-data indicator
- clear and fullscreen actions
- line count, source count, block count, size, supported and unsupported counts
- real parsing progress

The editor panel may contain a faint scanline and light sweep, but the text must never animate.

## 11. Overview metrics

Create clickable metric cards for:

- detected devices
- detected commands
- networks/subnets
- total usable IPs
- used IPs
- likely free IPs
- reserved IPs
- unknown IPs
- DHCP pools
- security features
- blocked/denied
- conflicts/anomalies
- security score
- evidence coverage
- parsing warnings
- unsupported commands

Each card includes:

- icon
- English title
- Thai subtitle
- real value
- short description
- semantic tone
- optional progress/trend
- destination link

Do not display inflated counts caused by a faulty rule. Every count must represent distinct findings or records.

## 12. Security score

Display two related values:

- Security Score
- Evidence Coverage

The gauge can animate its fill once after analysis, but the card remains stationary.

Show counts for:

- Passed
- Failed
- Warning
- Unknown
- Not Applicable

Unknown must not be scored as Failed.

## 13. Network and subnet details

Provide selectors for:

- device
- VRF
- network
- VLAN

Display:

- network and CIDR
- subnet mask
- broadcast
- first/last host
- total and usable
- used, likely free, reserved, unknown
- gateway
- VLAN and description
- device and VRF
- utilization bar

A decorative datacenter/network hologram may appear on the right, but it must not cover data.

## 14. Main data workspace

Tabs:

- Overview
- Used IPs
- Likely Free IPs
- Reserved
- Unknown / Verify
- DHCP Pools
- Security
- Blocked / Denied
- Conflicts & Anomaly
- MAC to Port
- Snapshot Compare

Each tab badge must use the real record count.

Toolbar:

- global search
- filters
- sort/group
- column visibility
- export
- grid/list switch when useful

Search must include descriptions.

## 15. Tables

Use TanStack Table fully. Do not silently slice rows.

Required behaviors:

- pagination
- virtualization for large data
- sticky header
- sorting and filtering
- column visibility and resize
- row selection
- detail drawer
- evidence viewer
- export filtered/selected rows
- accessible keyboard operation

IP table should support:

- Device
- VRF
- IP Address
- Description
- Description Source
- Description Confidence
- MAC Address
- MAC Description
- VLAN
- VLAN Description
- Interface
- Interface Description
- Status
- Usage Confidence
- Source
- Timestamp/Age
- Evidence
- Actions

## 16. Description everywhere

The UI must expose descriptions in the relevant local section, not only in a generic detail page.

Supported description-bearing objects:

- Device
- IP
- MAC
- VLAN
- Interface
- DHCP Pool
- Subnet
- Finding target
- Security Check
- Topology node/link
- Troubleshooting command

When available, display:

- description
- source: CLI / Related / Generated / Unknown
- confidence
- evidence

Generated descriptions must be clearly marked and must never invent an owner or operational role without evidence.

## 17. Findings and anomalies

Each finding card should show:

- severity
- title
- target and target description
- device, VRF, VLAN, interface
- interface/VLAN/device descriptions
- confidence
- why suspicious
- possible false-positive explanation
- evidence
- recommendation
- read-only verification commands

Actions:

- View Evidence
- Copy Commands
- Mark Reviewed
- Open related IP/MAC/interface

## 18. Security, DHCP, topology, reports, settings

All feature pages must use the same design system.

### Security

- score and coverage
- check cards
- affected objects and descriptions
- evidence and verification commands

### DHCP

- pool summary cards
- pool description
- network/gateway/DNS/lease/utilization
- reservations/exclusions/conflicts

### Topology

- cyber-styled nodes and links
- node/link descriptions
- auto layout, search, filters, detail drawers
- restrained link pulse

### Reports

- report cards for PDF/XLSX/CSV/JSON/Markdown/Telegram
- show included sections and sensitive-data warning

### Settings

- Appearance
- Language
- Analysis
- Rules
- Security Score
- Free IP
- DHCP
- Reports
- Privacy
- Performance
- Snapshot
- Animation Level

Settings must affect the real application.

## 19. States

Every major view must support:

- initial
- empty
- loading
- analyzing
- completed
- partial data
- unsupported command
- warning
- error

Partial analysis must explain what evidence is missing.

## 20. Acceptance criteria

- visual language clearly matches the dark cyber reference
- all main content remains stationary
- decorative animation is restrained and performant
- real analysis data powers every production metric
- descriptions appear throughout the relevant sections
- Thai and English are supported
- mobile navigation works
- no silent row truncation
- sufficient contrast and keyboard support
- all validation commands pass
- parser and analysis behavior remains intact unless explicitly assigned
