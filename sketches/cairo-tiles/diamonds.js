const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  void main () {
    vec2 uv = -0.5 + vUv;
    vec3 color = background;

    // zoom out
    uv *= 5.;

    // center the uv in each tile
    uv = fract(uv)-.5;
    // mirror
    vec2 p = abs(uv);

    float k = sin(PI * time); // 0 - 1
    float a = (k*.5+.5) * PI;
    vec2 n = vec2(sin(a), cos (a));

    // slanted line
    float d = dot (p-.5, n);
    d = min(d, p.x);
    d = max(d, -p.y) ;
    d = abs(d);

    float t = smoothstep(0.01, 0., d-.01);
    color = mix(color, foreground, t);

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  const res = 0.1;
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ playhead }) => playhead,
      res,
      count: 1 / res,
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
  console.log(`%c ${background}`, `background: ${background}`);
  console.log(`%c ${foreground}`, `background: ${foreground}`);

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
  };
}

canvasSketch(sketch, settings);
