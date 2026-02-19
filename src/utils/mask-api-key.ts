export const maskApiKey = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "missing";
  }
  const prefix = trimmed.slice(0, 4);
  return `${prefix}****`;
};
