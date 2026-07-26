/**
 * 极简 fetch 封装：统一 baseURL / 超时 / 错误结构 / 鉴权头
 * 依赖为 0，替换成 axios 只需改这一个文件。
 */

import storage from '@/utils/storage'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT || 20000)

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

function authHeaders() {
  const token = storage.get('gm_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function request(path, { method = 'GET', body, headers, signal, timeout = TIMEOUT } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => controller.abort())

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const text = await res.text()
    const data = text ? safeParse(text) : null

    if (!res.ok) {
      throw new ApiError(data?.message || `请求失败 (${res.status})`, {
        status: res.status,
        code: data?.code || 'HTTP_ERROR',
        payload: data,
      })
    }
    // 约定后端返回 { code, message, data }
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0) {
      throw new ApiError(data.message || '业务处理失败', { code: data.code, payload: data })
    }
    return data && typeof data === 'object' && 'data' in data ? data.data : data
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('请求超时，请重试', { code: 'TIMEOUT' })
    if (err instanceof ApiError) throw err
    throw new ApiError(err.message || '网络异常', { code: 'NETWORK' })
  } finally {
    clearTimeout(timer)
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * SSE 流式读取（AI 逐字返回）
 * 后端约定：text/event-stream，每帧 `data: {"delta":"..."}`，结束帧 `data: [DONE]`
 */
export async function streamSSE(path, { body, onDelta, onDone, signal } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new ApiError('流式连接失败', { status: res.status, code: 'SSE' })

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() || ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') {
        onDone?.(full)
        return full
      }
      try {
        const json = JSON.parse(payload)
        const delta = json.delta ?? json.content ?? ''
        if (delta) {
          full += delta
          onDelta?.(delta, full)
        }
      } catch {
        /* 忽略心跳帧 */
      }
    }
  }
  onDone?.(full)
  return full
}

export const http = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
}
