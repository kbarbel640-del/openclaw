type StateDirEnvSnapshot = {
  amigoStateDir: string | undefined;
  amigoStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    amigoStateDir: process.env.AMIGO_STATE_DIR,
    amigoStateDir: process.env.AMIGO_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.amigoStateDir === undefined) {
    delete process.env.AMIGO_STATE_DIR;
  } else {
    process.env.AMIGO_STATE_DIR = snapshot.amigoStateDir;
  }
  if (snapshot.amigoStateDir === undefined) {
    delete process.env.AMIGO_STATE_DIR;
  } else {
    process.env.AMIGO_STATE_DIR = snapshot.amigoStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.AMIGO_STATE_DIR = stateDir;
  delete process.env.AMIGO_STATE_DIR;
}
