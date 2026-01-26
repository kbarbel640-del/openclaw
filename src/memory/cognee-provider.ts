import fs from "node:fs/promises";
import path from "node:path";
import type { ClawdbotConfig } from "../config/config.js";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { resolveSessionTranscriptsDirForAgent } from "../config/sessions/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { MemorySearchResult } from "./index.js";
import {
  CogneeClient,
  type CogneeClientConfig,
  type CogneeSearchResult,
} from "./cognee-client.js";
import {
  buildFileEntry,
  hashText,
  listMemoryFiles,
  type MemoryFileEntry,
} from "./internal.js";

const log = createSubsystemLogger("cognee-provider");

const DEFAULT_DATASET_NAME = "clawdbot";
const DEFAULT_SEARCH_TYPE = "insights";
const DEFAULT_MAX_RESULTS = 6;
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_AUTO_COGNIFY = true;
const DEFAULT_COGNIFY_BATCH_SIZE = 100;
const SNIPPET_MAX_CHARS = 700;

export type CogneeProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
  datasetName?: string;
  searchType?: "insights" | "chunks" | "summaries";
  maxResults?: number;
  timeoutSeconds?: number;
  autoCognify?: boolean;
  cognifyBatchSize?: number;
};

export type CogneeMemorySource = "memory" | "sessions";

export class CogneeMemoryProvider {
  private readonly client: CogneeClient;
  private readonly cfg: ClawdbotConfig;
  private readonly agentId: string;
  private readonly workspaceDir: string;
  private readonly datasetName: string;
  private readonly searchType: "insights" | "chunks" | "summaries";
  private readonly maxResults: number;
  private readonly autoCognify: boolean;
  private readonly cognifyBatchSize: number;
  private readonly sources: Set&lt;CogneeMemorySource&gt;;
  private datasetId?: string;
  private syncedFiles = new Map&lt;string, string&gt;(); // path -&gt; hash

  constructor(
    cfg: ClawdbotConfig,
    agentId: string,
    sources: Array&lt;CogneeMemorySource&gt;,
    config: CogneeProviderConfig = {},
  ) {
    const timeoutMs = (config.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000;
    const clientConfig: CogneeClientConfig = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeoutMs,
    };

    this.client = new CogneeClient(clientConfig);
    this.cfg = cfg;
    this.agentId = agentId;
    this.workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    this.datasetName = config.datasetName || DEFAULT_DATASET_NAME;
    this.searchType = config.searchType || DEFAULT_SEARCH_TYPE;
    this.maxResults = config.maxResults || DEFAULT_MAX_RESULTS;
    this.autoCognify = config.autoCognify ?? DEFAULT_AUTO_COGNIFY;
    this.cognifyBatchSize = config.cognifyBatchSize || DEFAULT_COGNIFY_BATCH_SIZE;
    this.sources = new Set(sources);

    log.info("Cognee memory provider initialized", {
      agentId,
      datasetName: this.datasetName,
      searchType: this.searchType,
      sources: Array.from(this.sources),
    });
  }

  async healthCheck(): Promise&lt;boolean&gt; {
    return await this.client.healthCheck();
  }

  async sync(): Promise&lt;void&gt; {
    log.info("Starting Cognee memory sync", { agentId: this.agentId });

    let addedCount = 0;

    // Sync memory files
    if (this.sources.has("memory")) {
      const memoryFiles = await this.collectMemoryFiles();
      addedCount += await this.syncFiles(memoryFiles, "memory");
    }

    // Sync session transcripts
    if (this.sources.has("sessions")) {
      const sessionFiles = await this.collectSessionFiles();
      addedCount += await this.syncFiles(sessionFiles, "sessions");
    }

    // Run cognify if auto-enabled and files were added
    if (this.autoCognify &amp;&amp; addedCount &gt; 0) {
      log.info("Running cognify after sync", { addedCount });
      await this.cognify();
    }

    log.info("Cognee memory sync completed", {
      agentId: this.agentId,
      addedCount,
    });
  }

  async search(query: string): Promise&lt;MemorySearchResult[]&gt; {
    log.debug("Searching Cognee memory", { query, searchType: this.searchType });

    try {
      const response = await this.client.search({
        queryText: query,
        searchType: this.searchType,
        datasetIds: this.datasetId ? [this.datasetId] : undefined,
      });

      const results: MemorySearchResult[] = response.results
        .slice(0, this.maxResults)
        .map((r) =&gt; this.transformResult(r));

      log.debug("Cognee search completed", { query, resultCount: results.length });
      return results;
    } catch (error) {
      log.error("Cognee search failed", { error, query });
      throw error;
    }
  }

  async cognify(): Promise&lt;void&gt; {
    try {
      const response = await this.client.cognify({
        datasetIds: this.datasetId ? [this.datasetId] : undefined,
      });
      log.info("Cognify completed", { status: response.status });
    } catch (error) {
      log.error("Cognify failed", { error });
      throw error;
    }
  }

