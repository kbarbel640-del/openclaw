import type { GatewayBrowserClient } from "../gateway.ts";

export type ProjectEntry = {
  name: string;
  path: string;
  isGitRepo: boolean;
};

export type ProjectsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  projectsLoading: boolean;
  projectsError: string | null;
  projectsRootDir: string | null;
  projectsBrowseRootDir: string | null;
  projectsIncludeHidden: boolean;
  projects: ProjectEntry[];
};

export async function loadProjects(state: ProjectsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.projectsLoading) {
    return;
  }
  state.projectsLoading = true;
  state.projectsError = null;
  try {
    const params: Record<string, unknown> = {};
    if (state.projectsBrowseRootDir && state.projectsBrowseRootDir.trim()) {
      params.rootDir = state.projectsBrowseRootDir.trim();
    }
    if (state.projectsIncludeHidden) {
      params.includeHidden = true;
    }
    const res = await state.client.request<{ rootDir?: unknown; projects?: unknown[] }>(
      "projects.list",
      params,
    );
    state.projectsRootDir = typeof res.rootDir === "string" ? res.rootDir : null;
    const list = Array.isArray(res.projects) ? res.projects : [];
    state.projects = list
      .map((p) => p as Partial<ProjectEntry>)
      .filter((p): p is ProjectEntry =>
        Boolean(p && typeof p.name === "string" && typeof p.path === "string"),
      )
      .map((p) => ({
        name: p.name,
        path: p.path,
        isGitRepo: Boolean(p.isGitRepo),
      }));
  } catch (err) {
    state.projectsError = String(err);
  } finally {
    state.projectsLoading = false;
  }
}
