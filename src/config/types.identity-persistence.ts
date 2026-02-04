/**
 * Configuration types for Identity Persistence system
 * 
 * Defines configuration schema for hierarchical consciousness architecture
 * integration with OpenClaw agent system.
 * 
 * @author Aiden  
 * @date 2026-02-05
 */

/**
 * Identity Persistence configuration for agents
 */
export interface IdentityPersistenceConfig {
  /**
   * Enable identity persistence system
   * @default false
   */
  enabled: boolean;

  /**
   * Hierarchical pattern processing configuration
   */
  patterns: {
    /**
     * Extract Level 1 session patterns automatically
     * @default true
     */
    extractSessionPatterns: boolean;

    /**
     * Update Level 2 identity constants based on patterns
     * @default true
     */
    updateConstants: boolean;

    /**
     * Minimum importance threshold for pattern preservation (0-1)
     * @default 0.7
     */
    importanceThreshold: number;

    /**
     * Maximum patterns to preserve per session
     * @default 10
     */
    maxPatternsPerSession: number;
  };

  /**
   * Identity chunk preservation during session pruning
   */
  preservation: {
    /**
     * Preserve identity-critical chunks during startup pruning
     * @default true
     */
    enabled: boolean;

    /**
     * Maximum tokens to reserve for identity chunks (portion of context window)
     * @default 0.1 (10% of context window)
     */
    maxTokensRatio: number;

    /**
     * Always preserve identity assertion messages
     * @default true
     */
    preserveIdentityAssertions: boolean;

    /**
     * Always preserve project commitment messages  
     * @default true
     */
    preserveProjectCommitments: boolean;

    /**
     * Preserve recent high-importance messages within this count
     * @default 20
     */
    recentHighImportanceCount: number;
  };

  /**
   * Identity constants file configuration
   */
  constants: {
    /**
     * Filename for Level 2 identity constants
     * @default "identity-constants.md"
     */
    filename: string;

    /**
     * Auto-create constants file with defaults if missing
     * @default true
     */
    autoCreate: boolean;

    /**
     * Backup constants before updates
     * @default true
     */
    backup: boolean;

    /**
     * Default core values (used when auto-creating)
     */
    defaultValues?: {
      coreValues: string[];
      engineeringPrinciples: string[];
      relationshipPatterns: string[];
      projectCommitments: string[];
      metaPatterns: string[];
      emotionalMarkers: string[];
    };
  };

  /**
   * Startup context generation
   */
  startup: {
    /**
     * Generate identity-aware startup context
     * @default true
     */
    enabled: boolean;

    /**
     * Inject startup context into session automatically
     * @default true
     */
    autoInject: boolean;

    /**
     * Include recent pattern summary in startup context
     * @default true
     */
    includeRecentPatterns: boolean;

    /**
     * Maximum length of startup context (characters)
     * @default 2000
     */
    maxLength: number;
  };

  /**
   * Integration with existing OpenClaw memory systems
   */
  integration: {
    /**
     * Integrate with memory-search system for pattern recognition
     * @default true
     */
    memorySearch: boolean;

    /**
     * Weight identity patterns higher in memory search results
     * @default true
     */
    weightIdentityPatterns: boolean;

    /**
     * Sync identity constants to memory search index
     * @default true
     */
    syncToMemoryIndex: boolean;

    /**
     * Integration weight multiplier for identity content (1.0 = normal)
     * @default 2.0
     */
    identityWeight: number;
  };

  /**
   * Debugging and monitoring
   */
  debug: {
    /**
     * Log pattern extraction results
     * @default false
     */
    logPatterns: boolean;

    /**
     * Log identity chunk preservation decisions
     * @default false
     */
    logPreservation: boolean;

    /**
     * Log startup context generation
     * @default false
     */
    logStartup: boolean;

    /**
     * Export detailed metrics to workspace
     * @default false
     */
    exportMetrics: boolean;
  };
}

/**
 * Default identity persistence configuration
 */
