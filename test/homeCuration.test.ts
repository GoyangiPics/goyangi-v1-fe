import type { Tag } from '~/types/appTypes'
import { describe, expect, it } from 'vite-plus/test'
import {
  anyTagClause,
  curatedFilter,
  findTag,
  homeTopic,
  starredClause,
  tally,
  topicFeedQuery,
  topicFilter,
} from '~/utils/homeCuration'

const tag = (id: string, name: string) => ({ id, name }) as unknown as Tag
const TAGS = [tag('t1', 'Cute'), tag('t2', 'emote'), tag('t3', 'Spicy'), tag('t4', 'Vlog')]

describe('findTag', () => {
  it('ignores case and a plural s', () => {
    expect(findTag(TAGS, 'cute')?.id).toBe('t1')
    expect(findTag(TAGS, 'Emotes')?.id).toBe('t2')
    expect(findTag(TAGS, 'fancam')).toBeUndefined()
  })
})

describe('anyTagClause', () => {
  it('ORs the tags that resolved and drops the rest', () => {
    expect(anyTagClause([TAGS[0], undefined, TAGS[3]])).toBe('(tag~"t1"||tag~"t4")')
  })
  it('is null when nothing resolved', () => {
    expect(anyTagClause([undefined])).toBeNull()
  })
})

describe('curatedFilter', () => {
  it('keeps site uploads of one filetype and hides spicy', () => {
    expect(curatedFilter(TAGS)).toBe('(origin="direct"||origin="imgur")&&filetype="gif"&&tag!~"t3"')
  })
  it('takes every filetype but stickers when given null', () => {
    expect(curatedFilter([], null, 'x=1')).toBe(
      '(origin="direct"||origin="imgur")&&filetype!="sticker"&&x=1',
    )
  })
})

describe('topicFilter', () => {
  it('is null for a topic whose tag does not exist', () => {
    expect(topicFilter(homeTopic('fancams'), TAGS)).toBeNull()
  })
  it('needs no tag for a filetype topic', () => {
    expect(topicFilter(homeTopic('videos'), TAGS)).toContain('filetype="video"')
  })
})

describe('topicFeedQuery', () => {
  it('uses the stored tag name', () => {
    expect(topicFeedQuery(homeTopic('emotes'), TAGS)).toEqual({
      filetype: 'gif',
      origin: 'direct,imgur',
      tag: 'emote',
    })
  })
})

describe('starredClause', () => {
  it('is null with nothing starred', () => {
    expect(starredClause([], [])).toBeNull()
  })
  it('matches any starred idol or group', () => {
    expect(starredClause(['i1'], ['g1'])).toBe('(idol.id?="i1"||group.id?="g1")')
  })
})

describe('tally', () => {
  it('counts each relation once per item, most frequent first', () => {
    const a = { id: 'a', name: 'A' }
    const b = { id: 'b', name: 'B' }
    expect(tally([[a, a], [b], [b]], (x) => x)).toEqual([
      { id: 'b', name: 'B', count: 2 },
      { id: 'a', name: 'A', count: 1 },
    ])
  })
})
