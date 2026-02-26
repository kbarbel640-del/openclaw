export type FileIdentityStat = {
  dev: number | bigint;
  ino: number | bigint;
};

function isZero(value: number | bigint): boolean {
  return value === 0 || value === 0n;
}

export function sameFileIdentity(
  left: FileIdentityStat,
  right: FileIdentityStat,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (left.ino !== right.ino) {
    // On Windows, either side can report ino=0 for some filesystem / API combinations
    // (especially path-based stats vs fd-based stats). Treat ino=0 as "unknown".
    if (platform !== "win32" || (!isZero(left.ino) && !isZero(right.ino))) {
      return false;
    }
  }

  // On Windows, the dev id is not stable across stat variants (path vs fd) and
  // filesystem implementations. If the inode matches and is known, treat the
  // identity as stable regardless of dev.
  if (platform === "win32" && left.ino === right.ino && !isZero(left.ino)) {
    return true;
  }

  // Otherwise, require dev equality except for the "unknown" cases.
  if (left.dev === right.dev) {
    return true;
  }

  if (platform === "win32") {
    // path-based stats can report dev=0 while fd-based stat reports a real
    // volume serial; treat dev=0 as "unknown device".
    if (isZero(left.dev) || isZero(right.dev)) {
      return true;
    }

    // If inode is unknown (ino=0), dev can also vary. Treat dev as "unknown".
    if (isZero(left.ino) || isZero(right.ino)) {
      return true;
    }
  }

  return false;
}
