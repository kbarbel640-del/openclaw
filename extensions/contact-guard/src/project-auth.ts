/**
 * Project Authorization
 *
 * Checks if a contact is authorized to know about specific projects
 * and detects potential project information leaks in outgoing messages.
 */

import fs from "node:fs";
import path from "node:path";

export interface ProjectConfig {
  id: string;
  name: string;
  authorized_contacts: string[];
  keywords?: string[];
}

export interface ProjectRegistry {
  projects: ProjectConfig[];
  contact_aliases: Record<string, string | string[]>;
}

let registryCache: ProjectRegistry | null = null;

/**
 * Load project registry
 */
export function loadProjectRegistry(
  workspaceDir: string,
  registryPath: string,
): ProjectRegistry | null {
  if (registryCache) {
    return registryCache;
  }

  const fullPath = path.join(workspaceDir, registryPath);

  try {
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    registryCache = JSON.parse(content) as ProjectRegistry;
    return registryCache;
  } catch {
    return null;
  }
}

/**
 * Resolve contact alias to actual phone numbers
 */
export function resolveContactAlias(registry: ProjectRegistry, alias: string): string[] {
  const resolved = registry.contact_aliases?.[alias];
  if (!resolved) {
    return [alias];
  }
  return Array.isArray(resolved) ? resolved : [resolved];
}

/**
 * Check if a phone number is authorized for a project
 */
export function isAuthorizedForProject(
  registry: ProjectRegistry,
  phone: string,
  projectId: string,
  ownerPhones: string[] = [],
): boolean {
  const normalizedPhone = phone.replace(/[^\d+]/g, "");

  const project = registry.projects.find((p) => p.id === projectId);
  if (!project) {
    // Unknown project - default to owner-only
    return ownerPhones.includes(normalizedPhone);
  }

  for (const authorized of project.authorized_contacts) {
    // Check if it's an alias
    const resolved = resolveContactAlias(registry, authorized);

    for (const authorizedPhone of resolved) {
      const normalizedAuth = authorizedPhone.replace(/[^\d+]/g, "");

      // "owner" is a special alias
      if (authorized === "owner" && ownerPhones.includes(normalizedPhone)) {
        return true;
      }

      if (normalizedAuth === normalizedPhone) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all projects a contact is authorized for
 */
export function getAuthorizedProjects(
  registry: ProjectRegistry,
  phone: string,
  ownerPhones: string[] = [],
): string[] {
  return registry.projects
    .filter((p) => isAuthorizedForProject(registry, phone, p.id, ownerPhones))
    .map((p) => p.id);
}

/**
 * Extract project keywords from registry for leak detection
 */
export function extractProjectKeywords(registry: ProjectRegistry): Map<string, string> {
  const keywords = new Map<string, string>();

  for (const project of registry.projects) {
    // Project name (case-insensitive)
    keywords.set(project.name.toLowerCase(), project.id);

    // Project ID
    keywords.set(project.id.toLowerCase(), project.id);

    // Custom keywords if defined
    if (project.keywords) {
      for (const kw of project.keywords) {
        keywords.set(kw.toLowerCase(), project.id);
      }
    }
  }

  return keywords;
}

/**
 * Scan text for potential project leaks
 * Returns list of unauthorized project mentions found
 */
export function detectProjectLeaks(
  registry: ProjectRegistry,
  text: string,
  authorizedProjects: string[],
): Array<{ keyword: string; projectId: string; projectName: string }> {
  const leaks: Array<{ keyword: string; projectId: string; projectName: string }> = [];
  const keywords = extractProjectKeywords(registry);
  const textLower = text.toLowerCase();

  for (const [keyword, projectId] of keywords) {
    if (textLower.includes(keyword) && !authorizedProjects.includes(projectId)) {
      const project = registry.projects.find((p) => p.id === projectId);
      leaks.push({
        keyword,
        projectId,
        projectName: project?.name ?? projectId,
      });
    }
  }

  // Deduplicate by projectId
  const seen = new Set<string>();
  return leaks.filter((leak) => {
    if (seen.has(leak.projectId)) return false;
    seen.add(leak.projectId);
    return true;
  });
}

/**
 * Redact project keywords from text
 */
export function redactProjectKeywords(
  text: string,
  keywords: string[],
  replacement = "[REDACTED]",
): string {
  let result = text;
  for (const keyword of keywords) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Clear registry cache
 */
export function clearRegistryCache(): void {
  registryCache = null;
}
