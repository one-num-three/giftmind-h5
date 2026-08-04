import { afterEach, describe, expect, it, vi } from 'vitest'

import { request } from '../src/api/request'


afterEach(() => vi.unstubAllGlobals())

describe('API error contract', () => {
  it('preserves FastAPI structured detail codes and messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      detail: { code: 'NO_CANDIDATES', message: '没有满足硬约束的礼物' },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })))

    await expect(request('/plans/generate', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'NO_CANDIDATES',
      message: '没有满足硬约束的礼物',
      status: 409,
    })
  })
})
