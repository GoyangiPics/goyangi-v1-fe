import type { Group, Idol, Tag } from '~/types/appTypes'
import { describe, expect, it } from 'vitest'
import {
  buildContentTitle,
  buildFormData,
  computeFileErrors,
  computeUploadErrors,
  resolveFileMeta,
  resolveTitle,
  stripExtension,
  toLocalDateString,
  unionRelations,
} from '~/utils/uploadPlan'

const IVE = { id: 'g1', name: 'IVE' } as Group
const ITZY = { id: 'g2', name: 'ITZY' } as Group
const ALL_GROUPS = [IVE, ITZY]

const yujin = { id: 'i1', name: 'Yujin', group: 'g1' } as unknown as Idol
const gaeul = { id: 'i2', name: 'Gaeul', group: 'g1' } as unknown as Idol
const yuna = { id: 'i3', name: 'Yuna', group: 'g2' } as unknown as Idol

const fancam = { id: 't1', name: 'fancam' } as Tag

const LIMITS = { label: 'GIF', maxFiles: 50, maxFileSizeMB: 100, maxTotalSizeMB: 1024 }

/** `size` is what the limit checks read, and a real File won't fake it. */
function fileOf(name: string, size = 10): File {
  const f = new File(['x'], name)
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const defaults = {
  idol: [yujin],
  tag: [fancam],
  title: '',
  date: new Date(2026, 6, 31),
}

describe('buildContentTitle', () => {
  it('joins idols and groups with a dash', () => {
    expect(buildContentTitle([yujin, gaeul], [IVE])).toBe('Yujin, Gaeul - IVE')
  })

  it('degrades to whichever side exists', () => {
    expect(buildContentTitle([yujin], [])).toBe('Yujin')
    expect(buildContentTitle([], [IVE])).toBe('IVE')
    expect(buildContentTitle([], [])).toBe('')
  })
})

describe('stripExtension', () => {
  it('drops only the last extension', () => {
    expect(stripExtension('clip.final.mp4')).toBe('clip.final')
    expect(stripExtension('noext')).toBe('noext')
  })

  it('leaves a dotted directory alone', () => {
    expect(stripExtension('some.dir/file')).toBe('some.dir/file')
  })
})

describe('resolveTitle', () => {
  // title is schema-required, so every branch must return something non-empty.
  it('prefers the per-file override', () => {
    expect(resolveTitle('mine', 'batch', [yujin], [IVE], 'a.gif')).toBe('mine')
  })

  it('falls back to the batch title', () => {
    expect(resolveTitle(undefined, 'batch', [yujin], [IVE], 'a.gif')).toBe('batch')
    expect(resolveTitle('   ', 'batch', [yujin], [IVE], 'a.gif')).toBe('batch')
  })

  it('then generates from the file’s own idols', () => {
    expect(resolveTitle(undefined, '', [yuna], [ITZY], 'a.gif')).toBe('Yuna - ITZY')
  })

  it('falls back to the filename rather than an empty or placeholder title', () => {
    expect(resolveTitle(undefined, '', [], [], 'my-clip.gif')).toBe('my-clip')
    expect(resolveTitle(undefined, '', [], [], '')).toBe('Untitled')
  })
})

describe('resolveFileMeta', () => {
  it('inherits everything when there is no override', () => {
    const meta = resolveFileMeta(defaults, undefined, ALL_GROUPS, 'a.gif')
    expect(meta.idol).toEqual([yujin])
    expect(meta.tag).toEqual([fancam])
    expect(meta.group).toEqual([IVE])
  })

  it('derives group from the overridden idols, not the batch ones', () => {
    const meta = resolveFileMeta(defaults, { idol: [yuna] }, ALL_GROUPS, 'a.gif')
    expect(meta.idol).toEqual([yuna])
    expect(meta.group).toEqual([ITZY])
    // The title regenerates from the file's own values.
    expect(meta.title).toBe('Yuna - ITZY')
  })

  // The important one: clearing a row must not silently restore the batch value,
  // or the user can never say "this file has none" — validation flags it instead.
  it('honours an explicitly emptied array rather than re-inheriting', () => {
    const meta = resolveFileMeta(defaults, { idol: [], tag: [] }, ALL_GROUPS, 'a.gif')
    expect(meta.idol).toEqual([])
    expect(meta.group).toEqual([])
    expect(meta.tag).toEqual([])
  })

  it('distinguishes a cleared date from an absent one', () => {
    expect(resolveFileMeta(defaults, { date: null }, ALL_GROUPS).date).toBeNull()
    expect(resolveFileMeta(defaults, {}, ALL_GROUPS).date).toEqual(defaults.date)
  })
})

function ctx(over: Partial<Parameters<typeof buildFormData>[2]> = {}) {
  return {
    filetype: 'gif',
    isSticker: false,
    source: '',
    uploaderId: 'up1',
    ...over,
  }
}

describe('buildFormData', () => {
  const meta = resolveFileMeta(defaults, undefined, ALL_GROUPS, 'a.gif')

  it('sends relations as repeated keys', () => {
    const two = resolveFileMeta(
      { ...defaults, idol: [yujin, yuna] },
      undefined,
      ALL_GROUPS,
      'a.gif',
    )
    const fd = buildFormData(fileOf('a.gif'), two, ctx())
    expect(fd.getAll('idol')).toEqual(['i1', 'i3'])
    expect(fd.getAll('group')).toEqual(['g1', 'g2'])
  })

  it('writes the resolved date as a local YYYY-MM-DD', () => {
    const fd = buildFormData(fileOf('a.gif'), meta, ctx())
    expect(fd.get('date')).toBe(toLocalDateString(defaults.date))
    expect(fd.get('date')).toBe('2026-07-31')
  })

  it('omits tag and date for stickers', () => {
    const fd = buildFormData(fileOf('a.png'), meta, ctx({ isSticker: true, filetype: 'sticker' }))
    expect(fd.getAll('tag')).toEqual([])
    expect(fd.get('date')).toBeNull()
    // …but still sends the required relations and title.
    expect(fd.getAll('idol')).toEqual(['i1'])
    expect(fd.get('title')).toBeTruthy()
  })

  it('sends preview_format only when given', () => {
    const bare = buildFormData(fileOf('a.gif'), meta, ctx())
    expect(bare.get('preview_format')).toBeNull()

    const full = buildFormData(fileOf('a.gif'), meta, ctx({ previewFormat: 'webp' }))
    expect(full.get('preview_format')).toBe('webp')
  })

  // The RIFE pipeline is unfinished and nothing in the UI can reach it, so the
  // upload path must not write these even for a gif.
  it('never sends interpolation fields', () => {
    const fd = buildFormData(fileOf('a.gif'), meta, ctx({ previewFormat: 'webp' }))
    expect(fd.get('interpolate')).toBeNull()
    expect(fd.get('interpolate_mode')).toBeNull()
  })

  it('sends set OR collections, whichever the caller supplied', () => {
    const inSet = buildFormData(fileOf('a.gif'), meta, ctx({ setId: 'set1' }))
    expect(inSet.get('set')).toBe('set1')
    expect(inSet.getAll('collections')).toEqual([])

    const inCollections = buildFormData(
      fileOf('a.gif'),
      meta,
      ctx({ setId: null, collectionIds: ['c1', 'c2'] }),
    )
    expect(inCollections.get('set')).toBeNull()
    expect(inCollections.getAll('collections')).toEqual(['c1', 'c2'])
  })

  it('omits uploader when the user has no uploader profile', () => {
    const fd = buildFormData(fileOf('a.gif'), meta, ctx({ uploaderId: undefined }))
    expect(fd.get('uploader')).toBeNull()
  })
})

describe('computeUploadErrors', () => {
  const base = {
    files: [fileOf('a.gif')],
    limits: LIMITS,
    batchIdols: [yujin],
    isSticker: false,
    title: '',
    source: '',
  }

  it('passes a well-formed batch', () => {
    expect(computeUploadErrors(base)).toEqual({})
  })

  it('requires files and idols', () => {
    expect(computeUploadErrors({ ...base, files: [] }).files).toBeTruthy()
    expect(computeUploadErrors({ ...base, batchIdols: [] }).idol).toBeTruthy()
  })

  it('reports the file that is too large, by name', () => {
    const big = fileOf('huge.gif', 200 * 1024 * 1024)
    expect(computeUploadErrors({ ...base, files: [big] }).files).toContain('huge.gif')
  })

  // Only reachable when no single file is oversized — the nested else in the
  // original, preserved here.
  it('checks the total only once every file individually fits', () => {
    const files = Array.from({ length: 15 }, (_, i) => fileOf(`f${i}.gif`, 90 * 1024 * 1024))
    expect(computeUploadErrors({ ...base, files }).files).toContain('Total size')
  })

  it('requires a title for stickers only', () => {
    expect(computeUploadErrors({ ...base, isSticker: true }).title).toBeTruthy()
    expect(computeUploadErrors({ ...base, isSticker: true, title: 'x' }).title).toBeUndefined()
    expect(computeUploadErrors(base).title).toBeUndefined()
  })

  // Collection mode has nowhere to put the files until one is picked, and unlike
  // set mode there's nothing to fall back to creating.
  it('requires a collection only when the destination is one', () => {
    expect(computeUploadErrors({ ...base, requiresCollection: true }).collection).toBeTruthy()
    expect(
      computeUploadErrors({ ...base, requiresCollection: true, collectionIds: ['c1'] }).collection,
    ).toBeUndefined()
    expect(computeUploadErrors({ ...base, collectionIds: [] }).collection).toBeUndefined()
  })

  it('rejects a non-http source but allows an empty one', () => {
    expect(computeUploadErrors({ ...base, source: 'javascript:alert(1)' }).source).toBeTruthy()
    expect(computeUploadErrors({ ...base, source: 'not a url' }).source).toBeTruthy()
    expect(computeUploadErrors({ ...base, source: '  ' }).source).toBeUndefined()
    expect(computeUploadErrors({ ...base, source: 'https://x.com/a' }).source).toBeUndefined()
  })
})

/** A resolved file, as the page builds them from selectedFiles + overrides. */
function resolvedOf(name: string, idol: Idol[], groups = ALL_GROUPS) {
  return {
    key: `${name}_1_1`,
    name,
    ...resolveFileMeta({ ...defaults, idol }, undefined, groups, name),
  }
}

describe('per-file validation', () => {
  const base = {
    files: [fileOf('a.gif'), fileOf('b.gif')],
    limits: LIMITS,
    batchIdols: [] as Idol[],
    isSticker: false,
    title: '',
    source: '',
  }

  // The point of per-file metadata: 50 unrelated gifs shouldn't force a
  // meaningless union at batch level just to pass validation.
  it('lets the batch picker be empty when every file has its own idol', () => {
    const resolvedFiles = [resolvedOf('a.gif', [yujin]), resolvedOf('b.gif', [yuna])]
    expect(computeUploadErrors({ ...base, resolvedFiles }).idol).toBeUndefined()
  })

  it('names the files that have no idol', () => {
    const resolvedFiles = [resolvedOf('a.gif', [yujin]), resolvedOf('b.gif', [])]
    const err = computeUploadErrors({ ...base, resolvedFiles }).idol
    expect(err).toContain('b.gif')
    expect(err).not.toContain('a.gif')
  })

  // When nothing anywhere has an idol, the batch picker is the thing to fix, so
  // the message should be the plain one rather than a list of every file.
  it('falls back to the batch message when no file has an idol', () => {
    const resolvedFiles = [resolvedOf('a.gif', []), resolvedOf('b.gif', [])]
    expect(computeUploadErrors({ ...base, resolvedFiles }).idol).toBe('Select at least one idol.')
  })

  it('flags an idol whose group is unknown', () => {
    // groups list omits IVE, so inferGroups yields nothing for yujin.
    const orphan = resolvedOf('a.gif', [yujin], [ITZY])
    const err = computeUploadErrors({ ...base, resolvedFiles: [orphan] }).group
    expect(err).toContain('a.gif')
  })

  it('keeps the old batch rule when no resolved files are supplied', () => {
    expect(computeUploadErrors(base).idol).toBe('Select at least one idol.')
  })
})

describe('computeFileErrors', () => {
  it('marks only the offending rows', () => {
    const rows = [resolvedOf('ok.gif', [yujin]), resolvedOf('bad.gif', [])]
    const errs = computeFileErrors(rows)
    expect(errs[rows[0]!.key]).toBeUndefined()
    expect(errs[rows[1]!.key]).toEqual(['Needs an idol.'])
  })

  it('reports the group problem separately from the idol one', () => {
    const orphan = resolvedOf('a.gif', [yujin], [ITZY])
    expect(computeFileErrors([orphan])[orphan.key]).toEqual(['This idol has no group.'])
  })
})

describe('unionRelations', () => {
  it('collects every idol and group across the batch, deduplicated', () => {
    const rows = [
      resolvedOf('a.gif', [yujin]),
      resolvedOf('b.gif', [yuna]),
      resolvedOf('c.gif', [yujin, gaeul]),
    ]
    const union = unionRelations(rows)
    expect(union.idol.map((i) => i.name)).toEqual(['Yujin', 'Yuna', 'Gaeul'])
    expect(union.group.map((g) => g.name)).toEqual(['IVE', 'ITZY'])
  })

  it('is empty for an empty batch', () => {
    expect(unionRelations([])).toEqual({ idol: [], group: [] })
  })
})
