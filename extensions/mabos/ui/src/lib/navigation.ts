import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Calendar,
  BarChart3,
  Package,
  DollarSign,
  Heart,
  Rocket,
  Bell,
  Target,
  GitBranch,
  Network,
} from "lucide-react";

export type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "Strategy",
    items: [
      { icon: LayoutDashboard, label: "Overview", path: "/" },
      { icon: BarChart3, label: "Performance", path: "/performance" },
      { icon: Bell, label: "Decisions", path: "/decisions" },
      { icon: Target, label: "Goals", path: "/goals" },
    ],
  },
  {
    title: "Process",
    items: [
      { icon: FolderKanban, label: "Projects", path: "/projects" },
      { icon: Calendar, label: "Timeline", path: "/timeline" },
      { icon: GitBranch, label: "Workflows", path: "/workflows" },
    ],
  },
  {
    title: "Agents",
    items: [
      { icon: Users, label: "Agents", path: "/agents" },
      { icon: Network, label: "Knowledge Graph", path: "/knowledge-graph" },
    ],
  },
  {
    title: "Resources",
    items: [
      { icon: Package, label: "Inventory", path: "/inventory" },
      { icon: DollarSign, label: "Accounting", path: "/accounting" },
      { icon: Heart, label: "HR & Workforce", path: "/hr" },
    ],
  },
  {
    title: "Governance",
    items: [{ icon: Rocket, label: "Onboarding", path: "/onboarding" }],
  },
];
