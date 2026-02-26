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
  if (platform !== "win32" && left.ino !== right.ino) {
    return false;
  }

  // On Windows, inode values are not consistently stable across path-based and
  // fd-based stat calls. Treat inode as advisory and anchor identity on device.
  // Path-based stat calls can also report dev=0 while fd-based stat reports a
  // real volume serial; treat either-side dev=0 as "unknown device".
  if (left.dev === right.dev) {
    return true;
  }
  return platform === "win32" && (isZero(left.dev) || isZero(right.dev));
}
