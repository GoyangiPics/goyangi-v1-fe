import { describe, expect, it } from 'vitest'
import { canManagePost, canManageSet, setDeleteMode } from '~/utils/ownership'

const me = { isAdmin: false, uploaderId: 'up1' }
const admin = { isAdmin: true, uploaderId: 'upA' }
const anon = { isAdmin: false, uploaderId: null }

describe('canManagePost', () => {
  it('is yours when the uploader is', () => {
    expect(canManagePost({ uploader: 'up1' }, me)).toBe(true)
    expect(canManagePost({ uploader: 'up2' }, me)).toBe(false)
  })

  // Discord-only uploaders have no account behind them: nobody but an admin.
  it('leaves unowned posts to admins', () => {
    expect(canManagePost({ uploader: '' }, me)).toBe(false)
    expect(canManagePost({ uploader: '' }, anon)).toBe(false)
    expect(canManagePost({ uploader: '' }, admin)).toBe(true)
  })

  it('needs a post', () => {
    expect(canManagePost(null, admin)).toBe(false)
  })
})

describe('canManageSet', () => {
  it('is yours when you are one of its uploaders', () => {
    expect(canManageSet({ uploader: ['up2', 'up1'] }, me)).toBe(true)
    expect(canManageSet({ uploader: ['up2'] }, me)).toBe(false)
    expect(canManageSet({ uploader: [] }, admin)).toBe(true)
  })
})

describe('setDeleteMode', () => {
  it('deletes the set when every post is yours', () => {
    expect(setDeleteMode({ total: 3, mine: 3 }, me)).toBe('set')
    expect(setDeleteMode({ total: 0, mine: 0 }, me)).toBe('set')
  })

  it('removes only your posts from a shared set', () => {
    expect(setDeleteMode({ total: 5, mine: 2 }, me)).toBe('mine')
    expect(setDeleteMode({ total: 5, mine: 0 }, me)).toBe('none')
  })

  it('lets admins delete any set', () => {
    expect(setDeleteMode({ total: 5, mine: 0 }, admin)).toBe('set')
  })
})
