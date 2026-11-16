// Full-screen real-footage backdrop: two video slots with crossfade,
// per-scene grading, rain-on-visor refraction, fog, sway, grain.
import * as THREE from 'three'

export const backdrop = {
  uniforms: {
    uA: { value: null },
    uB: { value: null },
    uMix: { value: 0 },
    uCropA: { value: new THREE.Vector4(1, 1, 0, 0) },
    uCropB: { value: new THREE.Vector4(1, 1, 0, 0) },
    uGradeA: { value: new THREE.Vector4(1, 1, 1, 0) }, // exposure, contrast, saturation, warmth
    uGradeB: { value: new THREE.Vector4(1, 1, 1, 0) },
    uTime: { value: 0 },
    uRain: { value: 0 },
    uFog: { value: 0 },
    uFogColor: { value: new THREE.Color('#c9ccce') },
    uSway: { value: new THREE.Vector3(0, 0, 0) }, // x, y offset, roll
    uZoom: { value: 1 }, // >1 crops in, so a rolled (leaning) frame still fills the screen
    uRes: { value: new THREE.Vector2(1600, 900) },
    uFade: { value: 0 }, // fade-to-black for intro
    uHead: { value: 0 }, // headlight on the road
    uLinear: { value: 0 }, // 1 when rendering into the painterly post-process chain
    uBirds: { value: 0 },
    uSkyA: { value: new THREE.Vector4(2, 2, 0.5, 0) },
    uSkyB: { value: new THREE.Vector4(2, 2, 0.5, 0) },
    uFxA: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFxB: { value: new THREE.Vector4(0, 0, 0, 0) },
  },
  slots: [null, null], // { video, texture, scene }
}

const NOISE = /* glsl */ `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5;} return s; }
`

// Scene sampling + the "living picture" layer. Per slot:
//   uSky = (skyLo, skyHi, horizonY, cloudSpeed)  in image space (y up); skyLo > 1 = no sky
//   uFx  = (cloudShadows, heatHaze, waterShimmer, mistDrift)
const SAMPLE = /* glsl */ `
${NOISE}
uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform float uTime;
uniform vec4 uCropA; uniform vec4 uCropB; uniform vec4 uGradeA; uniform vec4 uGradeB;
uniform vec4 uSkyA; uniform vec4 uSkyB; uniform vec4 uFxA; uniform vec4 uFxB;
vec3 grade(vec3 c, vec4 g){
  c *= g.x;
  c = (c - 0.5) * g.y + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, g.z);
  c += vec3(0.06, 0.015, -0.05) * g.w;
  return clamp(c, 0.0, 1.0);
}
float skyness(vec3 c, float pos){
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return pos * max(smoothstep(0.02, 0.12, c.b - c.r), smoothstep(0.5, 0.72, l));
}
vec3 liveTex(sampler2D tex, vec2 iuv, vec4 sky, vec4 fx){
  float t = uTime;
  // heat haze shimmering over the far road
  if (fx.y > 0.0) {
    float band = exp(-pow((iuv.y - sky.z) / 0.03, 2.0)) * smoothstep(0.32, 0.1, abs(iuv.x - 0.5));
    iuv += vec2(sin(iuv.y * 900.0 + t * 5.0) * 0.0008, sin(iuv.x * 320.0 + t * 3.0) * 0.0003) * band * fx.y;
  }
  vec3 c = texture2D(tex, iuv).rgb;
  // clouds slowly drifting and billowing (flow-map crossfade, never seams)
  if (sky.x < 1.0) {
    float pos = smoothstep(sky.x, sky.y, iuv.y);
    float m = skyness(c, pos);
    if (m > 0.001) {
      float n = vn(iuv * 5.0) * 0.4;
      float ph = t * sky.w;
      float p0 = fract(ph + n), p1 = fract(ph + n + 0.5);
      float w = abs(p0 - 0.5) * 2.0;
      vec2 bil = (vec2(vn(iuv * vec2(5.0, 9.0) + t * 0.03), vn(iuv * vec2(5.0, 9.0) - t * 0.025 + 7.0)) - 0.5) * 0.0025;
      vec2 u0 = iuv - vec2(p0 * 0.018, 0.0) + bil, u1 = iuv - vec2(p1 * 0.018, 0.0) + bil;
      u0.x = max(u0.x, 0.002); u1.x = max(u1.x, 0.002);
      vec3 c0 = texture2D(tex, u0).rgb, c1 = texture2D(tex, u1).rgb;
      // only accept samples that are themselves sky (no mountain smears)
      c0 = mix(c, c0, skyness(c0, smoothstep(sky.x, sky.y, u0.y)));
      c1 = mix(c, c1, skyness(c1, smoothstep(sky.x, sky.y, u1.y)));
      c = mix(c, mix(c0, c1, w), m);
    }
  }
  // water: ripples and sun glints
  if (fx.z > 0.0) {
    float below = 1.0 - smoothstep(sky.z + 0.015, sky.z + 0.05, iuv.y);   // water lies at/below the horizon
    float wm = smoothstep(0.04, 0.13, c.b - max(c.r, c.g)) * below;
    if (wm > 0.01) {
      vec2 r = vec2(sin(iuv.y * 720.0 + t * 1.7) * 0.0012 + sin(iuv.y * 260.0 - t * 1.1) * 0.0008, 0.0);
      vec3 cw = texture2D(tex, iuv + r).rgb;
      float glint = pow(vn(vec2(iuv.x * 260.0 + t * 0.8, iuv.y * 1300.0 - t * 0.3)), 22.0) * 2.2;
      c = mix(c, cw + glint * vec3(1.0, 0.96, 0.88), wm * fx.z);
    }
  }
  // cloud shadows sliding over the land
  if (fx.x > 0.0) {
    float land = 1.0 - smoothstep(min(sky.x, 1.0) - 0.04, min(sky.x, 1.0) + 0.02, iuv.y);
    float depth = 1.0 + smoothstep(0.2, 0.6, iuv.y) * 3.0;
    float s = fbm(vec2(iuv.x * 2.0 - t * 0.012, iuv.y * 2.5 * depth + t * 0.003));
    c *= 1.0 - smoothstep(0.52, 0.7, s) * land * fx.x;
  }
  // mist wisps drifting through
  if (fx.w > 0.0) {
    float wisp = fbm(vec2(iuv.x * 2.2 - t * 0.035, iuv.y * 3.5 + t * 0.006));
    c = mix(c, vec3(0.86, 0.88, 0.9), smoothstep(0.45, 0.8, wisp) * fx.w * smoothstep(0.08, 0.5, iuv.y));
  }
  return c;
}
vec3 sceneAt(vec2 uv){
  vec3 a = grade(liveTex(uA, uv * uCropA.xy + uCropA.zw, uSkyA, uFxA), uGradeA);
  if (uMix <= 0.001) return a;
  vec3 b = grade(liveTex(uB, uv * uCropB.xy + uCropB.zw, uSkyB, uFxB), uGradeB);
  return mix(a, b, uMix);
}
`

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`

const FRAG = /* glsl */ `
${SAMPLE}
uniform float uRain; uniform float uFog; uniform vec3 uFogColor;
uniform vec3 uSway; uniform float uZoom; uniform vec2 uRes; uniform float uFade; uniform float uLinear; uniform float uHead;
uniform float uBirds;
varying vec2 vUv;

