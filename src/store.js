import { create } from 'zustand'

const KEY = 'desi-throttle:v2'
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
const saved = load()
const persist = (s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sceneId: s.sceneId, bikeId: s.bikeId, weather: s.weather, time: s.time, mix: s.mix }))
  } catch {
    /* storage unavailable */
  }
}

export const useStore = create((set, get) => ({
  phase: 'intro', // intro | ride
  sceneId: saved.sceneId ?? null,
  bikeId: saved.bikeId ?? 'gt650',
  weather: saved.weather ?? 'clear', // clear | rain | fog
  time: saved.time ?? 'golden', // day | golden | sunset | night
  panel: null, // scenes | bikes | music | about
  uiHidden: false,
  paused: false,
  headlight: false,
  loading: { progress: 0, label: 'Warming up' },
  sceneReady: false,
  mix: { engine: 0.55, ambience: 0.6, music: 80, ...(saved.mix ?? {}) },
  music: { index: 0, playing: false, ready: false, time: 0, duration: 0, error: null, hint: null, shuffle: false, repeat: 'all', source: 'spotify', preview: false, local: [] },

  set: (patch) => {
    set(patch)
    persist(get())
  },
  setScene: (sceneId) => {
    set({ sceneId })
    persist(get())
  },
  setBike: (bikeId) => {
    set({ bikeId })
    persist(get())
  },
  setWeather: (weather) => {
    set({ weather })
    persist(get())
  },
  setTime: (time) => {
    set({ time })
    persist(get())
  },
  setMix: (k, v) => {
    set((s) => ({ mix: { ...s.mix, [k]: v } }))
    persist(get())
  },
  setMusic: (patch) => set((s) => ({ music: { ...s.music, ...patch } })),
  openPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  closePanel: () => set({ panel: null }),
  setLoading: (patch) => set((s) => ({ loading: { ...s.loading, ...patch } })),
}))
