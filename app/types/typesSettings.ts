/**
 * `contentFormat` picks which stored rendition the site plays. Values double as
 * the tab labels in settings.
 *
 * - `HD MP4 (AV1)` — the 1080p AV1 MP4. Default, and automatically downgraded to
 *   H.264 on devices with no AV1 decoder (see `useContentSources`).
 * - `SD MP4 (H264)` — the 720p H.264 MP4, for anyone who wants it unconditionally.
 * - `LD WebP` — the animated preview image. Opt-in only: it decodes in software
 *   and stutters on the older hardware it used to be the fallback for, which is
 *   what the H.264 rendition replaced. Named for the common case; the object is
 *   AVIF on stills and on gifs uploaded before WebP previews became the default.
 *
 * Renaming any of these is a data migration, not a copy edit: the values are
 * persisted in localStorage and matched by string. See LEGACY_CONTENT_FORMATS.
 */
export type ContentFormat = 'HD MP4 (AV1)' | 'SD MP4 (H264)' | 'LD WebP'

/**
 * Pins every card's media to one aspect ratio, so stepping through a set stops
 * resizing the card.
 *
 * `Disabled` keeps the media at its own ratio, which is what the site has always
 * done: the card is whatever height the file turns out to be, so a set mixing a
 * portrait fancam with a landscape stage shot makes the whole masonry column jump
 * on every step. The ratios letterbox instead (object-contain — nothing is ever
 * cropped), trading empty space for a card that never moves.
 *
 * Same caveat as ContentFormat: these strings are the tab labels AND the
 * persisted values, so renaming one is a data migration.
 */
export type UniformCardRatio = 'Disabled' | '16:9' | '1:1' | '4:5'

export interface Settings {
  /**
   * A CEILING, not a target — useResponsiveColumns clamps it down on anything
   * too narrow to hold that many cards at a readable size. 5 and 6 only ever
   * engage above 1800px and 2160px respectively.
   */
  columnCount: '1' | '2' | '3' | '4' | '5' | '6'
  contentCount: '12' | '24' | '48'
  contentFormat: ContentFormat
  dataSavingMode: 'Disabled' | 'Enabled'
  noDistractionMode: 'Disabled' | 'Enabled'
  uniformCardRatio: UniformCardRatio
}
