// Time of day: the painted palette (split toning, tint, sun glow) and the
// light falling on the bike. Colours are display-space multipliers.
export const TIMES = [
  {
    id: 'day',
    label: 'Day',
    hindi: 'दिन',
    icon: 'sun',
    grade: { exposure: 1.05, sat: 1.1, contrast: 1.05, tint: [1, 1, 1], shadow: [0.92, 0.95, 1.1], high: [1.05, 1.02, 0.95], split: 0.45, sunPos: [0.72, 0.95], sunColor: [1, 0.95, 0.85], glow: 0.06, motes: 0.25 },
    sun: { color: '#fff4e6', intensity: 2.8, dir: [0.5, 1.4, 0.7] },
    env: 1.6,
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    hindi: 'सुनहरी शाम',
    icon: 'sunrise',
    grade: { exposure: 1.06, sat: 1.14, contrast: 1.07, tint: [1.03, 1.0, 0.95], shadow: [0.9, 0.92, 1.08], high: [1.1, 1.03, 0.9], split: 0.5, sunPos: [0.1, 0.85], sunColor: [1, 0.72, 0.42], glow: 0.13, motes: 0.75 },
    sun: { color: '#ffbf7a', intensity: 3.0, dir: [-0.9, 0.9, 0.6] },
    env: 1.4,
  },
  {
    id: 'sunset',
    label: 'Sunset',
    hindi: 'सूर्यास्त',
    icon: 'sunset',
    grade: { exposure: 0.95, sat: 1.2, contrast: 1.08, tint: [1.08, 0.88, 0.8], shadow: [0.74, 0.68, 1.15], high: [1.28, 0.92, 0.68], split: 0.95, sunPos: [0.3, 0.62], sunColor: [1, 0.48, 0.24], glow: 0.3, motes: 1 },
    sun: { color: '#ff9257', intensity: 2.3, dir: [-1, 0.6, 0.5] },
    env: 1.1,
  },
  {
    id: 'night',
    label: 'Night',
    hindi: 'रात',
    icon: 'moon',
    grade: { exposure: 0.85, sat: 0.75, contrast: 1.12, tint: [0.42, 0.5, 0.78], shadow: [0.7, 0.75, 1.1], high: [0.95, 1, 1.12], split: 0.6, sunPos: [0.8, 0.9], sunColor: [0.55, 0.65, 1], glow: 0.1, motes: 0 },
    sun: { color: '#9db2e6', intensity: 0.7, dir: [0.4, 1, 0.4] },
    env: 0.6,
  },
]

export const TIME_MAP = Object.fromEntries(TIMES.map((t) => [t.id, t]))

export const WEATHERS = [
  { id: 'clear', label: 'Sunny', hindi: 'धूप', icon: 'sun' },
  { id: 'rain', label: 'Rain', hindi: 'बारिश', icon: 'rain' },
  { id: 'fog', label: 'Mist', hindi: 'कोहरा', icon: 'fog' },
]
