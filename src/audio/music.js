// Road-trip music, two sources per song:
//   • your own file (see library.js) → full song, played here directly
//   • Spotify's official embedded player → full song when the visitor is
//     logged into Spotify in this browser, a 30-second preview otherwise
import { PLAYLIST } from '../data/playlist'
import { useStore } from '../store'
import { library } from './library'

let apiPromise = null
function loadAPI() {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    if (window.__spotifyIFrameAPI) return resolve(window.__spotifyIFrameAPI)
    window.onSpotifyIframeApiReady = (api) => {
      window.__spotifyIFrameAPI = api
      resolve(api)
    }
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    s.async = true
    s.onerror = () => reject(new Error('Spotify could not be reached'))
    document.head.appendChild(s)
  })
  return apiPromise
}

const S = () => useStore.getState()
const set = (p) => S().setMusic(p)
const uri = (i) => `spotify:track:${PLAYLIST[i].spotify}`
const PREVIEW_MAX_MS = 31500 // Spotify previews are ~30 s long

class Music {
  ctrl = null
  host = null
  wantPlay = false
  lastPos = 0
  hintTimer = null
  audio = null
  source = 'spotify' // 'spotify' | 'file' for the current song

  async init() {
    await library.load()
    set({ local: library.ids() })
    this.applySource(S().music.index, false)
  }

  // ------------------------------------------------------------ own files
  ensureAudio() {
    if (this.audio) return this.audio
    const a = new Audio()
    a.preload = 'auto'
    a.addEventListener('timeupdate', () => this.source === 'file' && set({ time: a.currentTime, duration: a.duration || 0 }))
    a.addEventListener('play', () => this.source === 'file' && set({ playing: true, hint: null }))
    a.addEventListener('pause', () => this.source === 'file' && set({ playing: false }))
    a.addEventListener('ended', () => this.source === 'file' && this.ended())
    a.addEventListener('error', () => this.source === 'file' && set({ playing: false, error: 'This song file could not be played.' }))
    a.volume = (S().mix.music ?? 80) / 100
    this.audio = a
    this.mediaSession()
    return a
  }

  volume(v) {
    if (this.audio) this.audio.volume = v / 100
  }

