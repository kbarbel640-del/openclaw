/**
 * Windows service management hints
 */

export function renderWindowsGatewayHints(): string[] {
  return [
    "Windows uses Task Scheduler for gateway service management.",
  ];
}

export function isWindowsServiceUnavailableDetail(detail?: string): boolean {
  if (!detail) {
    return false;
  }
  const normalized = detail.toLowerCase();
  return (
    normalized.includes("task not found") ||
    normalized.includes("not installed")
  );
}
