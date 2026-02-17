export type Tier = "SIMPLE" | "MEDIUM" | "COMPLEX" | "REASONING";

export type RoutingProfile = "auto" | "eco" | "premium" | "free";

export type DimensionScores = {
  tokenCount: number;
  codePresence: number;
  reasoningMarkers: number;
  technicalTerms: number;
  creativeMarkers: number;
  simpleIndicators: number;
  multiStepPatterns: number;
  questionComplexity: number;
  imperativeVerbs: number;
  constraintCount: number;
  outputFormat: number;
  referenceComplexity: number;
  negationComplexity: number;
  domainSpecificity: number;
  agenticTask: number;
};

export type ScoringResult = {
  tier: Tier;
  confidence: number;
  rawScore: number;
  scores: DimensionScores;
  agenticScore: number;
  isAgentic: boolean;
};

export type RoutingDecision = {
  model: string;
  tier: Tier;
  profile: RoutingProfile;
  confidence: number;
  cached: boolean;
  deduped: boolean;
  sessionPinned: boolean;
  agenticOverride: boolean;
};

export type TierModelMapping = Record<Tier, string>;

export type ProfileConfig = {
  name: RoutingProfile;
  label: string;
  description: string;
  tierModels: TierModelMapping;
};

export type SessionEntry = {
  model: string;
  tier: Tier;
  expiresAt: number;
};

export type CacheEntry<T = unknown> = {
  response: T;
  size: number;
  expiresAt: number;
};

export type RoutingStats = {
  totalRequests: number;
  requestsByTier: Record<Tier, number>;
  requestsByProvider: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  dedupHits: number;
  agenticOverrides: number;
  activeProfile: RoutingProfile;
};

export type ProviderEndpoint = {
  url: string;
  apiKey: string;
  format: "openai" | "anthropic";
};
