/**
 * Agent avatar image paths.
 * Images are stored in /public/avatars/<agentId>.png
 * Generated via nano-banana-pro with geometric low-poly style.
 */

export const agentAvatars: Record<string, string> = {
  ceo: "/avatars/ceo.png",
  cfo: "/avatars/cfo.png",
  cmo: "/avatars/cmo.png",
  coo: "/avatars/coo.png",
  cto: "/avatars/cto.png",
  hr: "/avatars/hr.png",
  knowledge: "/avatars/knowledge.png",
  legal: "/avatars/legal.png",
  strategy: "/avatars/strategy.png",
  "inventory-mgr": "/avatars/inventory-mgr.png",
  "fulfillment-mgr": "/avatars/fulfillment-mgr.png",
  "product-mgr": "/avatars/product-mgr.png",
  "marketing-dir": "/avatars/marketing-dir.png",
  "sales-dir": "/avatars/sales-dir.png",
  "compliance-dir": "/avatars/compliance-dir.png",
  "creative-dir": "/avatars/creative-dir.png",
  "cs-dir": "/avatars/cs-dir.png",
};

/**
 * Get the avatar URL for an agent. Returns undefined if no avatar exists.
 */
export function getAgentAvatar(agentId: string): string | undefined {
  return agentAvatars[agentId];
}
