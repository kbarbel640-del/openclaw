import {
  Cpu, LayoutDashboard, Users, ClipboardList, Calendar,
  BarChart3, Package, DollarSign, Heart, Rocket, Palette,
  ChevronDown
} from "lucide-react";

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  section?: string;
};

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Dashboard",
    items: [
      { icon: LayoutDashboard, label: "Overview", path: "/" },
      { icon: BarChart3, label: "Performance", path: "/performance" },
    ],
  },
  {
    title: "Operations",
    items: [
      { icon: Users, label: "Agents", path: "/agents" },
      { icon: ClipboardList, label: "Tasks", path: "/tasks" },
      { icon: Calendar, label: "Timeline", path: "/timeline" },
    ],
  },
  {
    title: "Business",
    items: [
      { icon: Package, label: "Inventory", path: "/inventory" },
      { icon: DollarSign, label: "Accounting", path: "/accounting" },
      { icon: Heart, label: "HR", path: "/hr" },
    ],
  },
  {
    title: "Setup",
    items: [
      { icon: Rocket, label: "Onboarding", path: "/onboarding" },
    ],
  },
];

export function Sidebar({
  activePath,
  onNavigate,
}: {
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <aside className="w-[280px] h-screen bg-[var(--bg-secondary)] border-r border-[var(--border-mabos)] p-4 flex flex-col fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-3 text-xl font-bold">
        <Cpu className="w-5 h-5 text-[var(--accent-green)]" />
        <span>MABOS</span>
      </div>

      {/* Business Switcher */}
      <button className="flex items-center gap-3 px-3 py-2 mb-6 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-mabos)] hover:border-[var(--border-hover)] transition-colors text-sm">
        <Palette className="w-4 h-4 text-[var(--accent-purple)]" />
        <span className="flex-1 text-left">VividWalls</span>
        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
      </button>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                    activePath === item.path
                      ? "bg-[var(--accent-green)] text-[var(--bg-primary)] font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
