/**
 * A stable identity for a staged `File`.
 *
 * Files have no id, so anything keyed to one — the dedupe set, the object-URL
 * cache, the per-file metadata overrides — needs a derived key. Name alone
 * collides constantly (`image.gif` from two folders); name + size still collides
 * on re-encodes of the same clip. Adding `lastModified` makes a collision mean
 * "genuinely the same file", which is exactly what dedupe should treat as one.
 *
 * Single-sourced deliberately: if two callers disagree on the key, an override
 * attaches to the wrong file or a revoked object URL orphans another's preview.
 */
export function fileKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`
}
