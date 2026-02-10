/**
 * Contact Guard Extension for Clawdbot
 *
 * Provides contact state management and project authorization hooks
 * to prevent data leaks across sessions.
 *
 * Hooks:
 * 1. before_agent_start - Auto-inject contact state into system context
 * 2. message_sending - Scan outgoing messages for project info leaks
 * 3. before_compaction - Preserve contact context in truncation summaries
 */

import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import {
  loadContactState,
  extractPhoneFromSessionKey,
  clearContactCache,
  type ContactState,
} from "./src/contact-state.js";
import {
  loadProjectRegistry,
  getAuthorizedProjects,
  detectProjectLeaks,
  redactProjectKeywords,
  clearRegistryCache,
  type ProjectRegistry,
} from "./src/project-auth.js";

interface ContactGuardConfig {
  contactStateDir: string;
  projectRegistry: string;
  ownerPhones: string[];
  enableAutoInject: boolean;
  enableLeakDetection: boolean;
  enableCompactionPreserve: boolean;
  leakAction: "warn" | "block" | "redact";
}

const DEFAULT_CONFIG: ContactGuardConfig = {
  contactStateDir: "memory/contacts",
  projectRegistry: "projects/registry.json",
  ownerPhones: [],
  enableAutoInject: true,
  enableLeakDetection: true,
  enableCompactionPreserve: true,
  leakAction: "warn",
};

/**
 * Build context injection for a contact
 */
function buildContactContextBlock(
  contact: ContactState,
  authorizedProjects: string[],
): string {
  const lines: string[] = [
    "<contact-context>",
    `Current contact: ${contact.name ?? "Unknown"} (${contact.phone})`,
  ];

  if (contact.relation) {
    lines.push(`Relation: ${contact.relation}`);
  }

  if (contact.activeProject) {
    lines.push(`Active project: ${contact.activeProject}`);
  }

  if (contact.lastTopic) {
    lines.push(`Last topic: ${contact.lastTopic}`);
  }

  if (authorizedProjects.length > 0) {
    lines.push(`Authorized to know about: ${authorizedProjects.join(", ")}`);
  } else {
    lines.push("Not authorized for any project discussions.");
  }

  lines.push("");
  lines.push("IMPORTANT: Only discuss projects this contact is authorized for.");
  lines.push("If context was truncated, use this info to maintain continuity.");
  lines.push("</contact-context>");

  return lines.join("\n");
}

