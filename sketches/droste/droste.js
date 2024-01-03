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
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  // Based on http://roy.red/posts/infinite-regression/
  precision highp float;

  #define PI 3.14159265359

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  //'Smaller and Smaller'
  float f(float x){
    return exp2(-floor(log2(x))-2.);
  }

  float circle(vec2 z){
    return 1. - length(2.*z - 1.);
  }

  vec3 color(vec2 z) {
    vec2 a_z = abs(z);
    float scale = f(max(a_z.x,a_z.y));
    return mix(background, foreground, circle(fract(z*scale)));
  }

  void main () {
    // Map the normalized pixel position to a -1.0 to +1.0 range
    // so that it's symmetric both vertically and horizontally
    vec2 p = (-1.0 + 2.0 * vUv);
    gl_FragColor = vec4(color(p), 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
      background: background,
      foreground: foreground,
    },
  });
};

canvasSketch(sketch, settings);

function colors(minContrast = 1) {
  let palette = tome.get();
  if (!palette.background) palette = tome.get();

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
