/**
 * URL/id-safe slug: trim, lowercase, spaces to hyphens, everything outside
 * [a-z0-9-] stripped, then edge hyphens trimmed.
 *
 * Used for saved-filter ids, and to *predict* a label's slug for optimistic UI —
 * the backend recomputes it on save and stays authoritative, so this is a
 * character-for-character port of hooks.Slugify (goyangi-v1-be/hooks/r2.go).
 * The two share test vectors: test/utils.test.ts ⇄ hooks/slugify_test.go.
 * Change one only together with the other.
 *
 * Deliberate quirks inherited from the backend: only literal spaces become
 * hyphens (each one — runs are NOT collapsed; other whitespace is stripped by
 * the charset filter), and underscores are stripped, not kept.
 */
export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(' ', '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
}
