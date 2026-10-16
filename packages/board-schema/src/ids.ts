/**
 * Id generation for board documents.
 *
 * Not security-sensitive (client-generated document ids, never tokens), so it
 * works in Hermes (no crypto.randomUUID) and in Node/browser alike.
 */
export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
