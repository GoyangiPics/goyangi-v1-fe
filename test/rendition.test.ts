import { describe, expect, it } from 'vitest'
import { resolveRenditionMode } from '~/utils/rendition'

const base = { av1Supported: true as boolean | null, hasSd: true }

describe('resolveRenditionMode', () => {
  it('caps HD at SD on the grid, keeps HD in the viewer', () => {
    expect(resolveRenditionMode({ ...base, format: 'HD MP4 (AV1)', surface: 'grid' })).toBe('sd')
    expect(resolveRenditionMode({ ...base, format: 'HD MP4 (AV1)', surface: 'viewer' })).toBe('hd')
  })

  it('treats undetermined AV1 support as supported', () => {
    expect(
      resolveRenditionMode({
        ...base,
        av1Supported: null,
        format: 'HD MP4 (AV1)',
        surface: 'viewer',
      }),
    ).toBe('hd')
  })

  it('keeps HD in the grid when the record has no SD rendition', () => {
    expect(
      resolveRenditionMode({ ...base, hasSd: false, format: 'HD MP4 (AV1)', surface: 'grid' }),
    ).toBe('hd')
  })

  it('drops a device without AV1 to SD, or the preview when there is no SD', () => {
    for (const surface of ['grid', 'viewer'] as const) {
      expect(
        resolveRenditionMode({ ...base, av1Supported: false, format: 'HD MP4 (AV1)', surface }),
      ).toBe('sd')
      expect(
        resolveRenditionMode({
          av1Supported: false,
          hasSd: false,
          format: 'HD MP4 (AV1)',
          surface,
        }),
      ).toBe('preview')
    }
  })

  it('honours the lower settings identically on both surfaces', () => {
    for (const surface of ['grid', 'viewer'] as const) {
      expect(resolveRenditionMode({ ...base, format: 'SD MP4 (H264)', surface })).toBe('sd')
      expect(
        resolveRenditionMode({ ...base, hasSd: false, format: 'SD MP4 (H264)', surface }),
      ).toBe('hd')
      expect(resolveRenditionMode({ ...base, format: 'LD WebP', surface })).toBe('preview')
    }
  })
})
