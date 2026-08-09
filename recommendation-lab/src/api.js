async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.detail || payload?.message || `请求失败（${response.status}）`
    throw new Error(typeof message === 'string' ? message : '服务器暂时无法完成请求')
  }
  return payload
}

export function evaluateRecommendations(requestId, answers) {
  return postJson('/api/h5/recommendation-lab/evaluate', { requestId, answers })
}

export function submitRecommendationFeedback(body) {
  return postJson('/api/h5/recommendation-lab/feedback', body)
}
