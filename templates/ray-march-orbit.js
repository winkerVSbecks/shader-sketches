const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../../utils/mouse');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359
  #define TAU 6.283185

  vec2 doModel(vec3 p);

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;
  uniform float dist;
  uniform float height;

  mat2 rot(float a) {
      float s=sin(a), c=cos(a);
      return mat2(c, -s, s, c);
  }

  float sdBox(vec3 p, vec3 s) {
    p = abs(p)-s;
    return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
  }

  vec2 doModel(vec3 p) {
    float d = sdBox(p, vec3(1));
    return vec2(d, 0.0);
  }

  void main() {
    vec3 color = vec3(0.0);

    float cameraAngle  = 0.;
    vec3  ro = vec3(0, 5, -5);
    vec3  rt = vec3(0, 0, 0);
    vec2  screenPos = square(resolution.xy);
    float lensLength = 2.0;

    ro.yz *= rot(mouse.y*PI+1.);
    ro.xz *= rot(mouse.x*TAU);

    vec3 rd = camera(ro, rt, screenPos, lensLength);

    vec2 t = raytrace(ro, rd, 20.0, 0.005);
    if (t.x > -0.5) {
      vec3 pos = ro + rd * t.x;
      vec3 nor = normal(pos);
      color = nor * 0.5 + 0.5;
    }

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
