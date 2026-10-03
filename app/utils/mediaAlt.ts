/**
 * Alt text for a content item's media, from what the record already knows.
 *
 * It used to be the literal strings "preview" and "pic" on every image on the
 * site — what a screen reader announced for each card, and what Google Images
 * indexed. The record carries idols, groups and a title, so the description is a
 * template, not a feature: "Love Dive stage — Wonyoung (IVE)".
 */

interface AltSource {
  title?: string
  filetype?: string
  expand?: {
    idol?: Array<{ name?: string }>
    group?: Array<{ name?: string }>
  }
}

const KIND: Record<string, string> = {
  gif: 'GIF',
  video: 'Video',
  image: 'Picture',
  sticker: 'Sticker',
}

export function contentAltText(content: AltSource | null | undefined): string {
  if (!content) return ''
  const idols = (content.expand?.idol ?? []).map((i) => i.name?.trim()).filter(Boolean)
  const groups = (content.expand?.group ?? []).map((g) => g.name?.trim()).filter(Boolean)

  let who = idols.join(', ')
  if (groups.length) who = who ? `${who} (${groups.join(', ')})` : groups.join(', ')

  const title = content.title?.trim() ?? ''
  // The auto-generated title is "Idols - Groups", which would only repeat `who`.
  const titleIsNew = title && !who.startsWith(title.split(' - ')[0] ?? '')

  const parts = [titleIsNew ? title : '', who].filter(Boolean)
  if (parts.length) return parts.join(' — ')
  return KIND[content.filetype ?? ''] ?? 'Media'
}