// a gull-like silhouette, wings flapping (p in bird units, x in -1..1)
float bird(vec2 p, float flap){
  float ax = abs(p.x);
  if (ax > 1.0) return 0.0;
  float yc = flap * 0.6 * ax * (1.5 - ax);
  float th = 0.11 * (1.0 - ax) + 0.03;
  float wing = smoothstep(th, th * 0.35, abs(p.y - yc));
  float body = smoothstep(0.16, 0.08, length(p * vec2(1.0, 1.6)));
  return max(wing, body);
}

float flock(vec2 uv, float aspect, float t){
  float m = 0.0;
  float period = 46.0;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float tt = t + fk * period * 0.55;
    float cyc = floor(tt / period);
    float ph = fract(tt / period);
    float dir = mod(cyc + fk, 2.0) < 1.0 ? 1.0 : -1.0;
    float x0 = dir > 0.0 ? -0.15 + ph * 1.3 : 1.15 - ph * 1.3;
    float y0 = 0.74 + 0.1 * h12(vec2(cyc, fk)) + sin(tt * 0.35) * 0.012;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 o = vec2((h12(vec2(fi, cyc + fk)) - 0.5) * 0.09, (h12(vec2(fi + 3.0, cyc)) - 0.5) * 0.05);
      float size = 0.0075 + 0.004 * h12(vec2(fi, 9.0 + fk));
      vec2 p = (uv - vec2(x0, y0) - o) * vec2(aspect, 1.0) / size;
      float flap = sin(t * (6.0 + 2.0 * h12(vec2(fi, 4.0))) + fi * 1.7);
      flap = mix(flap, 0.25, step(0.6, sin(t * 0.4 + fi)));   // glide now and then
      m = max(m, bird(p, flap));
    }
  }
  return m;
}

