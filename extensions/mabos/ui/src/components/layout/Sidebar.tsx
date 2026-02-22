import { Link, useRouterState } from "@tanstack/react-router";
import { Cpu, ChevronsRight, ChevronsLeft, ChevronDown, Palette } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePanels } from "@/contexts/PanelContext";
import { navSections } from "@/lib/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar() {
  const { sidebarMode, toggleSidebar } = usePanels();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const basepath = "/mabos/dashboard";
  const relativePath = currentPath.startsWith(basepath)
    ? currentPath.slice(basepath.length) || "/"
    : currentPath;

  const collapsed = sidebarMode === "collapsed";

  return (
    <aside className="h-screen bg-[var(--bg-secondary)] border-r border-[var(--border-mabos)] flex flex-col overflow-hidden">
      {/* Logo + Toggle */}
      <div
        className={`flex items-center mb-6 ${collapsed ? "justify-center px-2 pt-4" : "gap-3 px-4 pt-4"}`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <Cpu className="w-6 h-6 text-[var(--accent-green)]" />
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="Expand sidebar"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Cpu className="w-5 h-5 text-[var(--accent-green)]" />
            <span className="flex-1 text-xl font-bold text-[var(--text-primary)]">MABOS</span>
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Business Switcher (expanded only) */}
      {!collapsed && (
        <div className="px-4 mb-6">
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-mabos)] hover:border-[var(--border-hover)] transition-colors text-sm">
            <Palette className="w-4 h-4 text-[var(--accent-purple)]" />
            <span className="flex-1 text-left text-[var(--text-primary)]">VividWalls</span>
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav
          className={`flex-1 overflow-y-auto ${collapsed ? "space-y-2 px-2" : "space-y-6 px-4"}`}
        >
          {navSections.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {section.title}
                </div>
              )}
              <div className={collapsed ? "space-y-1" : "space-y-1"}>
                {section.items.map((item) => {
                  const isActive =
                    item.path === "/" ? relativePath === "/" : relativePath.startsWith(item.path);

                  if (collapsed) {
                    return (
                      <Tooltip key={item.path + item.label}>
                        <TooltipTrigger asChild>
                          <Link
                            to={item.path}
                            className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors ${
                              isActive
                                ? "bg-[color-mix(in_srgb,var(--accent-green)_15%,transparent)] text-[var(--accent-green)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Link
                      key={item.path + item.label}
                      to={item.path}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-[var(--accent-green)] text-[var(--bg-primary)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </TooltipProvider>

      {/* Theme Toggle */}
      <div
        className={`border-t border-[var(--border-mabos)] ${collapsed ? "px-2 py-3" : "px-4 py-3"}`}
      >
        {collapsed ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ThemeToggle iconOnly />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Toggle theme</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <ThemeToggle />
        )}
      </div>
    </aside>
  );
}
