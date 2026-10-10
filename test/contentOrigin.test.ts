import { describe, expect, it } from 'vite-plus/test'
import { contentOrigin } from '~/utils/contentOrigin'

describe('contentOrigin', () => {
  it('prefers the explicit origin field', () => {
    expect(contentOrigin({ origin: 'direct' })).toBe('direct')
    expect(contentOrigin({ origin: 'discord' })).toBe('discord')
    expect(contentOrigin({ origin: 'imgur' })).toBe('imgur')
  })

  it('lets origin win over a conflicting discord link', () => {
    // Shouldn't happen — the backfill derives origin FROM discord — but the
    // explicit field is authoritative if they ever disagree.
    expect(contentOrigin({ origin: 'direct', discord: 'https://discord.com/x' })).toBe('direct')
  })

  describe('falls back to discord for un-backfilled rows', () => {
    it('treats a jump link as discord-sourced', () => {
      expect(contentOrigin({ discord: 'https://discord.com/channels/1/2/3' })).toBe('discord')
    })

    it('treats an empty discord as a site upload', () => {
      // PocketBase returns every declared field, using '' when unset — so an
      // empty string here means "a content record with no jump link".
      expect(contentOrigin({ discord: '' })).toBe('direct')
      expect(contentOrigin({ discord: '   ' })).toBe('direct')
    })

    it('ignores an empty origin string', () => {
      // '' is the backfill sentinel, not a value.
      expect(contentOrigin({ origin: '', discord: 'https://discord.com/x' })).toBe('discord')
      expect(contentOrigin({ origin: '', discord: '' })).toBe('direct')
    })
  })

  it('does NOT infer provenance from mirror', () => {
    // The regression this helper exists for. `mirror` is set only for imgur
    // links, so a Discord attachment / catbox / pixeldrain ingest has an empty
    // mirror — and the old `!content.mirror` test called all of them "Direct".
    // Here, a record with no mirror but a jump link is correctly discord.
    expect(contentOrigin({ discord: 'https://discord.com/channels/1/2/3' })).toBe('discord')
  })

  it('returns null when provenance cannot be known', () => {
    // Sets and collections carry neither field until origin is backfilled onto
    // them; guessing would be worse than showing nothing.
    expect(contentOrigin({})).toBe(null)
    expect(contentOrigin(null)).toBe(null)
    expect(contentOrigin(undefined)).toBe(null)
  })

  it('rejects an unrecognised origin value rather than passing it through', () => {
    expect(contentOrigin({ origin: 'twitter' })).toBe(null)
    expect(contentOrigin({ origin: 'twitter', discord: '' })).toBe('direct')
  })
})
