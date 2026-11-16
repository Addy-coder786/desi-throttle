// Your own song files, for full-length playback. Added in the site
// (Playlist → "Add song files"), kept in this browser (IndexedDB) and never
// uploaded anywhere.
import { PLAYLIST } from '../data/playlist'

const DB = 'desi-throttle-music'
const STORE = 'songs'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

const urls = new Map() // track n → object/static URL

export const library = {
  has: (n) => urls.has(n),
  url: (n) => urls.get(n) ?? null,
  ids: () => [...urls.keys()],

  async load() {
    // files added in the browser
    try {
      const db = await open()
      await new Promise((resolve) => {
        const t = db.transaction(STORE, 'readonly')
        const req = t.objectStore(STORE).openCursor()
        req.onsuccess = () => {
          const cur = req.result
          if (!cur) return resolve()
          urls.set(Number(cur.key), URL.createObjectURL(cur.value))
          cur.continue()
        }
        req.onerror = () => resolve()
      })
    } catch {
      /* storage unavailable (private mode): fine */
    }
    return this.ids()
  },

  async add(n, file) {
    try {
      await tx('readwrite', (s) => s.put(file, n))
    } catch {
      /* not persisted, still usable this session */
    }
    const old = urls.get(n)
    if (old?.startsWith('blob:')) URL.revokeObjectURL(old)
    urls.set(n, URL.createObjectURL(file))
  },

  async remove(n) {
    try {
      await tx('readwrite', (s) => s.delete(n))
    } catch {
      /* ignore */
    }
    const old = urls.get(n)
    if (old?.startsWith('blob:')) URL.revokeObjectURL(old)
    urls.delete(n)
  },

  /** Match a file name like "02 - Zinda (Bhaag Milkha Bhaag).mp3" to a playlist track. */
  match(fileName) {
    const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
    const name = norm(fileName.replace(/\.[^.]+$/, ''))
    const words = new Set(name.split(' '))
    let best = null
    let bestScore = 0
    for (const t of PLAYLIST) {
      const titles = [t.title, ...(t.aliases ?? [])].map(norm)
      for (const title of titles) {
        let score = 0
        if (name.includes(title)) score = 10 + title.length
        else {
          const tw = title.split(' ')
          const hit = tw.filter((w) => w.length > 2 && words.has(w)).length
          score = hit / tw.length >= 0.6 ? hit : 0
        }
        if (score > bestScore) {
          bestScore = score
          best = t
        }
      }
    }
    // a leading track number like "07" also counts if nothing else matched
    if (!best) {
      const num = Number((name.match(/^(\d{1,2})\b/) || [])[1])
      best = PLAYLIST.find((t) => t.n === num) ?? null
    }
    return best
  },
}
