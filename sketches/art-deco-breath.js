const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 4,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  #define PI 3.14159265359

  float hexagon(vec2 position) {
    position /= vec2(sqrt(3.0), 1.5);
    position.y -= 0.5;
    position.x -= fract(floor(position.y) * 0.5);
    position = abs(fract(position) - 0.5);
    return abs(1.0 - max(position.x + position.y * 1.5, position.x * 2.0)) * sqrt(3.0) * 0.5;
  }

  void main () {
    float res = 4.0;
    vec2 st = (-res + res * 2. * vUv);
    float scale = 0.5;
    float d = hexagon(st / scale) * scale;
    float off = sin(time*PI*2. + length(vUv - vec2(0.5)) * PI * .25) * 1.;
    float c = step(0.5, fract(off + d * 10.0));

    vec3 color = mix(background, foreground, c);
    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ playhead }) => playhead,
      background,
      foreground,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get(); // spatial03
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
