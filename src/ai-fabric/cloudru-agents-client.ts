/**
 * Cloud.ru AI Fabric — Agent CRUD Client
 *
 * High-level operations for managing Cloud.ru AI Agents.
 * All methods are project-scoped via the underlying CloudruClient.
 */

import type { CloudruClient } from "./cloudru-client.js";
import type {
  Agent,
  CreateAgentParams,
  UpdateAgentParams,
  ListAgentsParams,
  PaginatedResult,
} from "./types.js";
import { CLOUDRU_DEFAULT_PAGE_SIZE } from "./constants.js";

export class CloudruAgentsClient {
  constructor(private readonly client: CloudruClient) {}

  /** List agents with optional filtering and pagination. */
  async list(params?: ListAgentsParams): Promise<PaginatedResult<Agent>> {
    return this.client.get<PaginatedResult<Agent>>("/agents", {
      search: params?.search,
      status: params?.status,
      limit: params?.limit ?? CLOUDRU_DEFAULT_PAGE_SIZE,
      offset: params?.offset ?? 0,
    });
  }

  /** Get a single agent by ID. */
  async get(agentId: string): Promise<Agent> {
    return this.client.get<Agent>(`/agents/${agentId}`);
  }

  /** Create a new agent. Returns immediately — poll status for RUNNING. */
  async create(params: CreateAgentParams): Promise<Agent> {
    return this.client.post<Agent>("/agents", params);
  }

  /** Update an existing agent. */
  async update(agentId: string, params: UpdateAgentParams): Promise<Agent> {
    return this.client.patch<Agent>(`/agents/${agentId}`, params);
  }

  /** Delete an agent. */
  async delete(agentId: string): Promise<void> {
    await this.client.delete(`/agents/${agentId}`);
  }

  /** Suspend an agent (transitions to SUSPENDED via ON_SUSPENSION). */
  async suspend(agentId: string): Promise<Agent> {
    return this.client.patch<Agent>(`/agents/suspend/${agentId}`);
  }

  /** Resume a suspended agent (transitions back toward RUNNING). */
  async resume(agentId: string): Promise<Agent> {
    return this.client.patch<Agent>(`/agents/resume/${agentId}`);
  }
}
