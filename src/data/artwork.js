// Your own painted artwork (optional). Every scene already has a painted look
// generated from a real photo; artwork registered here replaces it.
//
// 1. Put the image in public/art/ (landscape, 16:9, at least 1920×1080, no UI in it).
// 2. Register it below:
//      'ladakh-pangong': '/art/ladakh-pangong.jpg'
//          → scenery only; the 3D bike is drawn on top (works for every bike)
//      'ladakh-pangong/gt650': '/art/ladakh-pangong-gt650.jpg'
//          → a complete frame that already shows that bike's cockpit; the 3D
//            bike is hidden for this scene+bike combination
//
// Scene ids: ladakh-pangong, ladakh-leh, ladakh-nubra, spiti, manali-keylong,
//            rohtang-mist, chikmagalur
// Bike ids:  gt650, panigale, triple, classic350, himalayan, duke390

export const ARTWORK = {
  // 'ladakh-pangong': '/art/ladakh-pangong.jpg',
  // 'ladakh-pangong/triple': '/art/ladakh-pangong-triple.jpg',
}

export function artworkFor(sceneId, bikeId) {
  const full = ARTWORK[`${sceneId}/${bikeId}`]
  if (full) return { src: full, full: true }
  const scenery = ARTWORK[sceneId]
  if (scenery) return { src: scenery, full: false }
  return null
}