// Visor raindrops: round beads that bloom and fade, plus wind-driven streaks
// sliding up and outwards (what rain does to a helmet visor at speed).
vec3 beads(vec2 p, float scale, float t, float seed, float amt){
  vec2 q = p * scale;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = h12(id + seed);
  if (h > amt) return vec3(0.0);
  float life = fract(t * (0.07 + 0.12 * h12(id + seed + 2.3)) + h * 7.0);
  vec2 c = (vec2(h12(id + seed + 4.1), h12(id + seed + 9.7)) - 0.5) * 0.55;
  float r = (0.13 + 0.17 * h12(id + seed + 6.6)) * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.82, 1.0, life));
  vec2 d = f - c;
  float dist = length(d);
  float m = smoothstep(r, r * 0.62, dist);
  return vec3(-d * m * 2.2 / scale, m);
}

vec3 streaks(vec2 p, float scale, float t, float seed, float amt){
  // columns in a frame rotated by the wind direction
  vec2 q = p * vec2(scale, scale * 0.35);
  q.y += t * (0.9 + h12(vec2(floor(q.x), seed)) * 1.4);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = h12(id + seed);
  if (h > amt * 0.55) return vec3(0.0);
  float x = (h12(id + seed + 1.7) - 0.5) * 0.6;
  float w = 0.06 + 0.07 * h12(id + seed + 3.3);
  float head = smoothstep(w * 1.4, w * 0.6, length((f - vec2(x, 0.3)) * vec2(1.0, 2.6)));
  float tail = smoothstep(w, w * 0.2, abs(f.x - x)) * smoothstep(0.3, -0.45, f.y) * smoothstep(-0.5, 0.2, f.y) * 0.55;
  float m = max(head, tail);
  return vec3(vec2(-(f.x - x) * 2.0, 0.0) * m / scale, m);
}

void main(){
  vec2 uv = vUv;
  // head sway: roll + small translation around the centre
  vec2 cuv = uv - 0.5;
  float aspect = uRes.x / uRes.y;
  cuv.x *= aspect;
  float cr = cos(uSway.z), sr = sin(uSway.z);
  cuv = mat2(cr, -sr, sr, cr) * cuv / uZoom;
  cuv.x /= aspect;
  uv = cuv + 0.5 + uSway.xy;

  vec2 off = vec2(0.0);
  float wet = 0.0;
  if (uRain > 0.01) {
    vec2 p = vUv * vec2(aspect, 1.0);
    // wind pushes water up and away from the visor centre
    vec2 ctr = vec2(0.5 * aspect, 0.18);
    float ang = atan(p.x - ctr.x, p.y - ctr.y);
    vec2 rp = vec2(ang * 1.4, length(p - ctr));
    vec3 s1 = streaks(rp, 26.0, uTime * 0.6, 3.1, uRain);
    vec3 b1 = beads(p, 22.0, uTime, 1.3, uRain);
    vec3 b2 = beads(p, 48.0, uTime * 1.3, 7.9, uRain);
    off = b1.xy + b2.xy * 0.8 + s1.xy;
    wet = clamp(b1.z + b2.z * 0.7 + s1.z, 0.0, 1.0);
  }

  vec3 col;
  if (uRain > 0.01) {
    // visor film: soften the world a little, drops show a sharper, flipped image
    vec2 px = 1.4 / uRes;
    vec3 soft = (sceneAt(uv + off + px * vec2(2.0, 0.0)) + sceneAt(uv + off - px * vec2(2.0, 0.0)) +
                 sceneAt(uv + off + px * vec2(0.0, 2.0)) + sceneAt(uv + off - px * vec2(0.0, 2.0))) * 0.25;
    vec3 sharp = sceneAt(uv + off * 6.0);
    col = mix(mix(sceneAt(uv), soft, uRain * 0.85), sharp * 1.06, wet);
    col += wet * 0.05;
    col *= 1.0 - uRain * 0.12;
  } else {
    col = sceneAt(uv);
  }

  // a few birds crossing the sky
  if (uBirds > 0.01) col = mix(col, col * 0.18 + vec3(0.04, 0.035, 0.04), flock(uv, aspect, uTime) * uBirds * 0.85);

  // headlight: a warm cone of light down the road
  if (uHead > 0.01) {
    float spread = 0.07 + max(0.0, 0.5 - vUv.y) * 0.6;
    float cone = exp(-pow((vUv.x - 0.5) / spread, 2.0)) * smoothstep(0.52, 0.22, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
    col *= 1.0 + cone * uHead * 1.6;
    col += vec3(1.0, 0.86, 0.62) * cone * uHead * 0.05;
  }

  // fog: thicker towards the distance (upper image), drifting wisps
  if (uFog > 0.01) {
    float wisp = fbm(vec2(uv.x * 2.5 + uTime * 0.025, uv.y * 3.0 - uTime * 0.01));
    float depth = smoothstep(0.15, 0.62, uv.y);
    float f = uFog * clamp(0.25 + 0.75 * depth + (wisp - 0.5) * 0.5, 0.0, 1.0);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, mix(vec3(l), col, 0.6), uFog * 0.5);
    col = mix(col, uFogColor, f * 0.62);
  }

  col *= 1.0 - uFade;
  if (uLinear > 0.5) col = pow(max(col, 0.0), vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
}
`

export function createBackdropMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: backdrop.uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

// Rear-view mirror glass: the footage flipped, softened and dimmed.
export function createMirrorMaterial(side) {
  return new THREE.ShaderMaterial({
    uniforms: { ...backdrop.uniforms, uSide: { value: side } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${SAMPLE}
      uniform float uSide; uniform float uFade; uniform float uLinear;
      varying vec2 vUv;
      void main(){
        // look at the road near the vanishing point, mirrored horizontally
        vec2 uv = vec2(1.0 - vUv.x, vUv.y);
        uv = vec2(0.5 + uSide * 0.16 + (uv.x - 0.5) * 0.42, 0.42 + (uv.y - 0.5) * 0.42);
        vec2 px = vec2(0.004, 0.006);
        vec3 c = (sceneAt(uv) * 2.0 + sceneAt(uv + px) + sceneAt(uv - px) + sceneAt(uv + px.yx) + sceneAt(uv - px.yx)) / 6.0;
        vec2 e = vUv - 0.5;
        c *= (1.0 - dot(e, e) * 1.6) * 0.82;
        c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), 0.15);
        c *= 1.0 - uFade;
        if (uLinear > 0.5) c = pow(max(c, 0.0), vec3(2.2));
        gl_FragColor = vec4(c, 1.0);
      }`,
    toneMapped: false,
  })
}

