// Illustrator's grade for the whole frame: split toning (warm light, cool
// shadows), sun glow, dust drifting in the light, canvas grain, vignette.
// (The scenery itself is pre-painted once per scene, see prepaint.js.)
import { Effect } from 'postprocessing'
import { Uniform, Vector2, Vector3 } from 'three'

const grade = /* glsl */ `
uniform float uSat;
uniform float uContrast;
uniform float uExposure;
uniform vec3 uTint;
uniform vec3 uShadow;
uniform vec3 uHigh;
uniform float uSplit;
uniform vec2 uSunPos;
uniform vec3 uSunColor;
uniform float uGlow;
uniform float uMotes;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float x){ return h12(vec2(x, x * 1.37 + 3.1)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 col = pow(max(inputColor.rgb * uExposure, 0.0), vec3(1.0 / 2.2));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  float sh = 1.0 - smoothstep(0.05, 0.55, l);
  float hi = smoothstep(0.35, 0.8, l) * (1.0 - smoothstep(0.82, 1.0, l) * 0.7);
  col = mix(col, col * uShadow, sh * uSplit);
  col = mix(col, col * uHigh, hi * uSplit);
  col *= uTint;
  vec2 q = (uv - uSunPos) * vec2(resolution.x / resolution.y, 1.0);
  float g = exp(-length(q) * 2.0);
  col += uSunColor * g * uGlow;
  col = 1.0 - (1.0 - col) * (1.0 - uSunColor * g * uGlow * 0.5);

  // dust and pollen drifting through the light (grid: each pixel checks 9 cells)
  if (uMotes > 0.01) {
    float asp = resolution.x / resolution.y;
    float cells = 5.0;
    vec2 gp = uv * vec2(asp, 1.0) * cells + vec2(time * 0.035, time * 0.012);
    vec2 id = floor(gp);
    float near = 0.4 + 0.6 * exp(-length(q) * 1.2);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cid = id + vec2(float(i), float(j));
        float h = h12(cid);
        if (h > 0.6) continue;
        vec2 pp = cid + 0.5 + 0.42 * vec2(sin(time * 0.13 * (1.0 + h) + h * 21.0), cos(time * 0.1 * (1.0 + h) + h * 13.0));
        float r = (1.2 + 3.0 * h12(cid + 7.7)) / resolution.y * cells;
        float tw = 0.45 + 0.55 * sin(time * (0.8 + h) * 2.0 + h * 40.0);
        col += mix(vec3(1.0, 0.92, 0.75), uSunColor, 0.5) * smoothstep(r, 0.0, length(gp - pp)) * tw * uMotes * 0.55 * near;
      }
    }
  }
  vec2 p = uv * resolution;
  col += (h12(floor(p / 1.5)) - 0.5) * 0.014;
  vec2 v = uv - 0.5;
  col *= 1.0 - smoothstep(0.38, 0.95, length(v * vec2(1.0, 0.8))) * 0.3;
  outputColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', grade, {
      uniforms: new Map([
        ['uSat', new Uniform(1.2)],
        ['uContrast', new Uniform(1.06)],
        ['uExposure', new Uniform(1)],
        ['uTint', new Uniform(new Vector3(1, 1, 1))],
        ['uShadow', new Uniform(new Vector3(1, 1, 1))],
        ['uHigh', new Uniform(new Vector3(1, 1, 1))],
        ['uSplit', new Uniform(0)],
        ['uSunPos', new Uniform(new Vector2(0.2, 0.8))],
        ['uSunColor', new Uniform(new Vector3(1, 0.7, 0.4))],
        ['uGlow', new Uniform(0)],
        ['uMotes', new Uniform(0)],
      ]),
    })
  }
}
