# NetScope Analyzer

Network CLI Analysis & Security Audit Platform for router, switch, firewall, and controller output.

NetScope analyzes the current CLI input locally in the browser. It does not send commands to network devices and does not store raw CLI by default. This repository intentionally excludes snapshot history and before/after comparison features.

## Civic self-check page

The repository also includes a standalone Civic Care self-check page at:

```text
/civic-check
```

The page includes:

- Search and category/status filters
- LocalStorage results for Normal, Watch, and Service Center
- Pre-drive, tyre, brake, steering, lighting, engine-bay, hybrid, and emergency checks
- Safety notes for Honda Civic e:HEV high-voltage systems
- Official reference links from DVSA and NHTSA

The self-check page is separate from NetScope and does not replace the network analyzer.

## Features

- Smart CLI import for paste and `.txt`, `.log`, `.cfg`, `.conf` files
- Device, vendor, and command boundary detection
- Modular parser structure for Cisco-style ARP, MAC table, DHCP binding, DHCP pool, interface, VLAN, running-config, logs, CDP, and LLDP
- IP inventory with Used, Likely Free, Reserved, Unknown status and confidence
- Duplicate IP, MAC movement/flapping, DHCP pool utilization, deny/block/err-disabled findings
- Security checks for DHCP Snooping, Dynamic ARP Inspection, Port Security, and plaintext secret exposure
- Evidence and source line references for findings when available
- Read-only troubleshooting command generator
- React Flow topology view from CDP/LLDP
- Export PDF, Excel, JSON, and Markdown reports
- Copy-ready Telegram summary
- Dark/light theme and English/Thai UI labels

## Supported Vendors

Current implementation is strongest for Cisco IOS/IOS-XE style output. Detection stubs are present for Aruba, FortiGate, Juniper, MikroTik, and generic network CLI so new parser modules can be added without changing the UI.

## Supported Commands

- `show ip arp`
- `show arp`
- `show mac address-table`
- `show ip dhcp binding`
- `show ip dhcp pool`
- `show vlan brief`
- `show interfaces status`
- `show ip interface brief`
- `show running-config`
- `show logging`
- `show cdp neighbors detail`
- `show lldp neighbors detail`

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:3000.

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

## Build

```bash
npm run build
```

## Deploy to Vercel

Import the GitHub repository in Vercel. The default build command is `npm run build` and the output is managed by Next.js.

## Project Structure

```text
src/app              Next.js App Router pages
src/components       App shell and UI primitives
src/parsers          Command detection and vendor parsers
src/correlation      IP/MAC/VLAN correlation and rule output
src/services         Export and sanitization services
src/store            Zustand client state
src/types            Shared TypeScript contracts
src/utils            IP, MAC, VLAN, interface utilities
src/tests            Unit and E2E tests
src/workers          Web Worker entry point
```

## Adding a Parser

Add a vendor module under `src/parsers/<vendor>/`, register command detection in `src/parsers/detector/command-detector.ts`, and return normalized records with evidence lines.

## Adding a Rule

Rules should produce a `Finding` with severity, confidence, evidence, recommendation, and verification commands. Avoid declaring certainty when the input evidence is incomplete.

## Privacy

NetScope processes CLI locally. Raw CLI is held in memory for the current browser session only unless the user explicitly exports a report. Use the sensitive-data scanner before sharing output.

The Civic self-check page stores inspection statuses and notes in the current browser using LocalStorage.

## Security Disclaimer

Analysis quality depends on the CLI data supplied by the user. An IP not found in ARP or DHCP is not guaranteed to be free. Remediation commands must be reviewed before use. NetScope is not a substitute for change management or a network monitoring platform.

The Civic self-check page is general guidance. Vehicle-specific pressures, fluids, warning messages, and procedures must follow the vehicle placard and owner manual. High-voltage hybrid components must be handled by qualified technicians.

## Known Limitations

- Parser coverage is not complete for every vendor.
- Free IP confidence is evidence-based, not an active ping or ARP scan.
- PDF export is a concise technical report in this phase.
- E2E coverage is a starter flow.

## Roadmap

- FortiGate, Aruba, Juniper, and MikroTik parser modules
- Virtualized data tables for very large imports
- Deeper ACL and Layer 2 security rules
- Full report templates per report type
- Broader Playwright accessibility checks
