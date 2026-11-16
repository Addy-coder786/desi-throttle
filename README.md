# देसी THROTTLE

> *Raaste Apne, Andaaz Apna.*

**🏍️ Ride it live: [desi-throttle.vercel.app](https://desi-throttle.vercel.app/)**

A fun little side project: a first-person motorcycle ride through painted Indian roads, from Pangong Tso and Spiti to the Chikmagalur ghats, with a road-trip playlist playing.

Pick from six bikes (Royal Enfield Classic 350, Himalayan 450 and Continental GT 650, KTM 390 Duke, Ducati Panigale V4, Triumph Street Triple), change the weather and time of day, and ride.

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` | Throttle / brake |
| `A` / `D` | Lean left / right |
| `R` | Rev the engine |
| `B` | Next bike |
| `← →` | Change scene |
| `T` | Time of day |
| `Space` / `N` | Play/pause music, next song |
| `H` / `F` | Hide controls, fullscreen |

## Run locally

```bash
npm install
npm run dev
```

## Tech stack

| Area | Tools |
| --- | --- |
| UI | [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), [Lucide](https://lucide.dev) icons |
| 3D & graphics | [Three.js](https://threejs.org), [React Three Fiber](https://r3f.docs.pmnd.rs), [Drei](https://drei.docs.pmnd.rs), [postprocessing](https://github.com/pmndrs/postprocessing), custom GLSL shaders |
| Animation | [GSAP](https://gsap.com) |
| State | [Zustand](https://zustand.docs.pmnd.rs) |
| Audio | Web Audio API (engine and ambience mixing), [Spotify iFrame API](https://developer.spotify.com/documentation/embeds) for music |
| Build & hosting | [Vite](https://vite.dev), [Vercel](https://vercel.com) |

## Credits

Scene footage, bike photos, engine recordings and textures are free-licensed (Pexels, Wikimedia Commons, Freesound, Pixabay, Poly Haven); every author is credited on the site's **About** panel. Music is streamed through the official Spotify embed, and all rights stay with the labels.

Unofficial fan project. Royal Enfield, KTM, Ducati and Triumph are trademarks of their owners.
