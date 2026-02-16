import type { ScaffoldExecutor, ScaffoldExecutorId } from "./executors/types.js";
import { GvpExecutor } from "./executors/gvp-executor.js";

const executors: Record<ScaffoldExecutorId, ScaffoldExecutor> = {
  "g-v-p": new GvpExecutor(),
};

export function getScaffoldExecutor(id: ScaffoldExecutorId): ScaffoldExecutor {
  return executors[id];
}
