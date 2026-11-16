// Smoothed pointer position (−1…1) for a gentle "look around" parallax.
export const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

if (typeof window !== 'undefined') {
  const fine = window.matchMedia?.('(pointer: fine)').matches
  if (fine) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
    })
    document.addEventListener('pointerleave', () => {
      pointer.tx = 0
      pointer.ty = 0
    })
  }
  const loop = () => {
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
