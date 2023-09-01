const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../utils/mouse');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359
  #define TAU 6.283185
  #define sampleCount 12

  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;

  mat2 rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  float TIME = 0.0;
  vec2 RUV = vec2(0.0);

  float nrand( vec2 n ) {
    return fract(sin(dot(n.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float n1rand( vec2 n ) {
    TIME *= 1.01;
    float t = fract( TIME );
    float nrnd0 = nrand( RUV + vec2(0.07*t, -0.07*t) );
    return nrnd0;
  }

  float sdSphere(vec3 p, float s) {
    return length(p)-s;
  }

  float sdBox(in vec3 p, in vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.);
  }

  float sdPlane(in vec3 p, in vec3 n, in float o) {
      return dot(p, n)-o;
  }

  float opU(in float d1, in float d2) {
      return min(d1, d2);
  }

  float opS(in float d1, in float d2) {
      return max(-d1, d2);
  }

  vec2 doModel(vec3 p) {
    vec3 q = p;
    float res = sdPlane(q, vec3(0., 1., 0.), -2.);
    res = opU(res, sdPlane(q, vec3(0., 1., 0.), -2.));

    vec3 size = vec3(1., 2., 0.2);
    vec3 offset = vec3(0., 0.0, 0.8);
    res = opU(res, sdBox(q + offset * -4., size));
    res = opU(res, sdBox(q + offset * -3., size));
    res = opU(res, sdBox(q + offset * -2., size));
    res = opU(res, sdBox(q + offset * -1., size));
    res = opU(res, sdBox(q + offset * 0. , size));
    res = opU(res, sdBox(q + offset * 1. , size));
    res = opU(res, sdBox(q + offset * 2. , size));
    res = opU(res, sdBox(q + offset * 2. , size));
    res = opU(res, sdBox(q + offset * 3. , size));
    res = opU(res, sdBox(q + offset * 4. , size));
    res = opU(res, sdBox(q + offset * 5. , size));
    res = opU(res, sdBox(q + offset * 6. , size));

    res = opS(sdBox(q + vec3(0., 0.3, 0.), vec3(0.6, 1.7, 10)), res);

    return vec2(res, 0.);
  }

  vec3 march(in vec3 ro, in vec3 rd, in float maxD) {
    float minD=0.;
    float threshold = 0.0001;

    float d=minD;
    for(int i=0;i<90;i++){
        vec3 pos = ro + rd*d;
        float tmp = doModel(pos).x;
        if(tmp <threshold || maxD<tmp) break;
        d += tmp;
    }

    if (maxD < d) return vec3(maxD);
    return ro + rd * clamp(d, 0., maxD);
  }

  void main() {
    TIME = time;
    RUV = (gl_FragCoord.xy-0.5*resolution.xy)/min(resolution.x, resolution.y);
    // start with a black pixel value.
    // pix_value = 0
    vec3 color = vec3(0.0);
    float pix_value = 0.0;

    vec3 ro = vec3(-5, 10, 10) * .5;
    vec3 rt = vec3(0, 0, 0);

    ro.yz *= rot(-PI*0.5 + PI * mouse.y);
    ro.xz *= rot(-PI*0.5 + PI * mouse.x);

    vec2 screenPos = square(resolution);
    float lensLength = 2.;

    vec3 rd = camera(ro, rt, screenPos, lensLength);
    vec3 hit = march(ro, rd, 100.0);
    vec3 p = ro;
    float d = distance(hit, p);

    for (int i = 0; i < sampleCount; i++) {
      vec3 sample = mix(p, hit, n1rand(ro.xy * 0.01));
      vec3 light = vec3(0., .1, sin(TAU * playhead) * 3.);
      float maxD = distance(sample, light);

      if (march(sample, normalize(light - sample), maxD).x == maxD) {
        pix_value += d / pow(1. + maxD, 2.);
      }
    }

    pix_value *= 1.0 / float(sampleCount);
    color = vec3(pix_value);

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl, canvas, update }) => {
  const { background, foreground } = colors();
  const mouse = createMouse(canvas);

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time + 0.1,
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
      background,
      foreground,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get();
  if (!palette.background) palette = tome.get();
  console.log(palette.name);

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) =>
      Color.contrastRatio(background, color) >= minContrast &&
      color !== background
  );

  const foreground = Random.pick(colors);

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
  };
}

canvasSketch(sketch, settings);
