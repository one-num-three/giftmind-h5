/**
 * 挑礼项目 / 方案库 / 对话记录 —— 后端持久化接口
 * 后端挂 /api/h5/projects 与 /api/h5/plans 前缀（request.js 已含 /api/h5 base），
 * 返回体是 {project: ...} / {projects: [...]} 这类包装，这里统一拆包成资源本身。
 * 所有方法失败时抛 ApiError，调用方自行决定兜底（store 层回退 localStorage）。
 */
import { http } from './request'

const unwrap = (res, key) => (res && typeof res === 'object' ? res[key] ?? null : null)

export const projectsApi = {
  list: () => http.get('/projects').then((res) => unwrap(res, 'projects') || []),
  create: ({ title, mode } = {}) => http.post('/projects', { title, mode }).then((res) => unwrap(res, 'project')),
  get: (id) => http.get(`/projects/${id}`).then((res) => unwrap(res, 'project')),
  patch: (id, payload) => http.patch(`/projects/${id}`, payload).then((res) => unwrap(res, 'project')),
  remove: (id) => http.del(`/projects/${id}`),
  appendMessage: (id, payload) => http.post(`/projects/${id}/messages`, payload).then((res) => unwrap(res, 'message')),
  savePlan: (id, payload) => http.post(`/projects/${id}/plans`, payload).then((res) => unwrap(res, 'plan')),
}

export const plansApi = {
  list: () => http.get('/plans').then((res) => unwrap(res, 'plans') || []),
  get: (id) => http.get(`/plans/${id}`).then((res) => unwrap(res, 'plan')),
  update: (id, payload) => http.patch(`/plans/${id}`, payload).then((res) => unwrap(res, 'plan')),
  remove: (id) => http.del(`/plans/${id}`),
}
