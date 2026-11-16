// Paints a scene still ONCE on the GPU (anisotropic Kuwahara + ink lines) and
// returns the painted texture. The living-picture layer then animates on top
// of the painting every frame, which is far cheaper than repainting.
import * as THREE from 'three'

const frag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uBrush;
uniform float uInk;
uniform float uAmount;
uniform float uClarity;
varying vec2 vUv;
#define R 4
#define N 8
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec2 sobel(vec2 uv, vec2 t){
  float tl = lum(texture2D(tSrc, uv + t * vec2(-1.0,  1.0)).rgb);
  float tc = lum(texture2D(tSrc, uv + t * vec2( 0.0,  1.0)).rgb);
  float tr = lum(texture2D(tSrc, uv + t * vec2( 1.0,  1.0)).rgb);
  float ml = lum(texture2D(tSrc, uv + t * vec2(-1.0,  0.0)).rgb);
  float mr = lum(texture2D(tSrc, uv + t * vec2( 1.0,  0.0)).rgb);
  float bl = lum(texture2D(tSrc, uv + t * vec2(-1.0, -1.0)).rgb);
  float bc = lum(texture2D(tSrc, uv + t * vec2( 0.0, -1.0)).rgb);
  float br = lum(texture2D(tSrc, uv + t * vec2( 1.0, -1.0)).rgb);
  return vec2((tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl), (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br));
}
void main(){
  vec2 uv = vUv;
  // structure tensor, smoothed over a small neighbourhood
  vec2 ts = uTexel * max(1.0, uBrush * 0.4);
  vec3 st = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = sobel(uv + vec2(float(i), float(j)) * ts * 1.5, ts);
      st += vec3(g.x * g.x, g.y * g.y, g.x * g.y);
    }
  }
  st /= 9.0;
  float E = st.x, G = st.y, F = st.z;
  float disc = sqrt((E - G) * (E - G) + 4.0 * F * F);
  float l1 = 0.5 * (E + G + disc), l2 = 0.5 * (E + G - disc);
  vec2 tdir = vec2(l1 - E, -F);
  tdir = dot(tdir, tdir) > 1e-10 ? normalize(tdir) : vec2(0.0, 1.0);
  float A = (l1 + l2) > 1e-8 ? (l1 - l2) / (l1 + l2) : 0.0;
  float sa = clamp(1.0 + A, 0.5, 2.2);
  float sb = clamp(1.0 / (1.0 + A), 0.45, 2.0);
  mat2 rot = mat2(tdir.x, tdir.y, -tdir.y, tdir.x);

  vec2 px = uTexel * uBrush / float(R);
  vec3 m[N]; vec3 s[N]; float w[N];
  for (int k = 0; k < N; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); w[k] = 0.0; }
  float sig = float(R) * 0.55;
  for (int j = -R; j <= R; j++) {
    for (int i = -R; i <= R; i++) {
      vec2 d = vec2(float(i), float(j));
      float r2 = dot(d, d);
      if (r2 > float(R * R) + 0.5) continue;
      vec3 c = texture2D(tSrc, uv + rot * vec2(d.x * sa, d.y * sb) * px).rgb;
      float gk = exp(-r2 / (2.0 * sig * sig));
      vec2 nd = r2 > 0.0 ? d / sqrt(r2) : vec2(0.0);
      for (int k = 0; k < N; k++) {
        float a = 6.2831853 * float(k) / float(N);
        float t = dot(nd, vec2(cos(a), sin(a)));
        float wk = r2 > 0.0 ? gk * pow(max(0.0, t + 0.35), 2.0) : gk * 0.25;
        m[k] += c * wk; s[k] += c * c * wk; w[k] += wk;
      }
    }
  }
  float sv[N]; float minS = 1e9;
  for (int k = 0; k < N; k++) {
    vec3 mk = m[k] / w[k];
    vec3 vk = abs(s[k] / w[k] - mk * mk);
    sv[k] = vk.r + vk.g + vk.b;
    minS = min(minS, sv[k]);
  }
  vec3 acc = vec3(0.0); float sum = 0.0;
  for (int k = 0; k < N; k++) {
    float alpha = pow((minS + 2e-4) / (sv[k] + 2e-4), 3.0);
    acc += (m[k] / w[k]) * alpha; sum += alpha;
  }
  vec3 col = acc / max(sum, 1e-5);
  // ink: darken strong edges a little
  float gm = length(sobel(uv, uTexel)) / (0.25 + lum(col));
  col *= 1.0 - smoothstep(0.6, 2.2, gm) * uInk;

  // keep most of the real photo: a light painted finish, plus crisp micro-detail
  vec3 src = texture2D(tSrc, uv).rgb;
  vec3 blur = (src * 2.0 + texture2D(tSrc, uv + uTexel * vec2(2.0, 0.0)).rgb + texture2D(tSrc, uv - uTexel * vec2(2.0, 0.0)).rgb
             + texture2D(tSrc, uv + uTexel * vec2(0.0, 2.0)).rgb + texture2D(tSrc, uv - uTexel * vec2(0.0, 2.0)).rgb) / 6.0;
  col = mix(src, col, uAmount);
  col += (src - blur) * uClarity;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const cache = new Map()

/** brush is in pixels of a 1080-px-tall image (scaled to the image's size). */
export function prepaint(renderer, texture, { brush = 2.6, ink = 0.1, amount = 0.5, clarity = 0.7 } = {}) {
  if (cache.has(texture.uuid)) return cache.get(texture.uuid)
  const img = texture.image
  const w = img.width, h = img.height
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false })
  const mat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: texture }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uBrush: { value: brush * (h / 1080) }, uInk: { value: ink }, uAmount: { value: amount }, uClarity: { value: clarity } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(rt)
  renderer.render(scene, cam)
  renderer.setRenderTarget(prev)
  mat.dispose()
  quad.geometry.dispose()
  cache.set(texture.uuid, rt.texture)
  return rt.texture
}
