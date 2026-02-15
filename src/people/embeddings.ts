import type { Person } from "./types.js";

export function buildEmbeddingText(person: Person): string {
  const parts: string[] = [person.name];

  for (const org of person.orgs) {
    parts.push(org.role);
    if (org.department) {
      parts.push(org.department);
    }
    parts.push(org.org);
  }

  parts.push(person.primary_email);
  for (const email of person.emails) {
    if (email !== person.primary_email) {
      parts.push(email);
    }
  }

  return parts.filter(Boolean).join(" ");
}
