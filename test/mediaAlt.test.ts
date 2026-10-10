import { describe, expect, it } from 'vite-plus/test'
import { contentAltText } from '~/utils/mediaAlt'

const ive = { expand: { idol: [{ name: 'Wonyoung' }], group: [{ name: 'IVE' }] } }

describe('contentAltText', () => {
  it('names the idol and group', () => {
    expect(contentAltText({ ...ive })).toBe('Wonyoung (IVE)')
  })

  it('leads with a real title', () => {
    expect(contentAltText({ ...ive, title: 'Love Dive stage' })).toBe(
      'Love Dive stage — Wonyoung (IVE)',
    )
  })

  // The bot titles posts "Idols - Groups"; repeating that in front of the names
  // would read "Wonyoung - IVE — Wonyoung (IVE)".
  it('drops an auto-generated title that only repeats the names', () => {
    expect(contentAltText({ ...ive, title: 'Wonyoung - IVE' })).toBe('Wonyoung (IVE)')
  })

  it('lists several idols and a group-only record', () => {
    expect(
      contentAltText({
        expand: { idol: [{ name: 'Yujin' }, { name: 'Gaeul' }], group: [{ name: 'IVE' }] },
      }),
    ).toBe('Yujin, Gaeul (IVE)')
    expect(contentAltText({ expand: { group: [{ name: 'IVE' }] } })).toBe('IVE')
  })

  it('falls back to the kind of media, then a generic word', () => {
    expect(contentAltText({ filetype: 'gif' })).toBe('GIF')
    expect(contentAltText({ filetype: 'image' })).toBe('Picture')
    expect(contentAltText({})).toBe('Media')
    expect(contentAltText(null)).toBe('')
  })
})
