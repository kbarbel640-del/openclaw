/**
 * Agent avatar image paths.
 * Images are stored in /public/avatars/<agentId>.(png|jpg)
 * Generated via nano-banana-pro with geometric low-poly style.
 */

export const agentAvatars: Record<string, string> = {
  ceo: "/avatars/ceo.png",
  cfo: "/avatars/cfo.jpg",
  cmo: "/avatars/cmo.jpg",
  coo: "/avatars/coo.jpg",
  cto: "/avatars/cto.jpg",
  hr: "/avatars/hr.jpg",
  knowledge: "/avatars/knowledge.jpg",
  legal: "/avatars/legal.jpg",
  strategy: "/avatars/strategy.jpg",
  "inventory-mgr": "/avatars/inventory-mgr.jpg",
  "fulfillment-mgr": "/avatars/fulfillment-mgr.jpg",
  "product-mgr": "/avatars/product-mgr.jpg",
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
