// Small handle so UI code can grab a frame of the 3D view (photo button).
export const stage = {
  canvas: null,
  pending: null,
  capture(cb) {
    this.pending = cb
  },
}
