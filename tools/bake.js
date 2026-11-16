// Bakes the painted look into the scene images, so the site never has to run
// the (slow to compile) paint filter in the visitor's browser.
// Source photos live in tools/photos/<scene-id>.jpg; results go to public/scenes/<scene-id>.jpg.
import * as THREE from 'three'
import { SCENES } from '../src/data/scenes'
import { prepaint } from './prepaint'

const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true })
const loader = new THREE.TextureLoader()

async function bake(scene) {
  const tex = await loader.loadAsync(`/tools/photos/${scene.id}.jpg`)
  const { width: w, height: h } = tex.image
  const rt = prepaint(renderer, tex)
  const px = new Uint8Array(w * h * 4)
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, px)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const img = canvas.getContext('2d').createImageData(w, h)
  // render targets are stored bottom-up
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
  canvas.getContext('2d').putImageData(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.86)
}

window.bakeAll = async () => {
  const out = {}
  for (const s of SCENES) out[s.id] = await bake(s)
  return out
}

const list = document.getElementById('out')
window.bakeAll().then((all) => {
  for (const [id, url] of Object.entries(all)) {
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}.jpg`
    a.textContent = `${id}.jpg`
    a.style.display = 'block'
    list.append(a)
  }
  window.baked = all
})
