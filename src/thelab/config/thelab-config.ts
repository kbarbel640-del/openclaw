export interface TheLabConfig {
  models: {
    primary: string;
    fallback: string;
    reasoning: string;
  };
  lightroom: {
    watchFolder: string;
    exportFolder: string;
    confidenceThreshold: number;
    maxAdjustmentsPerImage: number;
    appName: string;
  };
  notifications: {
    imessage: boolean;
    progressInterval: number;
  };
  vision: {
    pythonPath: string;
    analyzerScript: string;
    screenshotDir: string;
    maxRetries: number;
    /** Enable VLM-based scene classification (requires mlx-vlm + Qwen model) */
    enableClassification?: boolean;
  };
  session: {
    sessionDir: string;
    preferencesDb: string;
    autoResume: boolean;
  };
  learning: {
    styleDbPath: string;
    catalogPath: string;
    observerPollMs: number;
    minSamplesForProfile: number;
  };
}

export function resolveConfigPaths(config: TheLabConfig, baseDir: string): TheLabConfig {
  const home = process.env.HOME ?? "~";
  const resolve = (p: string) => p.replace(/^~/, home).replace("{baseDir}", baseDir);

  return {
    ...config,
    lightroom: {
      ...config.lightroom,
      watchFolder: resolve(config.lightroom.watchFolder),
      exportFolder: resolve(config.lightroom.exportFolder),
    },
    vision: {
      ...config.vision,
      analyzerScript: resolve(config.vision.analyzerScript),
      screenshotDir: resolve(config.vision.screenshotDir),
    },
    session: {
      ...config.session,
      sessionDir: resolve(config.session.sessionDir),
      preferencesDb: resolve(config.session.preferencesDb),
    },
    learning: {
      ...config.learning,
      styleDbPath: resolve(config.learning.styleDbPath),
      catalogPath: resolve(config.learning.catalogPath),
    },
  };
}
