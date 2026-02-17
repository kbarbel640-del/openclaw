/**
 * Cloud.ru AI Fabric — MCP Server Discovery Client
 *
 * Lists MCP servers and their tools for integration
 * with OpenClaw's tool chain.
 */

import type { CloudruClient } from "./cloudru-client.js";
import type { McpServer, InstanceType, ListMcpServersParams, PaginatedResult } from "./types.js";
import { CLOUDRU_DEFAULT_PAGE_SIZE } from "./constants.js";

export class CloudruMcpClient {
  constructor(private readonly client: CloudruClient) {}

  /** List MCP servers available in the project. */
  async listMcpServers(params?: ListMcpServersParams): Promise<PaginatedResult<McpServer>> {
    return this.client.get<PaginatedResult<McpServer>>("/mcpServers", {
      search: params?.search,
      limit: params?.limit ?? CLOUDRU_DEFAULT_PAGE_SIZE,
      offset: params?.offset ?? 0,
    });
  }

  /** List available instance types for agent provisioning. */
  async listInstanceTypes(): Promise<InstanceType[]> {
    return this.client.get<InstanceType[]>("/instanceTypes");
  }

  /** Get a specific instance type by ID. */
  async getInstanceType(instanceTypeId: string): Promise<InstanceType> {
    return this.client.get<InstanceType>(`/instanceTypes/${instanceTypeId}`);
  }
}
