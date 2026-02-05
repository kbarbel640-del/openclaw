import fs from "node:fs/promises";
import path from "node:path";
import type { NeuronWavesPolicy } from "./types.js";
import { resolveNeuronWavesDir } from "../state.js";
import { defaultNeuronWavesPolicy } from "./defaults.js";

export function resolveNeuronWavesPolicyPath(workspaceDir: string) {
  return path.join(resolveNeuronWavesDir(workspaceDir), "policy.json");
}

export async function loadNeuronWavesPolicy(workspaceDir: string): Promise<NeuronWavesPolicy> {
  const file = resolveNeuronWavesPolicyPath(workspaceDir);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<NeuronWavesPolicy>;
    if (parsed && typeof parsed === "object") {
      const base = defaultNeuronWavesPolicy();
      return {
        ...base,
        ...parsed,
        rules: { ...base.rules, ...(parsed.rules ?? {}) },
        limits: { ...base.limits, ...(parsed.limits ?? {}) },
      };
    }
  } catch {
    // ignore
  }
  return defaultNeuronWavesPolicy();
}

export async function saveNeuronWavesPolicy(workspaceDir: string, policy: NeuronWavesPolicy) {
  const dir = resolveNeuronWavesDir(workspaceDir);
  await fs.mkdir(dir, { recursive: true });
  const file = resolveNeuronWavesPolicyPath(workspaceDir);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(policy, null, 2) + "\n", "utf-8");
  await fs.rename(tmp, file);
}
