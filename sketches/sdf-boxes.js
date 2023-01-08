const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const glsl = require('glslify');
const tome = require('chromotome');
const THREE = require('three');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 4,
};

const palettes = [
  'spatial02',
  'spatial03i',
  'ducci_f',
  'rohlfs_2',
  'ducci_d',
  'revolucion',
  'butterfly',
  'floratopia',
  'ducci_i',
  'spatial02i',
];

function colors(minContrast = 3) {
  let palette = tome.get(Random.pick(palettes));
  if (!palette.background) palette = tome.get();

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) => Color.contrastRatio(background, color) >= minContrast
  );

  const stroke = palette.stroke === background ? null : palette.stroke;

  const foreground = stroke || Random.pick(colors);
  const diffusion = palette.stroke || Random.pick(colors);

  return {
    name: palette.name,
    background,
    foreground,
    diffusion,
  };
}

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 diffusion;
  uniform vec3 rotationAxis;
  uniform float offsetX;
  uniform float offsetY;
  uniform vec3 boxSize;
  varying vec2 vUv;

  #define PI 3.14159265359

  float sdRoundBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  mat4 rotation3d(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }

  vec3 opBend(in float k, in vec3 p) {
    float c = cos(k*p.x);
    float s = sin(k*p.x);
    mat2  m = mat2(c,-s,s,c);
    return vec3(m*p.xy,p.z);
  }

  float map(in vec3 pos) {
    float d = 1e10;
    float r = 0.0125;

    for (int x = -3; x <= 3; x++) {
      for (int y = -1; y <= 1; y++) {
        vec3 q = pos - vec3(.5 * float(x), .25 * float(y), 0.0);

        float amount = (time + float(x) * offsetX + float(y) * offsetY) * PI * 2.;
        float rotation = sin(amount) * PI * 0.25;
        float bend = cos(amount) * .5;

        q.xyz = (rotation3d(rotationAxis, rotation) * vec4(q, 1.0)).xyz;
        q = opBend(bend, q);
        d = min(d, sdRoundBox(q, boxSize, r));
      }
    }

    return d;
  }

  // https://iquilezles.org/articles/rmshadows
  float calcSoftshadow(in vec3 ro, in vec3 rd, float tmin, float tmax, const float k) {
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 64; i++) {
      float h = map(ro + rd * t);
      res = min(res, k * h / t);
      t += clamp(h, 0.01, 0.10);
      if (res < 0.002 || t > tmax)
        break;
    }
    return clamp(res, 0.0, 1.0);
  }

  // https://iquilezles.org/articles/normalsSDF
  vec3 calcNormal(in vec3 pos) {
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    const float eps = 0.0005;
    return normalize(
        e.xyy * map(pos + e.xyy * eps) + e.yyx * map(pos + e.yyx * eps) +
        e.yxy * map(pos + e.yxy * eps) + e.xxx * map(pos + e.xxx * eps));
  }

  void main() {
    vec3 ro = vec3(0., 0., 2.0);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    // camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));


    vec2 p = (-1.0 + 2.0 * vUv);

    // create view ray
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.5 * ww);

    // raymarch
    const float tmax = 5.0;
    float t = 0.0;
    for (int i = 0; i < 256; i++) {
      vec3 pos = ro + t * rd;
      float h = map(pos);
      if (h < 0.0001 || t > tmax)
        break;
      t += h;
    }

    // shading/lighting
    vec3 col = vec3(0.0);
    if (t < tmax) {
      vec3 pos = ro + t * rd;
      vec3 nor = calcNormal(pos);
      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);

      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, light, 0.001, 1.0, 32.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
    }

    // gamma
    col = sqrt(col);
    vec3 tot = mix(background, foreground, col);

    gl_FragColor = vec4(tot, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { name, background, foreground, diffusion } = colors();
  console.log({ name, background, foreground, diffusion });
  const rotationAxis = Random.quaternion();
  rotationAxis.pop();
  const offset = Random.range(-0.125, 0.125);

  return createShader({
    gl,
    frag,
    uniforms: {
      background: new THREE.Color(background).toArray(),
      foreground: new THREE.Color(foreground).toArray(),
      diffusion: new THREE.Color(diffusion).toArray(),
      rotationAxis,
      time: ({ playhead }) => playhead,
      offsetX: offset,
      offsetY: offset,
      boxSize: [0.25, 0.00625 / 4.0, 0.25],
    },
  });
};

canvasSketch(sketch, settings);
