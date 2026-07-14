import {
  LayoutDashboard,
  Server,
  Users,
  Shield,
  Network,
  Settings,
  FileText,
  Activity,
  Radio,
  Plug,
  Globe,
  HardDrive,
  Gauge,
  ScrollText,
  Webhook,
  MonitorCog,
  Route,
  Layers,
  BellRing,
  Play,
  History,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

/** A single navigation link item with icon, optional badge, and role-based visibility. */
export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  roles?: string[]; // restrict to these roles; empty = all
}

/** A titled group of navigation items rendered as a section in the sidebar. */
export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Main sidebar navigation — data-driven, not hardcoded JSX. */
export const mainNavItems: NavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Nodes", href: "/nodes", icon: Server },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Operations", href: "/operations", icon: Play, roles: ["operator", "admin"] },
      { title: "Alerts", href: "/alerts", icon: BellRing, roles: ["operator", "admin"] },
      { title: "Users", href: "/users", icon: Users, roles: ["admin"] },
      { title: "Audit Log", href: "/audit", icon: FileText, roles: ["admin"] },
      { title: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

/** Per-node navigation section grouping for the node detail sub-navigation. */
export interface NodeNavSection {
  title: string;
  items: NavItem[];
}

/** Per-node detail navigation — shown in node detail sub-navigation. */
export const nodeNavSections: NodeNavSection[] = [
  {
    title: "General",
    items: [
      { title: "Overview", href: "", icon: LayoutDashboard },
      { title: "Sessions", href: "/sessions", icon: Users },
      { title: "History", href: "/history", icon: History },
      { title: "Service", href: "/service", icon: Activity },
      { title: "Config", href: "/config", icon: Settings },
      { title: "Logs", href: "/logs", icon: ScrollText },
    ],
  },
  {
    title: "Network",
    items: [
      { title: "Network", href: "/network", icon: Network },
      { title: "Firewall", href: "/firewall", icon: Shield },
      { title: "Routing", href: "/routing", icon: Route },
      { title: "Traffic", href: "/traffic", icon: Radio },
      { title: "IP Pool", href: "/ip-pool", icon: Layers },
    ],
  },
  {
    title: "Services",
    items: [
      { title: "PPPoE", href: "/pppoe", icon: Plug },
      { title: "DHCP", href: "/dhcp", icon: Globe },
      { title: "RADIUS", href: "/radius", icon: CircleDot },
      { title: "Events", href: "/events", icon: Webhook },
      { title: "Monitoring", href: "/monitoring", icon: MonitorCog },
    ],
  },
  {
    title: "System",
    items: [
      { title: "System", href: "/system", icon: HardDrive },
      { title: "Diagnostics", href: "/diagnostics", icon: Gauge },
    ],
  },
];

/** Flat list of all per-node nav items (for backward compatibility). */
export const nodeNavItems: NavItem[] = nodeNavSections.flatMap((s) => s.items);
