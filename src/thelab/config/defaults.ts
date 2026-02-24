import type { TheLabConfig } from "./thelab-config.js";

export const DEFAULT_CONFIG: TheLabConfig = {
  models: {
    primary: "mlx-community/Qwen2-VL-7B-Instruct-4bit",
    fallback: "mlx-community/llava-v1.6-mistral-7b-4bit",
    reasoning: "mlx-community/Llama-3.2-3B-Instruct-4bit",
  },
  lightroom: {
    watchFolder: "~/Pictures/TheLab/Incoming",
    exportFolder: "~/Pictures/TheLab/Exports",
    confidenceThreshold: 0.75,
    maxAdjustmentsPerImage: 8,
    appName: "Adobe Lightroom Classic",
  },
  notifications: {
    imessage: true,
    progressInterval: 25,
  },
  vision: {
    pythonPath: "python3",
    analyzerScript: "{baseDir}/src/thelab/vision/analyze.py",
    screenshotDir: "/tmp/thelab-screenshots",
    maxRetries: 2,
    enableClassification: false,
  },
  session: {
    sessionDir: "~/.thelab/sessions",
    preferencesDb: "~/.thelab/preferences.db",
    autoResume: true,
  },
  learning: {
    styleDbPath: "~/.thelab/style.db",
    catalogPath: "~/Pictures/Lightroom/MyCatalog.lrcat",
    observerPollMs: 3000,
    minSamplesForProfile: 3,
  },
};
