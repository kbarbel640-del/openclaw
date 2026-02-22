export type OsType = "linux" | "windows" | "darwin";

export function detectOsType(): OsType {
  const p = process.platform ?? "";
  if (p === "win32") return "windows";
  if (p === "darwin") return "darwin";
  return "linux";
}
