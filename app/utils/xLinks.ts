/**
 * Finding X (Twitter) posts in pasted text, for the upload page's "From X"
 * import. Pure, so it is tested without a network — the same split imgurLinks.ts
 * uses for imgur.
 *
 * Every host people paste is a post link in the end: x.com and twitter.com
 * (with www. or mobile.), and the embed-fixing mirrors — fxtwitter.com,
 * fixupx.com, vxtwitter.com, fixvx.com — including their `d.`/`g.` direct-media
 * subdomains. All of them carry the same `/<user>/status/<id>` path, and the id
 * is all the FxTwitter API needs.
 */

/** One post to import. */
export interface XPostLink {
  /** The post's numeric id, as a string — ids are past Number's safe range. */
  id: string
  /**
   * The canonical link, `https://x.com/<user>/status/<id>`: what goes on the
   * record as `source`, whatever host was pasted. `i` stands in for the user
   * when the link didn't carry one, which x.com resolves the same way.
   */
  url: string
}

const HOSTS = ['x.com', 'twitter.com', 'fxtwitter.com', 'fixupx.com', 'vxtwitter.com', 'fixvx.com']

const LINK_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)?(?:x|twitter|fxtwitter|fixupx|vxtwitter|fixvx)\.com\/[^\s<>()"'`\]]+/gi

/** A pasted link as an X post, or null when it isn't one. */
export function parseXPostUrl(raw: string): XPostLink | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  if (!HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null

  // /<user>/status/<id>, /i/status/<id>, /i/web/status/<id>, with anything
  // after the id (/photo/2, /video/1, a trailing slash) ignored: the import
  // takes the whole post.
  const parts = u.pathname.split('/').filter(Boolean)
  const at = parts.indexOf('status')
  if (at < 1) return null
  const id = parts[at + 1] ?? ''
  if (!/^\d{1,20}$/.test(id)) return null
  const user = parts[0] === 'i' ? 'i' : parts[0]!

  return { id, url: `https://x.com/${user}/status/${id}` }
}

/** Every X post in raw text, in order, once each. */
export function extractXPostLinks(text: string): XPostLink[] {
  const seen = new Set<string>()
  const out: XPostLink[] = []
  for (const match of text.match(LINK_RE) ?? []) {
    // Trailing punctuation from prose ("…see https://x.com/a/status/1.").
    const post = parseXPostUrl(match.replace(/[.,;:!?]+$/, ''))
    if (post && !seen.has(post.id)) {
      seen.add(post.id)
      out.push(post)
    }
  }
  return out
}
