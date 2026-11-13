const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Short random id (10 chars, ~51 bits). Collisions are irrelevant at the scale of one user's week. */
export function newId(length = 10): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

/** Deterministic id factory for tests and snapshots. */
export function sequentialIds(prefix = "id"): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}