  async getStatus(): Promise&lt;{
    connected: boolean;
    datasetId?: string;
    datasetName: string;
    syncedFileCount: number;
    version?: string;
  }&gt; {
    try {
      const status = await this.client.status();
      const dataset = status.datasets?.find((d) =&gt; d.name === this.datasetName);

      return {
        connected: true,
        datasetId: this.datasetId || dataset?.id,
        datasetName: this.datasetName,
        syncedFileCount: this.syncedFiles.size,
        version: status.version,
      };
    } catch (error) {
      log.error("Failed to get Cognee status", { error });
      return {
        connected: false,
        datasetName: this.datasetName,
        syncedFileCount: this.syncedFiles.size,
      };
    }
  }

  private async collectMemoryFiles(): Promise&lt;MemoryFileEntry[]&gt; {
    const files: MemoryFileEntry[] = [];
    const memoryPaths = await listMemoryFiles(this.workspaceDir);

    for (const absPath of memoryPaths) {
      try {
        const entry = await buildFileEntry(absPath, this.workspaceDir);
        files.push(entry);
      } catch (error) {
        log.warn("Failed to process memory file", { absPath, error });
      }
    }

    return files;
  }

  private async collectSessionFiles(): Promise&lt;MemoryFileEntry[]&gt; {
    const files: MemoryFileEntry[] = [];
    const transcriptsDir = resolveSessionTranscriptsDirForAgent(
      this.cfg,
      this.agentId,
    );

    try {
      const entries = await fs.readdir(transcriptsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

        const absPath = path.join(transcriptsDir, entry.name);
        try {
          const stat = await fs.stat(absPath);
          const content = await fs.readFile(absPath, "utf-8");
          const hash = hashText(content);

          files.push({
            path: `sessions/${entry.name}`,
            absPath,
            mtimeMs: stat.mtimeMs,
            size: stat.size,
            hash,
          });
        } catch (error) {
          log.warn("Failed to process session file", { absPath, error });
        }
      }
    } catch (error) {
      log.debug("No session transcripts directory", { transcriptsDir });
    }

    return files;
  }

  private async syncFiles(
    files: MemoryFileEntry[],
    source: CogneeMemorySource,
  ): Promise&lt;number&gt; {
    let addedCount = 0;
    const batchSize = this.cognifyBatchSize;

    for (let i = 0; i &lt; files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      for (const file of batch) {
        const existingHash = this.syncedFiles.get(file.path);
        if (existingHash === file.hash) {
          log.debug("Skipping unchanged file", { path: file.path });
          continue;
        }

        try {
          const content = await fs.readFile(file.absPath, "utf-8");
          const metadata = {
            path: file.path,
            source,
            agentId: this.agentId,
            size: file.size,
            mtimeMs: file.mtimeMs,
          };

          const dataWithMetadata = `# ${file.path}\n\n${content}\n\n---\nMetadata: ${JSON.stringify(metadata)}`;

          const response = await this.client.add({
            data: dataWithMetadata,
            datasetName: this.datasetName,
          });

          if (!this.datasetId) {
            this.datasetId = response.datasetId;
          }

          this.syncedFiles.set(file.path, file.hash);
          addedCount++;

          log.debug("Added file to Cognee", {
            path: file.path,
            datasetId: response.datasetId,
          });
        } catch (error) {
          log.error("Failed to add file to Cognee", { path: file.path, error });
        }
      }
    }

    return addedCount;
  }

  private transformResult(result: CogneeSearchResult): MemorySearchResult {
    // Extract path from metadata or text
    const metadata = result.metadata || {};
    const path = (metadata.path as string) || "unknown";
    const source = (metadata.source as "memory" | "sessions") || "memory";

    // Truncate snippet to max chars
    let snippet = result.text;
    if (snippet.length &gt; SNIPPET_MAX_CHARS) {
      snippet = snippet.slice(0, SNIPPET_MAX_CHARS) + "...";
    }

    return {
      path,
      startLine: 0, // Cognee doesn't provide line numbers
      endLine: 0,
      score: result.score,
      snippet,
      source,
    };
  }
}

export async function createCogneeProvider(
  cfg: ClawdbotConfig,
  agentId: string,
  sources: Array&lt;CogneeMemorySource&gt;,
  config: CogneeProviderConfig = {},
): Promise&lt;CogneeMemoryProvider&gt; {
  const provider = new CogneeMemoryProvider(cfg, agentId, sources, config);

  // Verify connection
  const healthy = await provider.healthCheck();
  if (!healthy) {
    throw new Error(
      `Failed to connect to Cognee at ${config.baseUrl || "http://localhost:8000"}. ` +
        `Ensure Cognee is running (see docs/memory-cognee.md for setup).`,
    );
  }

  return provider;
}