// Visor droplets drawn over the cockpit too (rim highlights + slight shadow).
export function createRainOverlayMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: backdrop.uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG.split('void main(){')[0] + /* glsl */ `
      void main(){
        if (uRain < 0.01) discard;
        float aspect = uRes.x / uRes.y;
        vec2 p = vUv * vec2(aspect, 1.0);
        vec2 ctr = vec2(0.5 * aspect, 0.18);
        float ang = atan(p.x - ctr.x, p.y - ctr.y);
        vec2 rp = vec2(ang * 1.4, length(p - ctr));
        vec3 s1 = streaks(rp, 26.0, uTime * 0.6, 3.1, uRain);
        vec3 b1 = beads(p, 22.0, uTime, 1.3, uRain);
        vec3 b2 = beads(p, 48.0, uTime * 1.3, 7.9, uRain);
        float m = clamp(b1.z + b2.z * 0.7 + s1.z, 0.0, 1.0);
        float rim = clamp(length(b1.xy * 22.0) * 3.0 + length(b2.xy * 48.0) * 2.0, 0.0, 1.0) * m;
        // only where the cockpit is (lower part); above it the backdrop already refracts
        float low = 1.0 - smoothstep(0.32, 0.5, vUv.y);
        float a = (m * 0.07 + rim * 0.13) * uRain * low;
        gl_FragColor = vec4(mix(vec3(0.05), vec3(0.85, 0.9, 0.95), rim), a);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

// The live footage wrapped around the rider, used as the reflection/lighting
// environment so chrome, paint and glass reflect the road you're actually on.
export function createVideoEnvMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: backdrop.uniforms,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${SAMPLE}
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float yaw = atan(d.x, -d.z);            // 0 = straight ahead
        float pitch = asin(clamp(d.y, -1.0, 1.0));
        // the clip covers ~100° ahead; behind us, mirror it
        float a = abs(yaw);
        float fy = a > 1.75 ? (3.14159 - a) * sign(yaw) : yaw;
        float u = 0.5 + fy / 3.5;
        float v = clamp(0.5 + pitch / 1.4, 0.02, 0.98);
        vec3 c = sceneAt(vec2(clamp(u, 0.02, 0.98), v));
        // above the frame: carry the sky colour upwards, slightly brighter
        c *= 1.0 + smoothstep(0.3, 1.2, pitch) * 0.25;
        gl_FragColor = vec4(pow(max(c, 0.0), vec3(2.2)), 1.0); // environment maps are linear
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  })
}
