import { SCENES } from './scenes'
import { BIKES } from './bikes'
import { PLAYLIST } from './playlist'
import { SOUND_CREDITS } from './soundCredits'

export const CREDITS = [
  {
    group: 'Road scenes (painted from stills of this footage)',
    items: SCENES.map((s) => ({ text: `${s.name} (${s.place}): ${s.credit.creator}, ${s.credit.licence}`, href: s.credit.source })),
  },
  {
    group: 'Engine & ambience recordings',
    items: SOUND_CREDITS.map((c) => ({ text: `${c.title}: ${c.author}, ${c.licence}`, href: c.source })),
  },
  {
    group: 'Music',
    items: [
      { text: `${PLAYLIST.length} songs from the original soundtrack albums, played through Spotify’s official embedded player. All rights belong to their owners.`, href: 'https://open.spotify.com' },
    ],
  },
  {
    group: 'Bike photos',
    items: BIKES.filter((b) => b.photo).map((b) => ({ text: `${b.maker} ${b.name}: ${b.photo.credit}`, href: b.photo.href })),
  },
  {
    group: 'Lighting & materials',
    items: [{ text: 'Leather and rubber textures from Poly Haven (CC0)', href: 'https://polyhaven.com' }],
  },
  {
    group: 'Trademarks',
    items: [{ text: 'Royal Enfield, Ducati and Triumph are trademarks of their owners. This is an unofficial fan project, and specs are approximate.' }],
  },
]
