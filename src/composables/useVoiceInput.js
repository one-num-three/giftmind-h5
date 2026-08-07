/**
 * 录音 → 转写 → 文本 的最小语音输入链路。
 *
 * 只负责「拿到一段文字」，之后交给现有对话管道，不侵入任何状态机：
 * 未来升级为整轮语音对话时，替换这里的 transcribe 调用即可。
 */
import { ref } from 'vue'
import api from '@/api'

const MAX_SECONDS = 120
const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

export function useVoiceInput() {
  const recording = ref(false)
  const transcribing = ref(false)
  const seconds = ref(0)
  const supported =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator?.mediaDevices?.getUserMedia === 'function'

  let mediaRecorder = null
  let chunks = []
  let timer = 0
  let pending = null

  function pickMime() {
    for (const mime of MIME_PREFERENCE) {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mime)) {
        return mime
      }
    }
    return 'audio/webm'
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer)
      timer = 0
    }
  }

  async function start() {
    if (!supported || recording.value || transcribing.value) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (recording.value) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const mimeType = pickMime()
      mediaRecorder = new MediaRecorder(stream, { mimeType })
      chunks = []
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) chunks.push(event.data)
      })
      mediaRecorder.addEventListener('stop', handleStop, { once: true })
      mediaRecorder.start()
      recording.value = true
      seconds.value = 0
      timer = setInterval(() => {
        seconds.value += 1
        if (seconds.value >= MAX_SECONDS) {
          stop().catch(() => {})
        }
      }, 1000)
    } catch {
      recording.value = false
      throw new Error('无法使用麦克风，请检查浏览器权限')
    }
  }

  function stop() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return Promise.resolve('')
    const result = new Promise((resolve, reject) => {
      pending = { resolve, reject }
    })
    mediaRecorder.stream?.getTracks().forEach((track) => track.stop())
    mediaRecorder.stop()
    return result
  }

  async function handleStop() {
    recording.value = false
    clearTimer()
    const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
    chunks = []
    if (!blob.size) {
      pending?.resolve('')
      pending = null
      return
    }
    transcribing.value = true
    try {
      const format = formatOf(blob.type)
      const result = await api.transcribeVoice(blob, format)
      pending?.resolve(result?.transcript || '')
    } catch (error) {
      pending?.reject(error)
    } finally {
      pending = null
      transcribing.value = false
    }
  }

  function cancel() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stream?.getTracks().forEach((track) => track.stop())
      mediaRecorder.stop()
    }
    pending = null
    recording.value = false
    transcribing.value = false
    seconds.value = 0
    chunks = []
    clearTimer()
  }

  return { recording, transcribing, seconds, supported, start, stop, cancel }
}

function formatOf(mimeType) {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mpeg')) return 'mp3'
  return 'webm'
}
