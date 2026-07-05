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

export const NAV_ITEMS = [
  { id: "overview", href: "/", label: "Overview", icon: Gauge },
  { id: "import", href: "/import", label: "CLI Import", icon: Import },
  { id: "ip-inventory", href: "/ip-inventory", label: "IP Inventory", icon: Network },
  { id: "free-ip", href: "/free-ip", label: "Free IP", icon: Search },
  { id: "used-ip", href: "/used-ip", label: "Used IP", icon: HardDrive },
  { id: "devices", href: "/devices", label: "Devices", icon: Router },
  { id: "vlans", href: "/vlans", label: "VLAN & Ports", icon: Split },
  { id: "conflicts", href: "/conflicts", label: "Conflicts", icon: AlertTriangle },
  { id: "security", href: "/security", label: "Security", icon: ShieldCheck },
  { id: "blocked-devices", href: "/blocked-devices", label: "Blocked Devices", icon: Blocks },
  { id: "topology", href: "/topology", label: "Topology", icon: GitBranch },
  { id: "troubleshooting", href: "/troubleshooting", label: "Troubleshooting", icon: Wrench },
  { id: "reports", href: "/reports", label: "Reports", icon: FileDown },
  { id: "settings", href: "/settings", label: "Settings", icon: ListChecks }
] as const;

export type ViewId = typeof NAV_ITEMS[number]["id"];