  mediaSession() {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => this.play())
    ms.setActionHandler('pause', () => this.pause())
    ms.setActionHandler('nexttrack', () => this.next())
    ms.setActionHandler('previoustrack', () => this.prev())
  }

  updateMediaMeta(i) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return
    const t = PLAYLIST[i]
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artists, album: t.film, artwork: [{ src: t.art, sizes: '300x300', type: 'image/jpeg' }] })
  }

  /** Decide where song i plays from, and load it there. */
  applySource(i, autoplay) {
    const file = library.url(PLAYLIST[i].n)
    if (file) {
      this.source = 'file'
      this.ctrl?.pause()
      const a = this.ensureAudio()
      if (a.src !== new URL(file, location.href).href) a.src = file
      a.currentTime = 0
      set({ source: 'file', preview: false, ready: true, time: 0, duration: a.duration || 0 })
      this.updateMediaMeta(i)
      if (autoplay) a.play().catch(() => set({ hint: 'Press play to start the music.' }))
    } else {
      this.source = 'spotify'
      this.audio?.pause()
      set({ source: 'spotify' })
      if (this.ctrl) {
        this.ctrl.loadUri(uri(i))
        if (autoplay) this.play()
      }
    }
  }

  // ------------------------------------------------------------ Spotify
  async mount(el, force = false) {
    if (!force && this.host === el && this.ctrl) return
    this.host = el
    try {
      const api = await loadAPI()
      if (this.ctrl) {
        try {
          this.ctrl.destroy()
        } catch {
          /* already gone */
        }
        this.ctrl = null
      }
      const mountPoint = document.createElement('div')
      el.innerHTML = ''
      el.appendChild(mountPoint)
      api.createController(mountPoint, { uri: uri(S().music.index), width: '100%', height: 80 }, (ctrl) => {
        this.ctrl = ctrl
        ctrl.addListener('ready', () => {
          if (this.source === 'spotify') set({ ready: true, error: null })
          if (this.wantPlay && this.source === 'spotify') this.play()
        })
        ctrl.addListener('playback_update', (e) => this.onUpdate(e.data))
      })
    } catch {
      set({ error: 'Spotify could not be reached. Check your connection.' })
    }
  }

  onUpdate({ isPaused, isBuffering, duration, position }) {
    if (this.source !== 'spotify') return
    const playing = !isPaused && !isBuffering
    if (playing) {
      clearTimeout(this.hintTimer)
      set({ hint: null })
    }
    if (duration > 0) set({ preview: duration <= PREVIEW_MAX_MS })
    // a track that stops right at its end has finished: move on
    if (isPaused && duration > 0 && this.lastPos > duration - 1500 && this.wasPlaying) {
      this.wasPlaying = false
      this.lastPos = 0
      this.ended()
      return
    }
    this.wasPlaying = playing || (this.wasPlaying && isBuffering)
    this.lastPos = position
    set({ playing: !isPaused, time: position / 1000, duration: duration / 1000 })
  }

  /** Open Spotify's login; when the window closes, reload the player so full songs play. */
  login() {
    const w = 480, h = 720
    const left = window.screenX + (window.outerWidth - w) / 2
    const top = window.screenY + (window.outerHeight - h) / 2
    const popup = window.open('https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F', 'spotify-login', `width=${w},height=${h},left=${left},top=${top}`)
    if (!popup) {
      window.open('https://accounts.spotify.com/login', '_blank', 'noopener')
      return
    }
    const timer = setInterval(() => {
      if (!popup.closed) return
      clearInterval(timer)
      set({ ready: false })
      this.wantPlay = true
      if (this.host) this.mount(this.host, true)
    }, 600)
  }

  // ------------------------------------------------------------ controls
  play() {
    this.wantPlay = true
    if (this.source === 'file') {
      this.ensureAudio()
        .play()
        .catch(() => set({ hint: 'Press play to start the music.' }))
      return
    }
    if (!this.ctrl) return
    this.ctrl.play()
    // browsers may require one tap inside the Spotify player for the first play
    clearTimeout(this.hintTimer)
    this.hintTimer = setTimeout(() => {
      if (!S().music.playing) set({ hint: 'Tap ▶ on the Spotify player to start the music.' })
    }, 3000)
  }
  pause() {
    this.wantPlay = false
    if (this.source === 'file') this.audio?.pause()
    else this.ctrl?.pause()
  }
  toggle() {
    if (S().music.playing) this.pause()
    else this.play()
  }
  select(i) {
    set({ index: i, time: 0, duration: 0, error: null, preview: false })
    this.lastPos = 0
    this.wasPlaying = false
    this.wantPlay = true
    this.applySource(i, true)
  }
  next() {
    const { index, shuffle } = S().music
    let i = index + 1
    if (shuffle && PLAYLIST.length > 1) {
      i = index
      while (i === index) i = Math.floor(Math.random() * PLAYLIST.length)
    }
    this.select(i % PLAYLIST.length)
  }
  prev() {
    if (S().music.time > 5) return this.seek(0)
    this.select((S().music.index - 1 + PLAYLIST.length) % PLAYLIST.length)
  }
  ended() {
    const { repeat, index, shuffle } = S().music
    if (repeat === 'one') return this.select(index)
    if (repeat === 'off' && index === PLAYLIST.length - 1 && !shuffle) return set({ playing: false })
    this.next()
  }
  seek(frac) {
    const d = S().music.duration
    if (!d) return
    if (this.source === 'file') {
      if (this.audio) this.audio.currentTime = frac * d
    } else this.ctrl?.seek(frac * d)
  }

  // ------------------------------------------------------------ your files
  /** Attach a file to a specific song. */
  async attach(n, file) {
    await library.add(n, file)
    set({ local: library.ids() })
    if (PLAYLIST[S().music.index].n === n) this.applySource(S().music.index, S().music.playing)
  }

  /** Add several files at once, matched to songs by name. Returns { added, unmatched }. */
  async addFiles(files) {
    const added = []
    const unmatched = []
    for (const f of files) {
      if (!f.type.startsWith('audio') && !/\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(f.name)) continue
      const t = library.match(f.name)
      if (t) {
        await library.add(t.n, f)
        added.push(t.title)
      } else unmatched.push(f.name)
    }
    set({ local: library.ids() })
    this.applySource(S().music.index, S().music.playing)
    return { added, unmatched }
  }

  async detach(n) {
    await library.remove(n)
    set({ local: library.ids() })
    if (PLAYLIST[S().music.index].n === n) this.applySource(S().music.index, false)
  }
}

export const music = new Music()
