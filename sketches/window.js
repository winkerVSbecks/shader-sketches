const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../utils/mouse');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl2',
  animate: true,
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `#version 300 es
  precision highp float;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define TAU 6.283185

  vec2 doModel(vec3 p);

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')
  #pragma glslify: smin = require('glsl-smooth-min')
  #pragma glslify: combine = require('glsl-combine-smooth')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;
  uniform vec3  background;
  uniform vec3  foreground;

  mat2 rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  float sdCappedCylinder(vec3 p, vec3 a, vec3 b, float r) {
    vec3  ba = b - a;
    vec3  pa = p - a;
    float baba = dot(ba,ba);
    float paba = dot(pa,ba);
    float x = length(pa*baba-ba*paba) - r*baba;
    float y = abs(paba-baba*0.5)-baba*0.5;
    float x2 = x*x;
    float y2 = y*y*baba;
    float d = (max(x,y)<0.0)?-min(x2,y2):(((x>0.0)?x2:0.0)+((y>0.0)?y2:0.0));
    return sign(d)*sqrt(abs(d))/baba;
  }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  float sdBezier(in vec3 p, in vec3 v1, in vec3 v2, in vec3 v3) {
    vec3 c1 = p - v1;
    vec3 c2 = 2.0 * v2 - v3 - v1;
    vec3 c3 = v1 - v2;

    float t3 = dot(c2, c2);
    float t2 = dot(c3, c2) * 3.0 / t3;
    float t1 = (dot(c1, c2) + 2.0 * dot(c3, c3)) / t3;
    float t0 = dot(c1, c3) / t3;

    float t22 = t2 * t2;
    vec2 pq = vec2(t1 - t22 / 3.0, t22 * t2 / 13.5 - t2 * t1 / 3.0 + t0);
    float ppp = pq.x * pq.x * pq.x, qq = pq.y * pq.y;

    float p2 = abs(pq.x);
    float r1 = 1.5 / pq.x * pq.y;

    if (qq * 0.25 + ppp / 27.0 > 0.0) {
        float r2 = r1 * sqrt(3.0 / p2), root;
        if (pq.x < 0.0) root = sign(pq.y) * cosh(acosh(r2 * -sign(pq.y)) / 3.0);
        else root = sinh(asinh(r2) / 3.0);
        root = clamp(-2.0 * sqrt(p2 / 3.0) * root - t2 / 3.0, 0.0, 1.0);
        return length(p - mix(mix(v1, v2, root), mix(v2, v3, root), root));
    }

    else {
        float ac = acos(r1 * sqrt(-3.0 / pq.x)) / 3.0;
        vec2 roots = clamp(2.0 * sqrt(-pq.x / 3.0) * cos(vec2(ac, ac - 4.18879020479)) - t2 / 3.0, 0.0, 1.0);
        vec3 p1 = p - mix(mix(v1, v2, roots.x), mix(v2, v3, roots.x), roots.x);
        vec3 p2 = p - mix(mix(v1, v2, roots.y), mix(v2, v3, roots.y), roots.y);
        return sqrt(min(dot(p1, p1), dot(p2, p2)));
    }
  }

  float sdVerticalCapsule( vec3 p, float h, float r ) {
    p.y -= clamp( p.y, 0.0, h );
    return length( p ) - r;
  }

  vec2 doModel(vec3 p) {

    // float t1 = 0.5, t2 = 0., t3 = 1.25;
    // float c1 = cos(t1), s1 = sin(t1);
    // float c2 = cos(t2), s2 = sin(t2);
    // float c3 = cos(t3), s3 = sin(t3);
    // vec3 a = vec3(c2 * 2.0, s3 + 0.25, s1) * 2.0;
    // vec3 b = vec3(s1 * 2.0, s2 + 0.25, c3) * 2.0;
    // vec3 c = vec3(c3 * 2.0, c1 + 0.25, s2) * 2.0;

    vec3 a = vec3(0, 4, 0);
    vec3 b = vec3(-3, 2, 0);
    vec3 c = vec3(-3, 1, 0);

    float d = 0.;
    float d1 = sdBezier(p, a, b, c) - 0.15;
    float d2 = sdBezier(p, a, b * vec3(-1, 1, 1), c * vec3(-1, 1, 1)) - 0.15;
    d = min(d1, d2);
    d = min(d, sdVerticalCapsule(p - vec3(-3, -4, 0), 5., 0.15));
    d = min(d, sdVerticalCapsule(p - vec3(3, -4, 0), 5., 0.15));
    p.xy = p.yx;
    d = min(d, sdVerticalCapsule(p - vec3(-4, -3, 0), 6., 0.15));

    return vec2(d, 0);
  }

  void main() {
    vec3 color = vec3(background);

    float cameraAngle  = 0.;
    vec3 ro = vec3(0, 0, 5);
    vec3 rt = vec3(0, 0, 0);
    vec2 screenPos = square(resolution.xy);
    float lensLength = 1.0;

    ro.yz *= rot(PI*0.5 + PI * mouse.y);
    ro.xz *= rot(PI*0.5 + PI * mouse.x);
    // ro.yz *= rot(mouse.y * PI+1.);
    // ro.xz *= rot(mouse.x * TAU);

    vec3 rd = camera(ro, rt, screenPos, lensLength);

    // vec2 t = raytrace(ro, rd, 100.0, 0.1);
    vec2 t = raytrace(ro, rd);
    vec3 lp = vec3(1, 1, 1);

    if (t.x > -0.5) {
      vec3 pos = ro + rd * t.x;
      vec3 nor = normal(pos);
      // color = (nor * 0.5 + 0.5) * foreground;

      vec3 ed = normalize(ro - pos);
      vec3 ld = normalize(lp - pos);

      // basic blinn phong lighting
      float power = blinnPhongSpec(ld, ed, nor, 0.1);
      color = vec3(power) * foreground;
    }

    // gl_FragColor = vec4(color, 1.0);
    fragColor = vec4(color, 1.0);
  }
`);

export const vert = glsl(/* glsl */ `#version 300 es
  precision highp float;
  in vec3 position;

  void main () {
    gl_Position = vec4(position.xyz, 1.0);
  }
`);

const sketch = ({ gl, canvas, update }) => {
  const { background, foreground } = colors();
  const mouse = createMouse(canvas);

  return createShader({
    gl,
    vert,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
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
