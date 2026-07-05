import {
  AlertTriangle,
  Blocks,
  FileDown,
  Gauge,
  GitBranch,
  HardDrive,
  Import,
  ListChecks,
  Network,
  Router,
  Search,
  ShieldCheck,
  Split,
  Wrench
} from "lucide-react";

export const VIEW_IDS = [
  "overview",
  "import",
  "ip-inventory",
  "free-ip",
  "used-ip",
  "devices",
  "vlans",
  "conflicts",
  "security",
  "blocked-devices",
  "topology",
  "troubleshooting",
  "reports",
  "settings"
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

export function isViewId(value: string | undefined): value is ViewId {
  return Boolean(value && (VIEW_IDS as readonly string[]).includes(value));
}

// All visible analysis sections open inside the same root page.
export const NAV_ITEMS = [
  { id: "overview", href: "/?view=overview", label: "Overview", icon: Gauge },
  { id: "import", href: "/?view=import", label: "CLI Import", icon: Import },
  { id: "ip-inventory", href: "/?view=ip-inventory", label: "IP Inventory", icon: Network },
  { id: "free-ip", href: "/?view=free-ip", label: "Free IP", icon: Search },
  { id: "used-ip", href: "/?view=used-ip", label: "Used IP", icon: HardDrive },
  { id: "devices", href: "/?view=devices", label: "Devices", icon: Router },
  { id: "vlans", href: "/?view=vlans", label: "VLAN & Ports", icon: Split },
  { id: "conflicts", href: "/?view=conflicts", label: "Conflicts", icon: AlertTriangle },
  { id: "security", href: "/?view=security", label: "Security", icon: ShieldCheck },
  { id: "blocked-devices", href: "/?view=blocked-devices", label: "Blocked Devices", icon: Blocks },
  { id: "topology", href: "/?view=topology", label: "Topology", icon: GitBranch },
  { id: "troubleshooting", href: "/?view=troubleshooting", label: "Troubleshooting", icon: Wrench },
  { id: "reports", href: "/?view=reports", label: "Reports", icon: FileDown },
  { id: "settings", href: "/?view=settings", label: "Settings", icon: ListChecks }
] as const;
