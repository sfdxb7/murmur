import { beforeEach, describe, expect, it, vi } from 'vitest'

const copyText = vi.fn()
vi.mock('./use-copy', () => ({ copyText: (...args: unknown[]) => copyText(...args) }))

const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
vi.mock('sonner', () => ({ toast }))

const { clipboardText, copyMessage } = await import('./copy-message')

describe('clipboardText', () => {
  it('keeps the markdown and drops file tags', () => {
    expect(clipboardText(['See [the docs](https://example.com/guide).\nMEDIA:/opt/data/shot.png'])).toBe(
      'See [the docs](https://example.com/guide).',
    )
  })

  it('keeps a code fence, and joins the parts of a reply', () => {
    const code = '```ts\nconst n = 1\n```'
    expect(clipboardText([code, 'Done.'])).toBe(`${code}\n\nDone.`)
  })

  it('is empty when a reply is only a file', () => {
    expect(clipboardText(['MEDIA:/opt/data/shot.png'])).toBe('')
  })
})

describe('copyMessage', () => {
  beforeEach(() => {
    copyText.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  it('says it was copied', async () => {
    copyText.mockResolvedValueOnce(true)
    await expect(copyMessage('Hello')).resolves.toBe(true)
    expect(copyText).toHaveBeenCalledWith('Hello')
    expect(toast.success).toHaveBeenCalledWith('Copied', { duration: 1600 })
  })

  it('says when the clipboard refuses', async () => {
    copyText.mockResolvedValueOnce(false)
    await expect(copyMessage('Hello')).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Couldn’t copy that.')
  })

  it('does nothing with nothing', async () => {
    await expect(copyMessage('')).resolves.toBe(false)
    expect(copyText).not.toHaveBeenCalled()
  })
})
