/**
 * Group Context Hook Handler
 *
 * Injects group-specific context files into the bootstrap files
 * based on channel/group configuration.
 */
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Parse session key to extract channel and group ID
 * Session key format: agent:main:line:group:group:Cxxxxx or agent:main:telegram:group:-12345
 */
function parseSessionKey(sessionKey) {
  if (!sessionKey) return { channel: null, groupId: null };
  
  const parts = sessionKey.split(":");
  // Looking for patterns like:
  // agent:main:line:group:group:Cxxxxx
  // agent:main:telegram:group:-12345
  
  let channel = null;
  let groupId = null;
  
  for (let i = 0; i < parts.length; i++) {
    // Common channels
    if (["line", "telegram", "discord", "signal", "whatsapp"].includes(parts[i])) {
      channel = parts[i];
      // Look for group ID after "group" keyword
      const groupIndex = parts.indexOf("group", i);
      if (groupIndex !== -1 && parts[groupIndex + 1]) {
        // Handle LINE format: group:group:Cxxxxx (the second "group" is literal)
        if (parts[groupIndex + 1] === "group" && parts[groupIndex + 2]) {
          groupId = parts[groupIndex + 2];
        } else {
          groupId = parts[groupIndex + 1];
        }
      }
      break;
    }
  }
  
  return { channel, groupId };
}

/**
 * Load group-specific context files
 */
async function loadGroupContextFiles(workspaceDir, contextFilePaths) {
  const files = [];
  
  for (const relativePath of contextFilePaths) {
    if (typeof relativePath !== "string") continue;
    
    const fullPath = path.resolve(workspaceDir, relativePath);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      files.push({
        name: path.basename(relativePath),
        path: fullPath,
        content,
        missing: false,
      });
      console.log(`[group-context] Loaded context file: ${relativePath}`);
    } catch (err) {
      console.warn(`[group-context] Failed to load context file: ${relativePath}`);
      files.push({
        name: path.basename(relativePath),
        path: fullPath,
        content: `[MISSING] Expected at: ${fullPath}`,
        missing: true,
      });
    }
  }
  
  return files;
}

/**
 * Main hook handler
 */
const injectGroupContext = async (event) => {
  // Only handle agent:bootstrap events
  if (event.type !== "agent" || event.action !== "bootstrap") {
    return;
  }
  
  const context = event.context || {};
  const { cfg, workspaceDir, bootstrapFiles, sessionKey } = context;
  
  if (!cfg || !workspaceDir || !bootstrapFiles || !sessionKey) {
    return;
  }
  
  // Parse session key to get channel and group ID
  const { channel, groupId } = parseSessionKey(sessionKey);
  
  if (!channel || !groupId) {
    return;
  }
  
  console.log(`[group-context] Session: channel=${channel}, groupId=${groupId}`);
  
  // Look up group config
  const channelConfig = cfg.channels?.[channel];
  if (!channelConfig || typeof channelConfig !== "object") {
    return;
  }
  
  const groups = channelConfig.groups;
  if (!groups || typeof groups !== "object") {
    return;
  }
  
  const groupConfig = groups[groupId];
  if (!groupConfig || typeof groupConfig !== "object") {
    return;
  }
  
  const contextFilePaths = groupConfig.contextFiles;
  if (!Array.isArray(contextFilePaths) || contextFilePaths.length === 0) {
    return;
  }
  
  console.log(`[group-context] Found ${contextFilePaths.length} context files for group ${groupId}`);
  
  // Load the context files
  const groupFiles = await loadGroupContextFiles(workspaceDir, contextFilePaths);
  
  // Append to bootstrap files
  if (groupFiles.length > 0 && Array.isArray(context.bootstrapFiles)) {
    context.bootstrapFiles.push(...groupFiles);
    console.log(`[group-context] Injected ${groupFiles.length} context files`);
  }
};

export default injectGroupContext;
