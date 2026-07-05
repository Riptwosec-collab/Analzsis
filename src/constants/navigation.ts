import {
  AlertTriangle,
  Blocks,
  FileSearch,
  Gauge,
  GitBranch,
  HardDrive,
  Import,
  Network,
  Router,
  Search,
  ShieldCheck,
  Split
} from "lucide-react";

export const VIEW_IDS = [
  "overview",
  "import",
  "configuration",
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

export const NAV_ITEMS = [
  { id: "overview", href: "/?view=overview", label: "Overview", icon: Gauge },
  { id: "import", href: "/?view=import", label: "CLI Import", icon: Import },
  { id: "configuration", href: "/?view=configuration", label: "Config Analysis", icon: FileSearch },
  { id: "ip-inventory", href: "/?view=ip-inventory", label: "IP Inventory", icon: Network },
  { id: "free-ip", href: "/?view=free-ip", label: "Free IP", icon: Search },
  { id: "used-ip", href: "/?view=used-ip", label: "Used IP", icon: HardDrive },
  { id: "devices", href: "/?view=devices", label: "Devices", icon: Router },
  { id: "vlans", href: "/?view=vlans", label: "VLAN & Ports", icon: Split },
  { id: "conflicts", href: "/?view=conflicts", label: "Conflicts", icon: AlertTriangle },
  { id: "security", href: "/?view=security", label: "Security", icon: ShieldCheck },
  { id: "blocked-devices", href: "/?view=blocked-devices", label: "Blocked Devices", icon: Blocks },
  { id: "topology", href: "/?view=topology", label: "Topology", icon: GitBranch }
] as const;