export default function register(api: OpenClawPluginApi) {
  const pluginConfig = api.pluginConfig ?? {};
  const config: ContactGuardConfig = {
    ...DEFAULT_CONFIG,
    ...(typeof pluginConfig === "object" ? pluginConfig : {}),
  };

  // Resolve workspace directory
  const workspaceDir = api.runtime.state.resolveStateDir(api.config);

  api.logger.info?.("[contact-guard] Extension loaded");
  api.logger.info?.(`[contact-guard] Contact state dir: ${config.contactStateDir}`);
  api.logger.info?.(`[contact-guard] Project registry: ${config.projectRegistry}`);

  // =========================================================================
  // Hook 1: Auto-inject contact state on session start
  // =========================================================================
  if (config.enableAutoInject) {
    api.on("before_agent_start", async (event, ctx) => {
      if (!ctx.sessionKey) {
        return;
      }

      // Extract phone from session key
      const phone = extractPhoneFromSessionKey(ctx.sessionKey);
      if (!phone) {
        return;
      }

      // Skip for owner phones (they can see everything)
      if (config.ownerPhones.includes(phone)) {
        api.logger.debug?.(`[contact-guard] Skipping injection for owner: ${phone}`);
        return;
      }

      // Load contact state
      const contact = loadContactState(workspaceDir, config.contactStateDir, phone);
      if (!contact) {
        api.logger.debug?.(`[contact-guard] No contact state found for: ${phone}`);
        return;
      }

      // Load project registry and get authorized projects
      const registry = loadProjectRegistry(workspaceDir, config.projectRegistry);
      const authorizedProjects = registry
        ? getAuthorizedProjects(registry, phone, config.ownerPhones)
        : contact.authorizedProjects;

      // Build and inject context
      const contextBlock = buildContactContextBlock(contact, authorizedProjects);
      api.logger.info?.(
        `[contact-guard] Injecting context for ${contact.name ?? phone} ` +
          `(${authorizedProjects.length} authorized projects)`,
      );

      return {
        prependContext: contextBlock,
      };
    });
  }

  // =========================================================================
  // Hook 2: Scan outgoing messages for project leaks
  // =========================================================================
  if (config.enableLeakDetection) {
    api.on("message_sending", async (event, ctx) => {
      if (!event.content || !event.to) {
        return;
      }

      // Extract phone from target
      const phone = event.to.replace(/[^\d+]/g, "");
      if (!phone.startsWith("+")) {
        // Not a phone number, skip
        return;
      }

      // Skip for owner phones
      if (config.ownerPhones.includes(phone)) {
        return;
      }

      // Load project registry
      const registry = loadProjectRegistry(workspaceDir, config.projectRegistry);
      if (!registry) {
        return;
      }

      // Get authorized projects for this contact
      const authorizedProjects = getAuthorizedProjects(registry, phone, config.ownerPhones);

      // Scan for leaks
      const leaks = detectProjectLeaks(registry, event.content, authorizedProjects);

      if (leaks.length === 0) {
        return;
      }

      // Handle based on configured action
      const leakDetails = leaks.map((l) => `${l.projectName} (keyword: "${l.keyword}")`).join(", ");
      api.logger.warn?.(
        `[contact-guard] Potential project leak detected to ${phone}: ${leakDetails}`,
      );

      switch (config.leakAction) {
        case "block":
          api.logger.error?.(
            `[contact-guard] Blocking message to ${phone} due to project leak`,
          );
          return {
            cancel: true,
          };

        case "redact": {
          const keywords = leaks.map((l) => l.keyword);
          const redactedContent = redactProjectKeywords(event.content, keywords);
          api.logger.warn?.(`[contact-guard] Redacted ${keywords.length} project keywords`);
          return {
            content: redactedContent,
          };
        }

        case "warn":
        default:
          // Just log, don't modify or block
          return;
      }
    });
  }

  // =========================================================================
  // Hook 3: Preserve contact context during compaction
  // =========================================================================
  if (config.enableCompactionPreserve) {
    api.on("before_compaction", async (_event, ctx) => {
      if (!ctx.sessionKey) {
        return;
      }

      const phone = extractPhoneFromSessionKey(ctx.sessionKey);
      if (!phone) {
        return;
      }

      // Load contact for logging/debugging
      const contact = loadContactState(workspaceDir, config.contactStateDir, phone);
      if (contact) {
        api.logger.info?.(
          `[contact-guard] Compaction for ${contact.name ?? phone} session - ` +
            `contact context will be re-injected on next agent start`,
        );
      }

      // Note: The actual context preservation happens automatically because
      // before_agent_start runs after compaction and will re-inject the
      // contact context into the new, compacted conversation.
    });

    api.on("after_compaction", async (_event, ctx) => {
      if (!ctx.sessionKey) {
        return;
      }

      const phone = extractPhoneFromSessionKey(ctx.sessionKey);
      if (!phone) {
        return;
      }

      // Clear caches to ensure fresh data on next injection
      clearContactCache();
      clearRegistryCache();

      api.logger.debug?.(
        `[contact-guard] Cleared caches after compaction for session: ${ctx.sessionKey}`,
      );
    });
  }

  // =========================================================================
  // CLI command for testing/debugging
  // =========================================================================
  api.registerCli(
    ({ program }) => {
      program
        .command("contact-guard")
        .description("Contact guard utilities")
        .command("check")
        .description("Check contact authorization")
        .argument("<phone>", "Phone number to check")
        .action(async (phone: string) => {
          const normalizedPhone = phone.replace(/[^\d+]/g, "");
          const contact = loadContactState(workspaceDir, config.contactStateDir, normalizedPhone);

          if (!contact) {
            console.log(`No contact file found for: ${normalizedPhone}`);
            return;
          }

          console.log(`\nContact: ${contact.name ?? "Unknown"}`);
          console.log(`Phone: ${contact.phone}`);
          console.log(`Relation: ${contact.relation ?? "N/A"}`);
          console.log(`Active Project: ${contact.activeProject ?? "None"}`);
          console.log(`Last Topic: ${contact.lastTopic ?? "N/A"}`);

          const registry = loadProjectRegistry(workspaceDir, config.projectRegistry);
          if (registry) {
            const authorized = getAuthorizedProjects(registry, normalizedPhone, config.ownerPhones);
            console.log(`\nAuthorized Projects (${authorized.length}):`);
            for (const proj of authorized) {
              console.log(`  - ${proj}`);
            }
          }
        });
    },
    { commands: ["contact-guard"] },
  );
}
