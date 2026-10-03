/**
 * User names arrive Discord-style as "name#discriminator"; everywhere the site
 * shows one, only the part before the hash is wanted. Safe on missing input so
 * expand chains can feed it directly.
 */
export function displayName(name: string | null | undefined): string {
  return name?.split('#')[0] ?? ''
}
