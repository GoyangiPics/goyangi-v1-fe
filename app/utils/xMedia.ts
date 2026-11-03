/**
 * Reading an FxTwitter API answer into the files a post holds. Pure, so the
 * fiddly parts — which video rendition to take, what a failure looks like, what
 * a file is called — are tested against recorded responses rather than the
 * network.
 *
 * The API is `https://api.fxtwitter.com/status/<id>`. It was picked over the
 * `d.fxtwitter.com` redirect people know: that one hands over only the post's
 * FIRST item, through FxTwitter's own proxy, while the API lists every photo and
 * video with direct twimg links. Both twimg hosts allow goyangi.pics as a CORS
 * origin, so the browser can read the files itself.
 */
import { extensionForMime } from '~/utils/imgurFetch'

/** One file in a post. */
export interface XMediaItem {
  kind: 'photo' | 'video' | 'gif'
  /**
   * The URLs to try, best first. A photo has one, its `?name=orig` original. A
   * video or gif has its mp4 renditions by bitrate, so one over the size limit
   * can fall back to a smaller one rather than skipping the item.
   */
  candidates: string[]
  /** What the file will be served as — decided up front, so a type the tab can't take is never downloaded. */
  mime: string
}

export interface XPost {
  id: string
  /** The canonical post link, from the API. */
  url: string
  author: string
  /** When it was posted — the content's own date on the record. */
  postedAt: Date | null
  media: XMediaItem[]
}

/** Why a post gave nothing: gone or never existed, not public, or no media in it. */
export type XPostFailure = 'dead' | 'private' | 'noMedia'

interface FxVariant {
  url?: string
  bitrate?: number
  content_type?: string
}

interface FxMedia {
  type?: string
  url?: string
  variants?: FxVariant[]
}

interface FxResponse {
  code?: number
  message?: string
  tweet?: {
    id?: string
    url?: string
    author?: { screen_name?: string }
    created_timestamp?: number
    media?: { all?: FxMedia[] }
  } | null
}

/** The mp4 renditions of a video or gif, best first. */
function mp4Candidates(item: FxMedia): string[] {
  const mp4s = (item.variants ?? [])
    .filter((v) => v.url && v.content_type === 'video/mp4')
    .toSorted((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
    .map((v) => v.url!)
  // `url` is the top rendition already; it leads when variants are missing.
  if (item.url && !mp4s.includes(item.url)) mp4s.unshift(item.url)
  return mp4s
}

/** The original-size form of a twimg photo URL. */
function originalPhoto(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('name', 'orig')
    return u.toString()
  } catch {
    return url
  }
}

function mediaItem(item: FxMedia): XMediaItem | null {
  if (!item.url) return null
  if (item.type === 'photo') {
    const url = originalPhoto(item.url)
    // twimg serves the extension it names; png stays png.
    const mime = /\.png(\?|$)/i.test(item.url) ? 'image/png' : 'image/jpeg'
    return { kind: 'photo', candidates: [url], mime }
  }
  if (item.type === 'video' || item.type === 'gif') {
    const candidates = mp4Candidates(item)
    if (!candidates.length) return null
    return { kind: item.type, candidates, mime: 'video/mp4' }
  }
  return null
}

/**
 * An API answer as a post, or why it isn't one.
 *
 * `body` is whatever came back, already parsed — or null when it wasn't JSON at
 * all. That happens: a malformed id gets FxTwitter's HTML landing page with a
 * 200, so the status code alone says nothing.
 */
export function readXPost(body: unknown): XPost | XPostFailure {
  const res = body as FxResponse | null
  if (!res || typeof res !== 'object') return 'dead'
  if (res.code === 401 || res.message === 'PRIVATE_TWEET') return 'private'
  const tweet = res.tweet
  if (res.code !== 200 || !tweet?.id) return 'dead'

  const media = (tweet.media?.all ?? []).map(mediaItem).filter((m): m is XMediaItem => m !== null)
  if (!media.length) return 'noMedia'

  const author = tweet.author?.screen_name ?? 'i'
  return {
    id: tweet.id,
    url: tweet.url ?? `https://x.com/${author}/status/${tweet.id}`,
    author,
    postedAt: tweet.created_timestamp ? new Date(tweet.created_timestamp * 1000) : null,
    media,
  }
}

/** `x-<post id>-<n>.<ext>`: the post and position, never anything user-written. */
export function xFilename(postId: string, index: number, mime: string): string {
  return `x-${postId}-${index + 1}.${extensionForMime(mime) ?? 'bin'}`
}

/** The identity a re-import dedupes on: one post's nth item. */
export function xItemKey(postId: string, index: number): string {
  return `${postId}:${index}`
}
