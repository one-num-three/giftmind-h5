class MemoryStorage {
  constructor() { this.data = new Map() }
  getItem(key) { return this.data.has(String(key)) ? this.data.get(String(key)) : null }
  setItem(key, value) { this.data.set(String(key), String(value)) }
  removeItem(key) { this.data.delete(String(key)) }
  clear() { this.data.clear() }
}
const localStorage = new MemoryStorage()
globalThis.window = { localStorage }
globalThis.localStorage = localStorage
globalThis.location = { origin: 'http://127.0.0.1:4174', pathname: '/' }
