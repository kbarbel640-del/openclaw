import { Link, useRouterState } from "@tanstack/react-router";
import { navSections } from "@/lib/navigation";

export function MobileNav({ compact }: { compact?: boolean }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const basepath = "/mabos/dashboard";
  const relativePath = currentPath.startsWith(basepath)
    ? currentPath.slice(basepath.length) || "/"
    : currentPath;

  const allItems = navSections.flatMap((section) => section.items);

  return (
    <nav className="flex items-center gap-2 overflow-x-auto px-4 py-2 border-b border-[var(--border-mabos)] bg-[var(--bg-secondary)] scrollbar-hide [-webkit-overflow-scrolling:touch]">
      {allItems.map((item) => {
        const isActive =
          item.path === "/" ? relativePath === "/" : relativePath.startsWith(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 text-sm transition-colors ${
              isActive
                ? "bg-[color-mix(in_srgb,var(--accent-green)_15%,transparent)] text-[var(--accent-green)] font-medium"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {!compact && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
