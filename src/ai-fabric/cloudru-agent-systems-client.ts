/**
 * Cloud.ru AI Fabric — Agent Systems Client
 *
 * High-level operations for managing Cloud.ru multi-agent systems.
 * Agent Systems orchestrate multiple agents via a router.
 */

import type { CloudruClient } from "./cloudru-client.js";
import type {
  AgentSystem,
  CreateAgentSystemParams,
  UpdateAgentSystemParams,
  ListAgentSystemsParams,
  PaginatedResult,
} from "./types.js";
import { CLOUDRU_DEFAULT_PAGE_SIZE } from "./constants.js";

export class CloudruAgentSystemsClient {
  constructor(private readonly client: CloudruClient) {}

  /** List agent systems with optional filtering and pagination. */
  async list(params?: ListAgentSystemsParams): Promise<PaginatedResult<AgentSystem>> {
    return this.client.get<PaginatedResult<AgentSystem>>("/agentSystems", {
      search: params?.search,
      status: params?.status,
      limit: params?.limit ?? CLOUDRU_DEFAULT_PAGE_SIZE,
      offset: params?.offset ?? 0,
    });
  }

  /** Get a single agent system by ID. */
  async get(systemId: string): Promise<AgentSystem> {
    return this.client.get<AgentSystem>(`/agentSystems/${systemId}`);
  }

  /** Create a new agent system. */
  async create(params: CreateAgentSystemParams): Promise<AgentSystem> {
    return this.client.post<AgentSystem>("/agentSystems", params);
  }

  /** Update an existing agent system. */
  async update(systemId: string, params: UpdateAgentSystemParams): Promise<AgentSystem> {
    return this.client.patch<AgentSystem>(`/agentSystems/${systemId}`, params);
  }

  /** Delete an agent system. */
  async delete(systemId: string): Promise<void> {
    await this.client.delete(`/agentSystems/${systemId}`);
  }

  /** Suspend an agent system. */
  async suspend(systemId: string): Promise<AgentSystem> {
    return this.client.patch<AgentSystem>(`/agentSystems/suspend/${systemId}`);
  }

  /** Resume a suspended agent system. */
  async resume(systemId: string): Promise<AgentSystem> {
    return this.client.patch<AgentSystem>(`/agentSystems/resume/${systemId}`);
  }

  /** Add an agent to a system. */
  async addAgent(systemId: string, agentId: string): Promise<AgentSystem> {
    return this.client.patch<AgentSystem>(`/agentSystems/${systemId}/${agentId}`);
  }

  /** Remove an agent from a system. */
  async removeAgent(systemId: string, agentId: string): Promise<void> {
    await this.client.delete(`/agentSystems/${systemId}/${agentId}`);
  }
}
