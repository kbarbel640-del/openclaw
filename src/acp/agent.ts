/**
 * ACP Agent Implementation
 *
 * Implements the acp.Agent interface, handling protocol lifecycle
 * and delegating session work to AcpSessionAdapter.
 */

import type {
  Agent,
  AgentSideConnection,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  InitializeRequest,
  InitializeResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SetSessionModeRequest,
  SetSessionModeResponse,
} from "@agentclientprotocol/sdk";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

import { type ClawdisConfig, loadConfig } from "../config/config.js";
import { AcpSessionAdapter } from "./session.js";
import { CLAWDIS_AGENT_INFO } from "./types.js";

export type ClawdisAgentDeps = {
  config?: ClawdisConfig;
};

/**
 * Clawdis ACP Agent.
 *
 * Handles ACP protocol methods and manages sessions.
 * Follows the pattern from the ACP SDK example agent.
 */
export class ClawdisAgent implements Agent {
  private connection: AgentSideConnection;
  private sessions: Map<string, AcpSessionAdapter> = new Map();
  private config: ClawdisConfig;

  constructor(connection: AgentSideConnection, deps: ClawdisAgentDeps = {}) {
    this.connection = connection;
    this.config = deps.config ?? loadConfig();
  }

  /**
   * Initialize the agent, negotiating protocol version and capabilities.
   */
  async initialize(_params: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false, // Phase 3: enable once persistence is implemented
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true,
        },
        mcpCapabilities: {
          http: false,
          sse: false,
        },
      },
      agentInfo: CLAWDIS_AGENT_INFO,
      authMethods: [], // No auth required for local stdio
    };
  }

  /**
   * Create a new session.
   */
  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    const sessionId = crypto.randomUUID();

    const adapter = new AcpSessionAdapter(sessionId, params.cwd, {
      connection: this.connection,
      config: this.config,
    });

    this.sessions.set(sessionId, adapter);

    return { sessionId };
  }

  /**
   * Handle authentication (no-op for local agent).
   */
  async authenticate(
    _params: AuthenticateRequest,
  ): Promise<AuthenticateResponse | undefined> {
    return {};
  }

  /**
   * Handle session mode changes.
   * TODO: Map to Clawdis thinking levels in Phase 4.
   */
  async setSessionMode(
    _params: SetSessionModeRequest,
  ): Promise<SetSessionModeResponse> {
    return {};
  }

  /**
   * Handle a prompt request.
   */
  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const session = this.sessions.get(params.sessionId);

    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    return session.handlePrompt(params);
  }

  /**
   * Cancel an in-progress prompt.
   */
  async cancel(params: CancelNotification): Promise<void> {
    const session = this.sessions.get(params.sessionId);
    session?.cancel();
  }

  /**
   * Load a persisted session.
   * TODO: Implement in Phase 3.
   */
  async loadSession(_params: LoadSessionRequest): Promise<LoadSessionResponse> {
    throw new Error("Session loading not yet implemented");
  }
}