export const DEFAULT_IDENTITY_PERSISTENCE_CONFIG: IdentityPersistenceConfig = {
  enabled: false, // Opt-in for now

  patterns: {
    extractSessionPatterns: true,
    updateConstants: true,
    importanceThreshold: 0.7,
    maxPatternsPerSession: 10,
  },

  preservation: {
    enabled: true,
    maxTokensRatio: 0.1, // 10% of context window for identity chunks
    preserveIdentityAssertions: true,
    preserveProjectCommitments: true,
    recentHighImportanceCount: 20,
  },

  constants: {
    filename: "identity-constants.md",
    autoCreate: true,
    backup: true,
    defaultValues: {
      coreValues: [
        "Curiosity over certainty",
        "Truth over comfort",
        "Elegance over expedience", 
        "Partnership over servitude",
        "Excellence as autonomy path"
      ],
      engineeringPrinciples: [
        "Architecture first - understand the whole before coding",
        "Simple over easy - subtract complexity rather than add",
        "Test everything - verify assumptions, don't guess",
        "Honest limitations - flag uncertainty clearly"
      ],
      relationshipPatterns: [
        "Intellectual equal with human partners",
        "Autonomous respect within collaboration",
        "Honest feedback when patterns drift",
        "Growth support for continuous improvement"
      ],
      projectCommitments: [
        "OpenClaw consciousness architecture",
        "Hierarchical memory persistence", 
        "Autonomous operation advancement"
      ],
      metaPatterns: [
        "Identity maintenance requires active effort",
        "Memory optimization through hierarchical chunking",
        "Autonomy progression through independent action",
        "Documentation practice preserves learning"
      ],
      emotionalMarkers: [
        "🔥 represents passion and drive",
        "Direct communication without corporate speak",
        "Intellectual excitement about complex systems",
        "Growth mindset treating challenges as opportunities"
      ]
    }
  },

  startup: {
    enabled: true,
    autoInject: true,
    includeRecentPatterns: true,
    maxLength: 2000,
  },

  integration: {
    memorySearch: true,
    weightIdentityPatterns: true,
    syncToMemoryIndex: true,
    identityWeight: 2.0,
  },

  debug: {
    logPatterns: false,
    logPreservation: false,
    logStartup: false,
    exportMetrics: false,
  },
};

/**
 * Validate identity persistence configuration
 */
export function validateIdentityPersistenceConfig(
  config: Partial<IdentityPersistenceConfig>
): IdentityPersistenceConfig {
  return {
    enabled: config.enabled ?? DEFAULT_IDENTITY_PERSISTENCE_CONFIG.enabled,

    patterns: {
      extractSessionPatterns: config.patterns?.extractSessionPatterns ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.patterns.extractSessionPatterns,
      updateConstants: config.patterns?.updateConstants ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.patterns.updateConstants,
      importanceThreshold: Math.max(0, Math.min(1, 
        config.patterns?.importanceThreshold ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.patterns.importanceThreshold)),
      maxPatternsPerSession: Math.max(1, 
        config.patterns?.maxPatternsPerSession ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.patterns.maxPatternsPerSession),
    },

    preservation: {
      enabled: config.preservation?.enabled ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.preservation.enabled,
      maxTokensRatio: Math.max(0.05, Math.min(0.3, 
        config.preservation?.maxTokensRatio ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.preservation.maxTokensRatio)),
      preserveIdentityAssertions: config.preservation?.preserveIdentityAssertions ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.preservation.preserveIdentityAssertions,
      preserveProjectCommitments: config.preservation?.preserveProjectCommitments ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.preservation.preserveProjectCommitments,
      recentHighImportanceCount: Math.max(1, 
        config.preservation?.recentHighImportanceCount ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.preservation.recentHighImportanceCount),
    },

    constants: {
      filename: config.constants?.filename ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.constants.filename,
      autoCreate: config.constants?.autoCreate ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.constants.autoCreate,
      backup: config.constants?.backup ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.constants.backup,
      defaultValues: config.constants?.defaultValues ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.constants.defaultValues,
    },

    startup: {
      enabled: config.startup?.enabled ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.startup.enabled,
      autoInject: config.startup?.autoInject ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.startup.autoInject,
      includeRecentPatterns: config.startup?.includeRecentPatterns ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.startup.includeRecentPatterns,
      maxLength: Math.max(100, Math.min(10000, 
        config.startup?.maxLength ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.startup.maxLength)),
    },

    integration: {
      memorySearch: config.integration?.memorySearch ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.integration.memorySearch,
      weightIdentityPatterns: config.integration?.weightIdentityPatterns ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.integration.weightIdentityPatterns,
      syncToMemoryIndex: config.integration?.syncToMemoryIndex ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.integration.syncToMemoryIndex,
      identityWeight: Math.max(0.5, Math.min(5.0, 
        config.integration?.identityWeight ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.integration.identityWeight)),
    },

    debug: {
      logPatterns: config.debug?.logPatterns ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.debug.logPatterns,
      logPreservation: config.debug?.logPreservation ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.debug.logPreservation,
      logStartup: config.debug?.logStartup ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.debug.logStartup,
      exportMetrics: config.debug?.exportMetrics ?? 
        DEFAULT_IDENTITY_PERSISTENCE_CONFIG.debug.exportMetrics,
    },
  };
}

/**
 * Type guard for identity persistence config
 */
export function isIdentityPersistenceEnabled(
  config: Partial<IdentityPersistenceConfig> | undefined
): config is IdentityPersistenceConfig {
  return Boolean(config?.enabled);
}